/**
 * Audit Trail Logger — ISO 15489 compliant, fire-and-forget DynamoDB writer.
 *
 * CRITICAL RULES:
 *   1. logAuditEvent() is VOID — fire-and-forget. NEVER awaited in hot path.
 *   2. NEVER throws — all errors caught internally and logged to CloudWatch.
 *   3. NEVER blocks the caller's response. If DynamoDB is down, the mutation
 *      still succeeds; only the audit log fails silently.
 *   4. Every event includes: who (actorId), what (action), when (timestamp),
 *      which resource (entityType + entityId) — ISO 15489 minimum.
 *
 * DynamoDB table key mapping:
 *   PK  = tenantId           (raw UUID — matches DataStack table definition)
 *   SK  = timestampEventId   (format: "EVENT#{ISO8601}#{nanoid}")
 *
 * GSI attribute mapping:
 *   by-actor:  actorId (PK) + createdAt (SK)
 *   by-record: tableName (PK) + recordId (SK)
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';

// ── DynamoDB client (singleton, reused across Lambda invocations) ────────────
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = process.env.AUDIT_EVENTS_TABLE_NAME ?? '';

// ── Zod schema for compile-time + runtime safety ────────────────────────────

const AuditEventSchema = z.object({
  eventType:   z.string().min(1).max(100),
  entityType:  z.enum(['document', 'audit', 'capa', 'record', 'user', 'sentinel', 'billing', 'org', 'brain', 'standard', 'legal']),
  entityId:    z.string().min(1).max(256),
  actorId:     z.string().min(1).max(256),
  actorEmail:  z.string().max(320).optional(),
  tenantId:    z.string().min(1).max(256),
  action:      z.enum([
    'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'GENERATE',
    'CLASSIFY', 'EXAMINE', 'FINDING', 'ORCHESTRATE', 'SUBMIT',
    'ACTIVATE', 'DEACTIVATE', 'INVITE', 'ROLE_CHANGE', 'UPGRADE',
    'VERIFY', 'PROCESS', 'PLAN', 'ANALYZE', 'REVIEW', 'ACCEPT',
  ]),
  detail:      z.record(z.unknown()),
  ipAddress:   z.string().max(45).optional(),
  userAgent:   z.string().max(500).optional(),
  clauseRef:   z.string().max(100).optional(),
  standard:    z.string().max(50).optional(),
  severity:    z.enum(['info', 'warning', 'critical']).optional(),
});

export type AuditEventInput = z.infer<typeof AuditEventSchema>;

export interface AuditEvent extends AuditEventInput {
  /** DynamoDB partition key — raw tenantId */
  tenantId: string;
  /** DynamoDB sort key — "EVENT#{ISO8601}#{nanoid}" */
  timestampEventId: string;
  /** ISO 8601 timestamp of event creation */
  createdAt: string;
  /** TTL — 7 years from now in epoch seconds (ISO 15489 retention) */
  ttl: number;
}

// ── Nano ID generator (8 chars, no external dependency) ─────────────────────

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function nanoid8(): string {
  let id = '';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 8; i++) {
    id += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return id;
}

// ── 7-year TTL calculator ───────────────────────────────────────────────────

const SEVEN_YEARS_SECONDS = 7 * 365.25 * 24 * 60 * 60; // ~220,903,200

function computeTtl(): number {
  return Math.floor(Date.now() / 1000) + Math.floor(SEVEN_YEARS_SECONDS);
}

// ── Fire-and-forget audit logger ────────────────────────────────────────────

/**
 * Log an audit event to DynamoDB. Fire-and-forget — never throws, never blocks.
 *
 * Call WITHOUT await:
 *   logAuditEvent({ eventType: 'document.created', ... });
 */
