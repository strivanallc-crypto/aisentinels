/**
 * POST /api/ghost/trigger
 *
 * Manually triggers the Ghost Sentinel Lambda.
 * Auth: X-Ghost-Trigger-Key header (compared to env GHOST_TRIGGER_KEY).
 * Body: { topicId?: string }
 * Returns: { invoked: true, requestId: string }
 */
import { NextResponse } from 'next/server';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const TRIGGER_KEY = process.env.GHOST_TRIGGER_KEY ?? '';
const LAMBDA_FN_NAME = process.env.GHOST_LAMBDA_NAME ?? 'aisentinels-ghost-prod';

export async function POST(request: Request) {
  try {
    // Auth check
    const authKey = request.headers.get('X-Ghost-Trigger-Key');
    if (!TRIGGER_KEY || authKey !== TRIGGER_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as { topicId?: string };

    const lambda = new LambdaClient({ region: 'us-east-1' });
    const payload = body.topicId
      ? { source: 'manual', topicId: body.topicId }
      : { source: 'manual', topicId: 'topic-ims-annex-sl-integration' };

    const command = new InvokeCommand({
      FunctionName: LAMBDA_FN_NAME,
      InvocationType: 'Event', // async — don't wait for completion
      Payload: Buffer.from(JSON.stringify(payload)),
    });

    const result = await lambda.send(command);

    return NextResponse.json({
      invoked: true,
      requestId: result.$metadata.requestId ?? 'unknown',
      statusCode: result.StatusCode,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
