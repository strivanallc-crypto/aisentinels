/**
 * Migration runner — packages/db/src/migrate.ts
 *
 * Usage:
 *   pnpm db:migrate                    # prod-safe: checks snapshot first
 *   pnpm db:migrate --force            # skip snapshot check (dev only)
 *   DATABASE_URL=... pnpm db:migrate   # dev / local
 *
 * What it does:
 *   1. Optionally verifies an Aurora snapshot exists from the last 24 h
 *   2. Runs pending Drizzle migrations in a transaction
 *   3. Applies RLS policies (idempotent SQL)
 *   4. Logs the migration event to DynamoDB audit-events table
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { Signer } from '@aws-sdk/rds-signer';
import {
  RDSClient,
  DescribeDBClusterSnapshotsCommand,
  CreateDBClusterSnapshotCommand,
  waitUntilDBClusterSnapshotAvailable,
} from '@aws-sdk/client-rds';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

// ── Config ────────────────────────────────────────────────────────────────────
const ENV_NAME = process.env.ENV_NAME ?? 'prod';
const REGION = process.env.AWS_DEFAULT_REGION ?? 'us-east-1';
const CLUSTER_ID = process.env.AURORA_CLUSTER_ID ?? `aisentinels-aurora-cluster-${ENV_NAME}`;
const PROXY_ENDPOINT = process.env.AURORA_PROXY_ENDPOINT ?? '';
const DB_USER = process.env.AURORA_DB_USER ?? 'postgres';
const DB_NAME = process.env.AURORA_DB_NAME ?? 'aisentinels';
const AUDIT_TABLE = process.env.DYNAMODB_AUDIT_TABLE ?? `aisentinels-audit-events-${ENV_NAME}`;
const FORCE = process.argv.includes('--force');
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'drizzle');
const RLS_SQL_PATH = join(__dirname, 'rls.sql');

// ── Snapshot safety check ─────────────────────────────────────────────────────
async function ensureRecentSnapshot(): Promise<void> {
  if (FORCE) {
    console.warn('⚠  --force flag set: skipping Aurora snapshot check (dev only)');
    return;
  }
  if (ENV_NAME === 'dev') {
    console.log('Dev environment — skipping snapshot check');
    return;
  }

  console.log(`🔍 Checking for Aurora snapshot of cluster ${CLUSTER_ID} in last 24 h…`);
  const rds = new RDSClient({ region: REGION });
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const { DBClusterSnapshots: snapshots = [] } = await rds.send(
    new DescribeDBClusterSnapshotsCommand({
      DBClusterIdentifier: CLUSTER_ID,
      SnapshotType: 'manual',
    }),
  );

  const recent = snapshots.filter(
    (s) => s.SnapshotCreateTime && new Date(s.SnapshotCreateTime) >= cutoff,
  );

  if (recent.length === 0) {
    console.log('❌ No recent snapshot found — creating one now before migrating…');
    const snapshotId = `aisentinels-pre-migration-${Date.now()}`;

    await rds.send(
      new CreateDBClusterSnapshotCommand({
        DBClusterIdentifier: CLUSTER_ID,
        DBClusterSnapshotIdentifier: snapshotId,
        Tags: [
          { Key: 'project', Value: 'aisentinels' },
          { Key: 'env', Value: ENV_NAME },
          { Key: 'reason', Value: 'pre-migration' },
        ],
      }),
    );

    console.log(`⏳ Waiting for snapshot ${snapshotId} to become available…`);
    await waitUntilDBClusterSnapshotAvailable(
      { client: rds, maxWaitTime: 900 },
      { DBClusterSnapshotIdentifier: snapshotId },
    );
    console.log('✅ Snapshot ready.');
  } else {
    console.log(`✅ Recent snapshot found: ${recent[0]!.DBClusterSnapshotIdentifier}`);
  }
}

// ── RLS policies (idempotent) ─────────────────────────────────────────────────
/**
 * Reads src/rls.sql — the canonical, auditable RLS definition file.
 * All 11 tenant-scoped tables get RLS enabled + isolation policy + DML grants.
 * Can also be applied independently via: psql $DATABASE_URL -f src/rls.sql
 */
function readRlsSql(): string {
  return readFileSync(RLS_SQL_PATH, 'utf-8');
}

// ── Audit log to DynamoDB ─────────────────────────────────────────────────────
async function logMigrationEvent(
  status: 'success' | 'failure',
  details: Record<string, unknown>,
): Promise<void> {
  try {
    const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
    const now = new Date().toISOString();

    await dynamo.send(
      new PutCommand({
        TableName: AUDIT_TABLE,
        Item: {
          tenantId: 'SYSTEM',
          timestampEventId: `${now}#${randomUUID()}`,
          eventType: 'db.migration',
          actorId: 'migration-runner',
          status,
          details,
          createdAt: now,
        },
      }),
    );
  } catch (err) {
    // Non-fatal — migration already completed; just log locally
    console.warn('⚠  Failed to write migration audit event to DynamoDB:', err);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  console.log(`\n🚀 AI Sentinels DB Migration — ${ENV_NAME} — ${startedAt}\n`);

  // 1. Pre-migration safety check
  await ensureRecentSnapshot();

  // 2. Build connection string
  let connectionString: string;
  const isIam = Boolean(PROXY_ENDPOINT) && process.env.AURORA_IAM_AUTH === 'true';

  if (isIam) {
    const signer = new Signer({
      hostname: PROXY_ENDPOINT,
      port: 5432,
      username: DB_USER,
      region: REGION,
    });
    const token = await signer.getAuthToken();
    connectionString =
      `postgresql://${DB_USER}:${encodeURIComponent(token)}@${PROXY_ENDPOINT}:5432/${DB_NAME}` +
      `?sslmode=require`;
    console.log(`🔐 Using IAM auth via RDS Proxy: ${PROXY_ENDPOINT}`);
  } else {
    connectionString =
      process.env.DATABASE_URL ?? `postgresql://localhost:5432/${DB_NAME}`;
    console.log(`🔑 Using DATABASE_URL`);
  }

  const client = postgres(connectionString, {
    max: 1, // Single connection for migration
    ssl: isIam ? 'require' : undefined,
    onnotice: (notice) => console.log('PG Notice:', notice.message),
  });

  const db = drizzle(client);

  try {
    // 3. Run pending Drizzle migrations
    console.log(`\n📂 Running migrations from: ${MIGRATIONS_DIR}\n`);
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    console.log('\n✅ Drizzle migrations complete.\n');

    // 4. Apply RLS policies (read from canonical src/rls.sql)
    console.log(`🔒 Applying RLS policies from ${RLS_SQL_PATH}…`);
    const rlsSql = readRlsSql();
    await client.unsafe(rlsSql);
    console.log('✅ RLS policies applied.\n');

    // 5. Audit log
    await logMigrationEvent('success', {
      env: ENV_NAME,
      migrationsDir: MIGRATIONS_DIR,
      completedAt: new Date().toISOString(),
      iamAuth: isIam,
    });

    console.log('🎉 Migration pipeline complete.\n');
  } catch (err) {
    console.error('\n❌ Migration failed:', err);
    await logMigrationEvent('failure', {
      env: ENV_NAME,
      error: String(err),
      failedAt: new Date().toISOString(),
    });
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
