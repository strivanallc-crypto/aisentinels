import { NextResponse, NextRequest } from 'next/server';
import { handlers } from '@/lib/auth';

/**
 * Diagnostic v6: Simulate the FULL client-side signIn flow.
 * 1. GET /api/auth/csrf → get CSRF token + cookie
 * 2. POST /api/auth/signin/cognito → with CSRF token + cookie
 * DELETE THIS FILE once auth is working.
 */
export async function GET() {
  const results: Record<string, unknown> = {};

  // ── Step 1: GET /api/auth/csrf ──
  let csrfToken = '';
  let cookieHeader = '';
  try {
    const csrfReq = new NextRequest('https://aisentinels.io/api/auth/csrf', {
      method: 'GET',
      headers: { host: 'aisentinels.io', 'x-forwarded-proto': 'https' },
    });
    const csrfRes = await handlers.GET(csrfReq);
    const csrfBody = await csrfRes.json();
    csrfToken = csrfBody.csrfToken ?? '';

    // Extract Set-Cookie header(s) to forward in next request
    const setCookies = csrfRes.headers.getSetCookie?.() ?? [];
    cookieHeader = setCookies.map((c: string) => c.split(';')[0]).join('; ');

    results.step1_csrf = {
      status: csrfRes.status,
      csrfToken: csrfToken ? `${csrfToken.substring(0, 20)}...` : 'EMPTY',
      setCookieCount: setCookies.length,
      cookieHeader: cookieHeader.substring(0, 100),
    };
  } catch (err: unknown) {
    results.step1_csrf = {
      error: (err as Error).message,
      type: (err as Error).constructor?.name,
    };
  }

  // ── Step 2: POST /api/auth/signin/cognito with CSRF token + cookie ──
  try {
    const body = new URLSearchParams({
      csrfToken,
      callbackUrl: 'https://aisentinels.io/dashboard',
    });
    const signInReq = new NextRequest(
      'https://aisentinels.io/api/auth/signin/cognito?',
      {
        method: 'POST',
        headers: {
          host: 'aisentinels.io',
          'x-forwarded-proto': 'https',
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Auth-Return-Redirect': '1',
          cookie: cookieHeader,
        },
        body,
      },
    );
    const signInRes = await handlers.POST(signInReq);
    const signInBody = await signInRes.text();
    let parsedBody: unknown;
    try { parsedBody = JSON.parse(signInBody); } catch { parsedBody = signInBody.substring(0, 300); }

    results.step2_signin = {
      status: signInRes.status,
      location: signInRes.headers.get('Location') ?? signInRes.headers.get('location'),
      body: parsedBody,
    };
  } catch (err: unknown) {
    results.step2_signin = {
      error: (err as Error).message,
      type: (err as Error).constructor?.name,
      stack: (err as Error).stack?.split('\n').slice(0, 6),
    };
  }

  // ── Step 3: Also test GET /api/auth/session (what useSession() calls) ──
  try {
    const sessionReq = new NextRequest('https://aisentinels.io/api/auth/session', {
      method: 'GET',
      headers: { host: 'aisentinels.io', 'x-forwarded-proto': 'https' },
    });
    const sessionRes = await handlers.GET(sessionReq);
    const sessionBody = await sessionRes.text();
    results.step3_session = {
      status: sessionRes.status,
      bodyPreview: sessionBody.substring(0, 200),
    };
  } catch (err: unknown) {
    results.step3_session = {
      error: (err as Error).message,
      type: (err as Error).constructor?.name,
    };
  }

  return NextResponse.json(results);
}
