import { NextResponse } from 'next/server';

/**
 * Temporary diagnostic endpoint to debug auth Configuration error.
 * Tests: env vars, OIDC discovery fetch, and provider config.
 * DELETE THIS FILE once auth is working.
 */
export async function GET() {
  const results: Record<string, unknown> = {};

  // 1. Check env vars
  results.envVars = {
    COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID ? 'SET (' + process.env.COGNITO_CLIENT_ID!.substring(0, 8) + '...)' : 'MISSING',
    COGNITO_CLIENT_SECRET: process.env.COGNITO_CLIENT_SECRET ? 'SET (length: ' + process.env.COGNITO_CLIENT_SECRET!.length + ')' : 'MISSING',
    COGNITO_ISSUER: process.env.COGNITO_ISSUER ?? 'MISSING',
    COGNITO_DOMAIN: process.env.COGNITO_DOMAIN ?? 'MISSING',
    AUTH_SECRET: process.env.AUTH_SECRET ? 'SET (length: ' + process.env.AUTH_SECRET!.length + ')' : 'MISSING',
    AUTH_URL: process.env.AUTH_URL ?? 'MISSING',
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST ?? 'MISSING',
    NODE_ENV: process.env.NODE_ENV ?? 'MISSING',
  };

  // 2. Test OIDC discovery fetch
  const issuer = process.env.COGNITO_ISSUER;
  if (issuer) {
    try {
      const wellKnownUrl = `${issuer}/.well-known/openid-configuration`;
      results.oidcDiscoveryUrl = wellKnownUrl;
      const startMs = Date.now();
      const resp = await fetch(wellKnownUrl, { cache: 'no-store' });
      const durationMs = Date.now() - startMs;
      results.oidcDiscoveryStatus = resp.status;
      results.oidcDiscoveryDurationMs = durationMs;
      if (resp.ok) {
        const config = await resp.json();
        results.oidcDiscoveryIssuer = config.issuer;
        results.oidcDiscoveryAuthEndpoint = config.authorization_endpoint;
        results.oidcDiscoveryTokenEndpoint = config.token_endpoint;
      } else {
        results.oidcDiscoveryError = `HTTP ${resp.status}`;
      }
    } catch (err: unknown) {
      results.oidcDiscoveryError = err instanceof Error ? err.message : String(err);
    }
  }

  // 3. Test Cognito domain endpoints
  const domain = process.env.COGNITO_DOMAIN;
  if (domain) {
    results.cognitoDomainUrls = {
      authorize: `https://${domain}/oauth2/authorize`,
      token: `https://${domain}/oauth2/token`,
      userinfo: `https://${domain}/oauth2/userInfo`,
    };
  }

  // 4. Check crypto.subtle availability
  results.cryptoSubtleAvailable = typeof globalThis.crypto?.subtle !== 'undefined';

  // 5. Node.js version
  results.nodeVersion = process.version;

  return NextResponse.json(results, { status: 200 });
}
