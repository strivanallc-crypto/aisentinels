/**
 * TEMPORARY diagnostic endpoint — DELETE after debugging auth issue.
 * Reports which auth-related env vars are present (NOT their values).
 */
import { NextResponse } from 'next/server';

export async function GET() {
  const vars = [
    'AUTH_SECRET',
    'AUTH_TRUST_HOST',
    'AUTH_URL',
    'COGNITO_CLIENT_ID',
    'COGNITO_CLIENT_SECRET',
    'COGNITO_ISSUER',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
    'NEXT_PUBLIC_API_URL',
    'NEXT_PUBLIC_AWS_REGION',
    'NODE_ENV',
  ];

  const result: Record<string, string> = {};
  for (const v of vars) {
    const val = process.env[v];
    if (val === undefined) {
      result[v] = '❌ MISSING';
    } else if (val === '') {
      result[v] = '⚠️ EMPTY';
    } else {
      // Show length + first 3 chars for non-sensitive, just length for sensitive
      const sensitive = ['AUTH_SECRET', 'COGNITO_CLIENT_SECRET', 'NEXTAUTH_SECRET'];
      result[v] = sensitive.includes(v)
        ? `✅ SET (${val.length} chars)`
        : `✅ SET (${val.length} chars, starts: ${val.substring(0, 8)}…)`;
    }
  }

  // Also try importing auth to see if it throws
  let authImportStatus = 'unknown';
  try {
    // Dynamic import to catch initialization errors
    const authModule = await import('@/lib/auth');
    authImportStatus = typeof authModule.auth === 'function' ? '✅ auth function exists' : '⚠️ auth is falsy';
  } catch (err: unknown) {
    authImportStatus = `❌ IMPORT ERROR: ${err instanceof Error ? err.message : String(err)}`;
  }

  return NextResponse.json({
    envVars: result,
    authImportStatus,
    nodeVersion: process.version,
    platform: process.platform,
    timestamp: new Date().toISOString(),
  });
}
