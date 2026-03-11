import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { handlers } from '@/lib/auth';
import { Auth, raw, skipCSRFCheck, setEnvDefaults } from '@auth/core';
import Cognito from '@auth/core/providers/cognito';

/**
 * Diagnostic: test multiple auth paths to find the failure.
 * DELETE THIS FILE once auth is working.
 */
export async function GET() {
  const results: Record<string, unknown> = {};

  // ── Test 1: Call the ACTUAL NextAuth GET handler (same path as route.ts) ──
  try {
    const testReq = new NextRequest('https://aisentinels.io/api/auth/signin/cognito', {
      method: 'GET',
      headers: {
        host: 'aisentinels.io',
        'x-forwarded-proto': 'https',
      },
    });
    const res = await handlers.GET(testReq);
    results.test1_handler_GET = {
      status: res.status,
      location: res.headers.get('Location') ?? res.headers.get('location'),
      ok: res.ok,
    };
  } catch (err: unknown) {
    results.test1_handler_GET = {
      error: (err as Error).message,
      type: (err as Error).constructor?.name,
      stack: (err as Error).stack?.split('\n').slice(0, 5),
    };
  }

  // ── Test 2: Call the ACTUAL handler as POST (simulates signIn server action) ──
  try {
    const testReq = new NextRequest('https://aisentinels.io/api/auth/signin/cognito?callbackUrl=/dashboard', {
      method: 'POST',
      headers: {
        host: 'aisentinels.io',
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-forwarded-proto': 'https',
      },
      body: new URLSearchParams({ callbackUrl: '/dashboard' }),
    });
    const res = await handlers.POST(testReq);
    results.test2_handler_POST = {
      status: res.status,
      location: res.headers.get('Location') ?? res.headers.get('location'),
      ok: res.ok,
    };
  } catch (err: unknown) {
    results.test2_handler_POST = {
      error: (err as Error).message,
      type: (err as Error).constructor?.name,
      stack: (err as Error).stack?.split('\n').slice(0, 5),
    };
  }

  // ── Test 3: Direct Auth() call (known working — control test) ──
  try {
    const cognitoDomain = process.env.COGNITO_DOMAIN!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = {
      providers: [
        Cognito({
          clientId:     process.env.COGNITO_CLIENT_ID!,
          clientSecret: process.env.COGNITO_CLIENT_SECRET ?? '',
          issuer:       process.env.COGNITO_ISSUER!,
          authorization: {
            url: `https://${cognitoDomain}/oauth2/authorize`,
            params: { scope: 'openid email profile' },
          },
          token:    `https://${cognitoDomain}/oauth2/token`,
          userinfo: `https://${cognitoDomain}/oauth2/userInfo`,
        }),
      ],
      pages: { signIn: '/login' },
      basePath: '/api/auth',
      secret: process.env.AUTH_SECRET,
      trustHost: true,
    };
    setEnvDefaults(process.env as Record<string, string | undefined>, config, true);

    const req = new Request('https://aisentinels.io/api/auth/signin/cognito?', {
      method: 'POST',
      headers: {
        host: 'aisentinels.io',
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-forwarded-proto': 'https',
      },
      body: new URLSearchParams({ callbackUrl: '/dashboard' }),
    });
    const res = await Auth(req, { ...config, raw, skipCSRFCheck });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawRes = res as any;
    results.test3_direct_Auth = {
      redirect: typeof rawRes.redirect === 'string' ? rawRes.redirect.substring(0, 120) + '...' : undefined,
      success: typeof rawRes.redirect === 'string' && rawRes.redirect.includes('oauth2/authorize'),
    };
  } catch (err: unknown) {
    results.test3_direct_Auth = {
      error: (err as Error).message,
      type: (err as Error).constructor?.name,
    };
  }

  return NextResponse.json(results);
}
