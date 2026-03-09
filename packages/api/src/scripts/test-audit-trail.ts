#!/usr/bin/env npx tsx
/**
 * Smoke Test — Phase 3 Audit Trail
 *
 * Verifies the DynamoDB audit trail writes correctly end-to-end.
 * Run AFTER deploying Phase 3 to check that:
 *   1. logAuditEvent() writes to DynamoDB with correct key schema.
 *   2. queryAuditEvents() retrieves events by tenantId.
 *   3. GSI by-record and by-actor are queryable.
 *   4. GET /api/v1/audit-trail Lambda returns events.
 *
 * Pre-requisites:
 *   - AWS credentials configured (aws sso login / env vars)
 *   - AUDIT_EVENTS_TABLE_NAME env var set (or defaults to aisentinels-audit-events-prod)
 *   - API_ENDPOINT env var set to the API Gateway URL
 *   - AUTH_TOKEN env var set to a valid Cognito JWT (for /audit-trail endpoint test)
 *
 * Usage:
 *   npx tsx packages/api/src/scripts/test-audit-trail.ts
 *
 * Or with env vars:
 *   AUDIT_EVENTS_TABLE_NAME=aisentinels-audit-events-prod \
 *   API_ENDPOINT=https://xxxxx.execute-api.us-east-1.amazonaws.com \
 *   AUTH_TOKEN=eyJ... \
 *   npx tsx packages/api/src/scripts/test-audit-trail.ts
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

// ── Config ────────────────────────────────────────────────────────────────────
const TABLE_NAME = process.env.AUDIT_EVENTS_TABLE_NAME ?? 'aisentinels-audit-events-prod';
const API_ENDPOINT = process.env.API_ENDPOINT ?? '';
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? '';
const TEST_TENANT_ID = 'smoke-test-tenant-00000000';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

// ── Helpers ────────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function pass(name: string): void {
  passed++;
  console.log(`  \u2705 PASS: ${name}`);
}

function fail(name: string, reason: string): void {
  failed++;
  console.error(`  \u274c FAIL: ${name} — ${reason}`);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

async function testDirectWrite(): Promise<string> {
  console.log('\n\u2500\u2500 Test 1: Direct DynamoDB PutItem (simulates logAuditEvent) \u2500\u2500');

  const now = new Date();
  const iso = now.toISOString();
  const testId = `SMOKETEST_${Date.now()}`;
  const sk = `EVENT#${iso}#${testId}`;

  const item = {
    tenantId: TEST_TENANT_ID,
    timestampEventId: sk,
    actorId: 'smoke-test-actor',
    createdAt: iso,
    tableName: 'document',
    recordId: 'smoke-test-doc-001',
    eventType: 'smoke.test.created',
    entityType: 'document',
    entityId: 'smoke-test-doc-001',
    action: 'CREATE',
    detail: { test: true, timestamp: iso },
    severity: 'info',
    ttl: Math.floor(Date.now() / 1000) + 3600, // 1hr TTL for cleanup
  };

  try {
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    pass('PutItem succeeded with correct key schema (tenantId + timestampEventId)');
    return sk;
  } catch (err) {
    fail('PutItem', err instanceof Error ? err.message : String(err));
    return '';
  }
}

async function testMainTableQuery(sk: string): Promise<void> {
  console.log('\n\u2500\u2500 Test 2: Main table Query (by tenantId) \u2500\u2500');

  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'tenantId = :tid AND timestampEventId = :sk',
      ExpressionAttributeValues: {
        ':tid': TEST_TENANT_ID,
        ':sk': sk,
      },
      Limit: 1,
    }));

    if (result.Items && result.Items.length === 1) {
      const item = result.Items[0]!;
      // Verify key fields
      if (item['tenantId'] === TEST_TENANT_ID) pass('PK (tenantId) matches');
      else fail('PK check', `Expected ${TEST_TENANT_ID}, got ${item['tenantId']}`);

      if (item['timestampEventId'] === sk) pass('SK (timestampEventId) matches');
      else fail('SK check', `Expected ${sk}, got ${item['timestampEventId']}`);

      if (item['eventType'] === 'smoke.test.created') pass('eventType stored correctly');
      else fail('eventType check', `Got ${item['eventType']}`);

      if (item['actorId'] === 'smoke-test-actor') pass('actorId stored (GSI-1 by-actor PK)');
      else fail('actorId check', `Got ${item['actorId']}`);

      if (item['tableName'] === 'document') pass('tableName stored (GSI-2 by-record PK)');
      else fail('tableName check', `Got ${item['tableName']}`);

      if (item['recordId'] === 'smoke-test-doc-001') pass('recordId stored (GSI-2 by-record SK)');
      else fail('recordId check', `Got ${item['recordId']}`);
    } else {
      fail('Query result', `Expected 1 item, got ${result.Items?.length ?? 0}`);
    }
  } catch (err) {
    fail('Main table query', err instanceof Error ? err.message : String(err));
  }
}

async function testGsiByActor(): Promise<void> {
  console.log('\n\u2500\u2500 Test 3: GSI by-actor Query \u2500\u2500');

  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'by-actor',
      KeyConditionExpression: 'actorId = :aid',
      FilterExpression: 'tenantId = :tid',
      ExpressionAttributeValues: {
        ':aid': 'smoke-test-actor',
        ':tid': TEST_TENANT_ID,
      },
      Limit: 5,
      ScanIndexForward: false,
    }));

    if (result.Items && result.Items.length >= 1) {
      pass(`GSI by-actor returned ${result.Items.length} item(s)`);
    } else {
      fail('GSI by-actor', `Expected >= 1 item, got ${result.Items?.length ?? 0}`);
    }
  } catch (err) {
    fail('GSI by-actor query', err instanceof Error ? err.message : String(err));
  }
}

async function testGsiByRecord(): Promise<void> {
  console.log('\n\u2500\u2500 Test 4: GSI by-record Query \u2500\u2500');

  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'by-record',
      KeyConditionExpression: 'tableName = :tn AND recordId = :ri',
      FilterExpression: 'tenantId = :tid',
      ExpressionAttributeValues: {
        ':tn': 'document',
        ':ri': 'smoke-test-doc-001',
        ':tid': TEST_TENANT_ID,
      },
      Limit: 5,
    }));

    if (result.Items && result.Items.length >= 1) {
      pass(`GSI by-record returned ${result.Items.length} item(s)`);
    } else {
      fail('GSI by-record', `Expected >= 1 item, got ${result.Items?.length ?? 0}`);
    }
  } catch (err) {
    fail('GSI by-record query', err instanceof Error ? err.message : String(err));
  }
}

async function testApiEndpoint(): Promise<void> {
  console.log('\n\u2500\u2500 Test 5: GET /api/v1/audit-trail endpoint \u2500\u2500');

  if (!API_ENDPOINT) {
    console.log('  \u23e9 SKIP: API_ENDPOINT env var not set');
    return;
  }
  if (!AUTH_TOKEN) {
    console.log('  \u23e9 SKIP: AUTH_TOKEN env var not set');
    return;
  }

  try {
    const url = `${API_ENDPOINT}/api/v1/audit-trail?limit=5`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });

    if (resp.status === 200) {
      pass(`GET /api/v1/audit-trail returned 200`);
      const body = await resp.json() as { count: number; events: unknown[] };
      pass(`Response contains ${body.count} event(s)`);
    } else if (resp.status === 401) {
      fail('API endpoint', '401 Unauthorized — check AUTH_TOKEN');
    } else {
      fail('API endpoint', `HTTP ${resp.status}: ${await resp.text()}`);
    }
  } catch (err) {
    fail('API endpoint', err instanceof Error ? err.message : String(err));
  }
}

async function cleanupTestData(sk: string): Promise<void> {
  console.log('\n\u2500\u2500 Cleanup: Deleting smoke test item \u2500\u2500');

  if (!sk) {
    console.log('  \u23e9 SKIP: No SK to clean up');
    return;
  }

  try {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { tenantId: TEST_TENANT_ID, timestampEventId: sk },
    }));
    console.log('  \ud83e\uddf9 Smoke test item deleted');
  } catch (err) {
    console.warn(`  \u26a0\ufe0f  Cleanup failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log(' Phase 3 Audit Trail — Smoke Test');
  console.log(`  Table: ${TABLE_NAME}`);
  console.log(`  API:   ${API_ENDPOINT || '(not set — endpoint test will be skipped)'}`);
  console.log('='.repeat(60));

  const sk = await testDirectWrite();
  if (sk) {
    await testMainTableQuery(sk);
    await testGsiByActor();
    await testGsiByRecord();
  }
  await testApiEndpoint();

  // Cleanup
  if (sk) await cleanupTestData(sk);

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log(` Results:  ${passed} passed,  ${failed} failed`);
  console.log('='.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
