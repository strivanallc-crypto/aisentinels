/**
 * Phase 13B — ISO 27001 / SOC 2 Internal Compliance Checks
 *
 * Three automated AWS evidence checks:
 *   1. IAM Access Key Age   (A.8.5 / CC6.1) — flag keys > 90 days
 *   2. S3 Bucket Encryption (A.8.24 / CC6.7) — flag buckets without KMS
 *   3. CloudTrail Status    (A.8.15 / CC4.1) — verify logging enabled
 *
 * Results written to DynamoDB `compliance-checks` table.
 * Fire-and-forget audit logging via logAuditEvent().
 * NEVER throws — errors caught per check, written as status: 'ERROR'.
 *
 * Internal only — never exposed to tenants.
 */
import { IAMClient, ListUsersCommand, ListAccessKeysCommand } from '@aws-sdk/client-iam';
import { S3Client, ListBucketsCommand, GetBucketEncryptionCommand } from '@aws-sdk/client-s3';
import { CloudTrailClient, GetTrailStatusCommand, DescribeTrailsCommand } from '@aws-sdk/client-cloudtrail';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { logAuditEvent } from '../../lib/audit-logger.ts';
import { dispatchWebhook } from '../../lib/webhook-dispatcher.ts';

// ── Clients (singleton, reused across Lambda invocations) ────────────────────
const iamClient = new IAMClient({});
const s3Client = new S3Client({});
const ctClient = new CloudTrailClient({});
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = process.env.COMPLIANCE_CHECKS_TABLE ?? '';
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_TTL_S = 90 * 24 * 60 * 60;

// ── Result types ─────────────────────────────────────────────────────────────

interface CheckResult {
  checkId: string;
  timestamp: string;
  status: 'PASS' | 'FAIL' | 'ERROR';
  findings: Record<string, unknown>[];
  runBy: string;
}

// ── Check 1: IAM Access Key Age ──────────────────────────────────────────────

async function checkIamKeyAge(): Promise<CheckResult> {
  const now = new Date();
  const timestamp = now.toISOString();

  try {
    const { Users = [] } = await iamClient.send(new ListUsersCommand({}));
    const findings: Record<string, unknown>[] = [];
    let overallPass = true;

    for (const user of Users) {
      const { AccessKeyMetadata = [] } = await iamClient.send(
        new ListAccessKeysCommand({ UserName: user.UserName }),
      );

      for (const key of AccessKeyMetadata) {
        const createDate = key.CreateDate ? new Date(key.CreateDate) : now;
        const ageDays = Math.floor((now.getTime() - createDate.getTime()) / (24 * 60 * 60 * 1000));
        const keyStatus = ageDays > 90 ? 'FAIL' : 'PASS';
        if (keyStatus === 'FAIL') overallPass = false;

        findings.push({
          user: user.UserName,
          keyId: key.AccessKeyId,
          ageDays,
          status: keyStatus,
        });
      }
    }

    return { checkId: 'iam-key-age', timestamp, status: overallPass ? 'PASS' : 'FAIL', findings, runBy: 'system' };
  } catch (err: unknown) {
    return {
      checkId: 'iam-key-age',
      timestamp,
      status: 'ERROR',
      findings: [{ error: err instanceof Error ? err.message : String(err) }],
      runBy: 'system',
    };
  }
}

// ── Check 2: S3 Bucket Encryption ────────────────────────────────────────────

async function checkS3Encryption(): Promise<CheckResult> {
  const now = new Date();
  const timestamp = now.toISOString();

  try {
    const { Buckets = [] } = await s3Client.send(new ListBucketsCommand({}));
    const findings: Record<string, unknown>[] = [];
    let overallPass = true;

    for (const bucket of Buckets) {
      try {
        const encResp = await s3Client.send(
          new GetBucketEncryptionCommand({ Bucket: bucket.Name }),
        );

        const rules = encResp.ServerSideEncryptionConfiguration?.Rules ?? [];
        const algorithm = rules[0]?.ApplyServerSideEncryptionByDefault?.SSEAlgorithm ?? 'NONE';
        const encrypted = algorithm === 'aws:kms';
        if (!encrypted) overallPass = false;

        findings.push({ bucket: bucket.Name, encrypted, algorithm });
      } catch (bucketErr: unknown) {
        // Bucket may not have encryption config — treat as FAIL
        overallPass = false;
        findings.push({
          bucket: bucket.Name,
          encrypted: false,
          algorithm: 'NONE',
          error: bucketErr instanceof Error ? bucketErr.message : String(bucketErr),
        });
      }
    }

    return { checkId: 's3-encryption', timestamp, status: overallPass ? 'PASS' : 'FAIL', findings, runBy: 'system' };
  } catch (err: unknown) {
    return {
      checkId: 's3-encryption',
      timestamp,
      status: 'ERROR',
      findings: [{ error: err instanceof Error ? err.message : String(err) }],
      runBy: 'system',
    };
  }
}

