/**
 * Approval Token Utility — short-lived JWTs for email-based approve/reject.
 *
 * Tokens are signed with a symmetric secret stored in SSM:
 *   /aisentinels/{env}/auth/approval-token-secret
 *
 * This avoids requiring the user to log into the app to approve a document.
 * Token payload includes documentId, approverId, tenantId, and action.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ApprovalTokenPayload {
  documentId: string;
  approverId: string;  // Cognito sub
  tenantId: string;
  action: 'approve' | 'reject';
  exp: number;         // Unix timestamp (seconds)
  iat: number;         // Unix timestamp (seconds)
}

// ── SSM Secret Caching ──────────────────────────────────────────────────────

const ssmClient = new SSMClient({});
let cachedSecret: string | null = null;
let cachedSecretExpiry = 0;
const SECRET_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getSecret(): Promise<string> {
  const now = Date.now();
  if (cachedSecret && now < cachedSecretExpiry) {
    return cachedSecret;
  }

  const ssmPath = process.env.APPROVAL_TOKEN_SECRET_SSM_PATH
    ?? '/aisentinels/prod/auth/approval-token-secret';

  const result = await ssmClient.send(new GetParameterCommand({
    Name: ssmPath,
    WithDecryption: true,
  }));

  const secret = result.Parameter?.Value;
  if (!secret) {
    throw new Error(`Approval token secret not found at SSM path: ${ssmPath}`);
  }

  cachedSecret = secret;
  cachedSecretExpiry = now + SECRET_CACHE_TTL_MS;
  return secret;
}

// ── Base64url helpers ───────────────────────────────────────────────────────

function base64urlEncode(data: string): string {
  return Buffer.from(data, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(data: string): string {
  const padded = data + '='.repeat((4 - (data.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

// ── Token Generation ────────────────────────────────────────────────────────

function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)(h|m|d)$/);
  if (!match) return 48 * 3600; // default 48h
  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;
  switch (unit) {
    case 'h': return value * 3600;
    case 'm': return value * 60;
    case 'd': return value * 86400;
    default:  return 48 * 3600;
  }
}

/**
 * Generate a signed approval token (HMAC-SHA256 JWT-like structure).
 */
export async function generateApprovalToken(payload: {
  documentId: string;
  approverId: string;
  tenantId: string;
  action: 'approve' | 'reject';
  expiresIn?: string;  // default '48h'
}): Promise<string> {
  const secret = await getSecret();
  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = parseExpiresIn(payload.expiresIn ?? '48h');

  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'APT' }));
  const body = base64urlEncode(JSON.stringify({
    documentId: payload.documentId,
    approverId: payload.approverId,
    tenantId: payload.tenantId,
    action: payload.action,
    iat: now,
    exp: now + ttlSeconds,
  } satisfies ApprovalTokenPayload));

  const signature = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${header}.${body}.${signature}`;
}

/**
 * Verify an approval token. Returns the payload if valid, null otherwise.
 * Never throws — returns null on expired or invalid tokens.
 */
export async function verifyApprovalToken(token: string): Promise<ApprovalTokenPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, sig] = parts as [string, string, string];
    const secret = await getSecret();

    // Recompute signature
    const expectedSig = createHmac('sha256', secret)
      .update(`${header}.${body}`)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Timing-safe comparison
    const sigBuf = Buffer.from(sig, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    // Decode payload
    const payload = JSON.parse(base64urlDecode(body)) as ApprovalTokenPayload;

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

    // Validate required fields
    if (!payload.documentId || !payload.approverId || !payload.tenantId || !payload.action) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
