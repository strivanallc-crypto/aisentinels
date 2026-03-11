import { NextResponse } from 'next/server';
import { Auth, raw, skipCSRFCheck, setEnvDefaults } from '@auth/core';
import Cognito from '@auth/core/providers/cognito';

/**
 * Diagnostic: reproduce the exact Auth.js signin flow and catch the real error.
 * DELETE THIS FILE once auth is working.
 */
export async function GET() {
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
    debug: true,
  };

  config.secret = process.env.AUTH_SECRET;
  config.basePath = '/api/auth';
  config.trustHost = true;

  setEnvDefaults(process.env as Record<string, string | undefined>, config, true);

  // Simulate the signin POST request
  const url = 'https://aisentinels.io/api/auth/signin/cognito?';
  const headers = new Headers();
  headers.set('host', 'aisentinels.io');
  headers.set('Content-Type', 'application/x-www-form-urlencoded');
  headers.set('x-forwarded-proto', 'https');
  const body = new URLSearchParams({ callbackUrl: '/dashboard' });
  const req = new Request(url, { method: 'POST', headers, body });

  try {
    const res = await Auth(req, { ...config, raw, skipCSRFCheck });
    if (res instanceof Response) {
      return NextResponse.json({
        result: 'Response object (masked error)',
        status: res.status,
        location: res.headers.get('Location'),
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawRes = res as any;
    return NextResponse.json({
      result: 'Raw response (SUCCESS)',
      redirect: rawRes.redirect,
      cookieCount: rawRes.cookies?.length,
      success: typeof rawRes.redirect === 'string' && rawRes.redirect.includes('oauth2/authorize'),
    });
  } catch (err: unknown) {
    return NextResponse.json({
      result: 'CAUGHT ERROR (thrown back by Auth raw mode)',
      errorType: (err as Error).constructor?.name ?? 'Unknown',
      errorMessage: (err as Error).message ?? String(err),
      errorStack: (err as Error).stack?.split('\n').slice(0, 8),
    }, { status: 500 });
  }
}
