/**
 * POST /api/v1/ghost/trigger
 *
 * Admin-only endpoint to manually trigger a Ghost blog generation run.
 * Invokes the Ghost Lambda asynchronously (InvocationType: Event).
 *
 * Auth: JWT required + role === 'admin' (enforced in handler).
 *
 * Body (all optional):
 *   topicIndex?: number   // 0-7, which seed topic to use
 *   query?: string        // custom query override
 *   category?: string     // category override
 */
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { extractClaims } from '../../middleware/auth-context.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';

const lambdaClient = new LambdaClient({});
const GHOST_FN_NAME = process.env.GHOST_LAMBDA_FN_NAME ?? 'aisentinels-ghost-prod';

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export async function trigger(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  // ── Admin role check ────────────────────────────────────────────────────
  const claims = extractClaims(event);
  if (claims.role !== 'admin') {
    return json(403, { error: 'Forbidden — admin role required' });
  }

  // ── Parse body ────────────────────────────────────────────────────────
  let topicIndex: number | undefined;
  let query: string | undefined;
  let category: string | undefined;

  if (event.body) {
    try {
      const parsed = JSON.parse(event.body) as Record<string, unknown>;
      if (parsed.topicIndex !== undefined) {
        topicIndex = Number(parsed.topicIndex);
        if (!Number.isInteger(topicIndex) || topicIndex < 0 || topicIndex > 7) {
          return json(400, { error: 'topicIndex must be 0-7' });
        }
      }
      if (typeof parsed.query === 'string') query = parsed.query;
      if (typeof parsed.category === 'string') category = parsed.category;
    } catch {
      return json(400, { error: 'Invalid JSON body' });
    }
  }

  // ── Invoke Ghost Lambda (async — fire-and-forget) ────────────────────
  try {
    const payload = JSON.stringify({
      source: 'manual-trigger',
      topicIndex,
      query,
      category,
    });

    const response = await lambdaClient.send(new InvokeCommand({
      FunctionName: GHOST_FN_NAME,
      InvocationType: 'Event',
      Payload: new TextEncoder().encode(payload),
    }));

    const requestId = response.$metadata.requestId ?? 'unknown';

    // ── Audit log (fire-and-forget) ──────────────────────────────────
    logAuditEvent({
      eventType:  'ghost.triggered',
      entityType: 'sentinel',
      entityId:   'ghost',
      actorId:    claims.sub,
      actorEmail: claims.email,
      tenantId:   claims.tenantId,
      action:     'GENERATE',
      detail:     { topicIndex, query, category, requestId },
      severity:   'info',
    });

    console.log(JSON.stringify({
      event: 'GhostTriggerInvoked',
      functionName: GHOST_FN_NAME,
      requestId,
      topicIndex,
      triggeredBy: claims.sub,
    }));

    return json(200, {
      invoked: true,
      functionName: GHOST_FN_NAME,
      requestId,
      message: 'Ghost generation run initiated',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({
      event: 'GhostTriggerError',
      error: message,
      functionName: GHOST_FN_NAME,
    }));
    return json(500, { error: 'Failed to invoke Ghost' });
  }
}