export function logAuditEvent(input: AuditEventInput): void {
  // Validate input (fail fast, log to CloudWatch)
  const parsed = AuditEventSchema.safeParse(input);
  if (!parsed.success) {
    console.error(JSON.stringify({
      event: 'AuditLogValidationError',
      errors: parsed.error.flatten(),
      input: { eventType: input.eventType, entityType: input.entityType, tenantId: input.tenantId },
    }));
    return;
  }

  const now = new Date();
  const iso = now.toISOString();
  const id = nanoid8();

  const item: Record<string, unknown> = {
    // Table keys (match DataStack definition)
    tenantId:         parsed.data.tenantId,
    timestampEventId: `EVENT#${iso}#${id}`,

    // GSI-1 by-actor attributes
    actorId:   parsed.data.actorId,
    createdAt: iso,

    // GSI-2 by-record attributes
    tableName: parsed.data.entityType,
    recordId:  parsed.data.entityId,

    // Event data
    eventType:  parsed.data.eventType,
    entityType: parsed.data.entityType,
    entityId:   parsed.data.entityId,
    action:     parsed.data.action,
    detail:     parsed.data.detail,

    // Optional fields
    ...(parsed.data.actorEmail && { actorEmail: parsed.data.actorEmail }),
    ...(parsed.data.ipAddress  && { ipAddress:  parsed.data.ipAddress }),
    ...(parsed.data.userAgent  && { userAgent:  parsed.data.userAgent }),
    ...(parsed.data.clauseRef  && { clauseRef:  parsed.data.clauseRef }),
    ...(parsed.data.standard   && { standard:   parsed.data.standard }),
    ...(parsed.data.severity   && { severity:   parsed.data.severity }),

    // ISO 15489 retention — 7 years TTL
    ttl: computeTtl(),
  };

  // Fire-and-forget — catch ALL errors silently
  void docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  })).catch((err: unknown) => {
    // Log to CloudWatch only — NEVER throw, NEVER block response
    console.error(JSON.stringify({
      event:     'AuditLogWriteError',
      error:     err instanceof Error ? err.message : String(err),
      eventType: parsed.data.eventType,
      entityId:  parsed.data.entityId,
      tenantId:  parsed.data.tenantId,
    }));
  });
}

// ── Query function (for Phase 4 GET /audit-trail) ───────────────────────────

export interface QueryAuditParams {
  tenantId:    string;
  entityId?:   string;
  entityType?: string;
  startDate?:  string;
  endDate?:    string;
  limit?:      number;
}

/**
 * Query audit events for a given tenant. Used by GET /audit-trail endpoint.
 * Returns newest-first (reverse sort key order).
 */
export async function queryAuditEvents(params: QueryAuditParams): Promise<AuditEvent[]> {
  const { tenantId, entityId, entityType, startDate, endDate, limit = 50 } = params;
  const effectiveLimit = Math.min(Math.max(limit, 1), 200);

  // If filtering by entityId, use GSI by-record
  if (entityId && entityType) {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'by-record',
      KeyConditionExpression: 'tableName = :tn AND recordId = :ri',
      FilterExpression: 'tenantId = :tid',
      ExpressionAttributeValues: {
        ':tn':  entityType,
        ':ri':  entityId,
        ':tid': tenantId,
      },
      Limit: effectiveLimit,
      ScanIndexForward: false,
    }));
    return (result.Items ?? []) as AuditEvent[];
  }

  // Default: query by tenant (main table), newest first
  let keyCondition = 'tenantId = :tid';
  const exprValues: Record<string, unknown> = { ':tid': tenantId };

  if (startDate && endDate) {
    keyCondition += ' AND timestampEventId BETWEEN :sk1 AND :sk2';
    exprValues[':sk1'] = `EVENT#${startDate}`;
    exprValues[':sk2'] = `EVENT#${endDate}~`; // ~ sorts after Z in ASCII
  } else if (startDate) {
    keyCondition += ' AND timestampEventId >= :sk1';
    exprValues[':sk1'] = `EVENT#${startDate}`;
  } else if (endDate) {
    keyCondition += ' AND timestampEventId <= :sk2';
    exprValues[':sk2'] = `EVENT#${endDate}~`;
  }

  // Optional filter on entityType
  let filterExpr: string | undefined;
  if (entityType) {
    filterExpr = 'entityType = :et';
    exprValues[':et'] = entityType;
  }

  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: keyCondition,
    ...(filterExpr && { FilterExpression: filterExpr }),
    ExpressionAttributeValues: exprValues,
    Limit: effectiveLimit,
    ScanIndexForward: false, // newest first
  }));

  return (result.Items ?? []) as AuditEvent[];
}