// ── Check 3: CloudTrail Status ───────────────────────────────────────────────

async function checkCloudTrailStatus(): Promise<CheckResult> {
  const now = new Date();
  const timestamp = now.toISOString();

  try {
    // Find the trail — prefer 'aisentinels-prod', fall back to first trail found
    const { trailList = [] } = await ctClient.send(new DescribeTrailsCommand({}));
    const trail = trailList.find((t) => t.Name === 'aisentinels-prod') ?? trailList[0];

    if (!trail?.TrailARN) {
      return {
        checkId: 'cloudtrail-status',
        timestamp,
        status: 'FAIL',
        findings: [{ trailName: 'NONE', isLogging: false, latestDeliveryError: 'No trail found' }],
        runBy: 'system',
      };
    }

    const statusResp = await ctClient.send(new GetTrailStatusCommand({ Name: trail.TrailARN }));
    const isLogging = statusResp.IsLogging === true;
    const latestDeliveryError = statusResp.LatestDeliveryError ?? null;
    const pass = isLogging && !latestDeliveryError;

    return {
      checkId: 'cloudtrail-status',
      timestamp,
      status: pass ? 'PASS' : 'FAIL',
      findings: [{ trailName: trail.Name, isLogging, latestDeliveryError }],
      runBy: 'system',
    };
  } catch (err: unknown) {
    return {
      checkId: 'cloudtrail-status',
      timestamp,
      status: 'ERROR',
      findings: [{ error: err instanceof Error ? err.message : String(err) }],
      runBy: 'system',
    };
  }
}

// ── Write result to DynamoDB ─────────────────────────────────────────────────

async function writeResult(result: CheckResult): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + NINETY_DAYS_TTL_S;

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      checkId:   result.checkId,
      timestamp: result.timestamp,
      status:    result.status,
      findings:  result.findings,
      runBy:     result.runBy,
      expiresAt,
    },
  }));
}

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * Run all 3 compliance checks in parallel, write results, log audit events.
 * NEVER throws — all errors caught per check.
 */
export async function runComplianceChecks(): Promise<void> {
  const results = await Promise.allSettled([
    checkIamKeyAge(),
    checkS3Encryption(),
    checkCloudTrailStatus(),
  ]);

  for (const settled of results) {
    const result = settled.status === 'fulfilled'
      ? settled.value
      : {
          checkId: 'unknown',
          timestamp: new Date().toISOString(),
          status: 'ERROR' as const,
          findings: [{ error: settled.reason instanceof Error ? settled.reason.message : String(settled.reason) }],
          runBy: 'system',
        };

    // Write to DynamoDB — catch errors per result
    try {
      await writeResult(result);
    } catch (writeErr: unknown) {
      console.error(JSON.stringify({
        event: 'ComplianceCheckWriteError',
        checkId: result.checkId,
        error: writeErr instanceof Error ? writeErr.message : String(writeErr),
      }));
    }

    // Fire-and-forget audit log — logAuditEvent never throws
    logAuditEvent({
      eventType:  'compliance.check.completed',
      entityType: 'compliance_check',
      entityId:   result.checkId,
      actorId:    'system',
      tenantId:   'SYSTEM',
      action:     'CHECK',
      detail:     { status: result.status, findingsCount: result.findings.length },
      severity:   result.status === 'PASS' ? 'info' : 'warning',
    });

    // Fire-and-forget webhook — compliance is system-level, tenantId = 'SYSTEM'
    dispatchWebhook({
      tenantId: 'SYSTEM',
      eventType: 'compliance.check_completed',
      payload: { checkId: result.checkId, status: result.status, findingsCount: result.findings.length },
    });
  }

  console.log(JSON.stringify({
    event: 'ComplianceChecksComplete',
    checksRun: results.length,
    timestamp: new Date().toISOString(),
  }));
}
