import { PrismaClient } from '@prisma/client';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { execSync } from 'child_process';

let _prisma: PrismaClient | null = null;

async function getDatabaseUrl(): Promise<string> {
  // Local dev: use DATABASE_URL directly
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Production: fetch from Secrets Manager
  const secretArn = process.env.DB_SECRET_ARN;
  if (!secretArn) {
    throw new Error('Neither DATABASE_URL nor DB_SECRET_ARN is set');
  }

  const client = new SecretsManagerClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
  const response = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const secret = JSON.parse(response.SecretString ?? '{}');

  return `postgresql://${secret.username}:${encodeURIComponent(secret.password)}@${secret.host}:${secret.port}/${secret.dbname}`;
}

/**
 * Must be called once at server startup BEFORE any route handler runs.
 * Fetches the DB secret, sets DATABASE_URL, and creates the Prisma instance.
 */
export async function initializePrisma(): Promise<void> {
  if (_prisma) return; // already initialized

  const url = await getDatabaseUrl();
  process.env.DATABASE_URL = url;

  // Push the Prisma schema to the database (creates tables if they don't exist)
  // This is idempotent: safe to run on every startup
  try {
    console.log('Syncing database schema...');
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      env: { ...process.env },
      stdio: 'pipe',
    });
    console.log('✓ Database schema synced');
  } catch (err: any) {
    console.error('Schema sync failed:', err.stderr?.toString() ?? err.message);
    throw err;
  }

  _prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  });
}

/**
 * Lazy proxy — all imports of `prisma` from route files go through here.
 * The Proxy forwards every property/method access to the real PrismaClient
 * instance that is created by initializePrisma().
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!_prisma) {
      throw new Error(
        'Prisma not initialized. initializePrisma() must be called in server startup.'
      );
    }
    const value = (_prisma as any)[prop];
    // Bind methods to the real instance so `this` is correct
    if (typeof value === 'function') {
      return value.bind(_prisma);
    }
    return value;
  },
});
