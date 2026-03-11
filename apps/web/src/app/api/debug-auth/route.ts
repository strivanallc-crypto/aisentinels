import { NextResponse } from 'next/server';
import { Auth, raw, skipCSRFCheck, setEnvDefaults } from '@auth/core';
import Cognito from '@auth/core/providers/cognito';

/**
 * Diagnostic v5: Why does GET fail but POST succeeds?
 * DELETE THIS FILE once auth is working.
 */
export async function GET() {
  const results: Record<string, unknown> = {};
  const cognitoDomain = process.env.COGNITO_DOMAIN!;

  function makeFreshConfig() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg: any = {
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
    setEnvDefaults(process.env as Record<string, string | undefined>, cfg, true);
    return cfg;
  }

  // ── Test A: GET + raw + skipCSRF (does raw mode change the GET behavior?) ──
  try {
    const cfg = makeFreshConfig();
    const req = new Request('https://aisentinels.io/api/auth/signin/cognito', {
      method: 'GET',
      headers: { host: 'aisentinels.io', 'x-forwarded-proto': 'https' },
    });
    const res = await Auth(req, { ...cfg, raw, skipCSRFCheck });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawRes = res as any;
    results.testA_GET_raw = {
      redirect: rawRes.redirect,
      status: rawRes.status,
      cookies: rawRes.cookies?.length,
      headers: rawRes.headers ? Object.fromEntries(
        Object.entries(rawRes.headers).map(([k, v]) => [k, String(v).substring(0, 100)])
      ) : undefined,
      body: typeof rawRes.body === 'string' ? rawRes.body.substring(0, 200) : typeof rawRes.body,
    };
  } catch (err: unknown) {
    results.testA_GET_raw = {
      error: (err as Error).message,
      type: (err as Error).constructor?.name,
      stack: (err as Error).stack?.split('\n').slice(0, 8),
    };
  }

  // ── Test B: GET without raw/skipCSRF — as a Response object ──
  try {
    const cfg = makeFreshConfig();
    const req = new Request('https://aisentinels.io/api/auth/signin/cognito', {
      method: 'GET',
      headers: { host: 'aisentinels.io', 'x-forwarded-proto': 'https' },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (Auth as any)(req, cfg) as Response;
    results.testB_GET_noRaw = {
      status: res.status,
      location: res.headers?.get?.('Location') ?? res.headers?.get?.('location'),
      contentType: res.headers?.get?.('content-type'),
    };
  } catch (err: unknown) {
    results.testB_GET_noRaw = {
      error: (err as Error).message,
      type: (err as Error).constructor?.name,
      stack: (err as Error).stack?.split('\n').slice(0, 8),
    };
  }

  // ── Test C: POST without raw/skipCSRF (same as handler.POST path) ──
  try {
    const cfg = makeFreshConfig();
    const req = new Request('https://aisentinels.io/api/auth/signin/cognito?', {
      method: 'POST',
      headers: {
        host: 'aisentinels.io',
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-forwarded-proto': 'https',
      },
      body: new URLSearchParams({ callbackUrl: '/dashboard' }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (Auth as any)(req, cfg) as Response;
    results.testC_POST_noRaw = {
      status: res.status,
      location: res.headers?.get?.('Location') ?? res.headers?.get?.('location'),
    };
  } catch (err: unknown) {
    results.testC_POST_noRaw = {
      error: (err as Error).message,
      type: (err as Error).constructor?.name,
    };
  }

  // ── Test D: GET /api/auth/signin (no provider) ──
  try {
    const cfg = makeFreshConfig();
    const req = new Request('https://aisentinels.io/api/auth/signin', {
      method: 'GET',
      headers: { host: 'aisentinels.io', 'x-forwarded-proto': 'https' },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (Auth as any)(req, cfg) as Response;
    results.testD_GET_signin = {
      status: res.status,
      location: res.headers?.get?.('Location') ?? res.headers?.get?.('location'),
    };
  } catch (err: unknown) {
    results.testD_GET_signin = {
      error: (err as Error).message,
      type: (err as Error).constructor?.name,
    };
  }

  // ── Test E: GET /api/auth/providers ──
  try {
    const cfg = makeFreshConfig();
    const req = new Request('https://aisentinels.io/api/auth/providers', {
      method: 'GET',
      headers: { host: 'aisentinels.io', 'x-forwarded-proto': 'https' },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (Auth as any)(req, cfg) as Response;
    const body = await res.text();
    results.testE_providers = {
      status: res.status,
      body: body.substring(0, 300),
    };
  } catch (err: unknown) {
    results.testE_providers = {
      error: (err as Error).message,
      type: (err as Error).constructor?.name,
    };
  }

  return NextResponse.json(results);
}
