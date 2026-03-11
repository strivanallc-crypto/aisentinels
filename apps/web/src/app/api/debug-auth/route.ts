import { NextResponse, NextRequest } from 'next/server';
import { handlers } from '@/lib/auth';
import { Auth, raw, skipCSRFCheck, setEnvDefaults } from '@auth/core';
import Cognito from '@auth/core/providers/cognito';

/**
 * Inline copy of next-auth/lib/env.js reqWithEnvURL
 */
function reqWithEnvURL(req: NextRequest): NextRequest {
  const url = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (!url) return req;
  const { origin: envOrigin } = new URL(url);
  const { href, origin } = req.nextUrl;
  return new NextRequest(href.replace(origin, envOrigin), req);
}

/**
 * Diagnostic v4: isolate whether the problem is reqWithEnvURL or the config.
 * DELETE THIS FILE once auth is working.
 */
export async function GET() {
  const results: Record<string, unknown> = {};
  const cognitoDomain = process.env.COGNITO_DOMAIN!;

  // ── Build fresh config (known working) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const freshConfig: any = {
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
  setEnvDefaults(process.env as Record<string, string | undefined>, freshConfig, true);

  // ── Test A: Inspect what reqWithEnvURL does to the request ──
  try {
    const testReq = new NextRequest('https://aisentinels.io/api/auth/signin/cognito', {
      method: 'GET',
      headers: { host: 'aisentinels.io', 'x-forwarded-proto': 'https' },
    });
    const modified = reqWithEnvURL(testReq);
    results.testA_reqWithEnvURL = {
      originalUrl: testReq.url,
      originalNextUrl: testReq.nextUrl?.href,
      modifiedUrl: modified.url,
      modifiedNextUrl: modified.nextUrl?.href,
    };
  } catch (err: unknown) {
    results.testA_reqWithEnvURL = {
      error: (err as Error).message,
      type: (err as Error).constructor?.name,
    };
  }

  // ── Test B: Auth() with reqWithEnvURL-modified request + FRESH config + raw/skipCSRF ──
  try {
    const testReq = new NextRequest('https://aisentinels.io/api/auth/signin/cognito?', {
      method: 'POST',
      headers: {
        host: 'aisentinels.io',
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-forwarded-proto': 'https',
      },
      body: new URLSearchParams({ callbackUrl: '/dashboard' }),
    });
    const modified = reqWithEnvURL(testReq);
    results.testB_modifiedUrl = modified.url;
    const res = await Auth(modified, { ...freshConfig, raw, skipCSRFCheck });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawRes = res as any;
    results.testB_reqWithEnvURL_freshConfig = {
      redirect: typeof rawRes.redirect === 'string' ? rawRes.redirect.substring(0, 80) + '...' : undefined,
      success: typeof rawRes.redirect === 'string' && rawRes.redirect.includes('oauth2/authorize'),
    };
  } catch (err: unknown) {
    results.testB_reqWithEnvURL_freshConfig = {
      error: (err as Error).message,
      type: (err as Error).constructor?.name,
      stack: (err as Error).stack?.split('\n').slice(0, 5),
    };
  }

  // ── Test C: Auth() with reqWithEnvURL-modified GET request + FRESH config (no raw/skipCSRF) ──
  // This is EXACTLY what the actual handler.GET does (minus the shared config object)
  try {
    const testReq = new NextRequest('https://aisentinels.io/api/auth/signin/cognito', {
      method: 'GET',
      headers: { host: 'aisentinels.io', 'x-forwarded-proto': 'https' },
    });
    const modified = reqWithEnvURL(testReq);
    const res = await Auth(modified, freshConfig);
    if (res instanceof Response) {
      results.testC_GET_freshConfig = {
        status: res.status,
        location: res.headers.get('Location') ?? res.headers.get('location'),
      };
    }
  } catch (err: unknown) {
    results.testC_GET_freshConfig = {
      error: (err as Error).message,
      type: (err as Error).constructor?.name,
      stack: (err as Error).stack?.split('\n').slice(0, 5),
    };
  }

  // ── Test D: handler GET (control — expected to fail) ──
  try {
    const testReq = new NextRequest('https://aisentinels.io/api/auth/signin/cognito', {
      method: 'GET',
      headers: { host: 'aisentinels.io', 'x-forwarded-proto': 'https' },
    });
    const res = await handlers.GET(testReq);
    results.testD_handler_GET = {
      status: res.status,
      location: res.headers.get('Location') ?? res.headers.get('location'),
    };
  } catch (err: unknown) {
    results.testD_handler_GET = {
      error: (err as Error).message,
      type: (err as Error).constructor?.name,
    };
  }

  return NextResponse.json(results);
}
