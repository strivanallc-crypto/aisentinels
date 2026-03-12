import type { NextConfig } from 'next';

// ── Security headers applied to all routes ────────────────────────────────────
// Next.js requires 'unsafe-inline' for Tailwind/CSS-in-JS styles and
// 'unsafe-eval' + 'unsafe-inline' for scripts due to hydration inlining.
// A nonce-based CSP is the ideal for production; this header set provides
// meaningful protection as a first hardening pass (E10).
const ContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  // Allow connections to the production domain, API Gateway, and Cognito
  "connect-src 'self' https://aisentinels.io https://www.aisentinels.io https://*.amazonaws.com https://cognito-idp.*.amazonaws.com https://*.execute-api.*.amazonaws.com https://*.lambda-url.*.on.aws",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  // Prevent clickjacking
  { key: 'X-Frame-Options',           value: 'DENY' },
  // Prevent MIME sniffing
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  // Legacy XSS protection (belt-and-suspenders with CSP)
  { key: 'X-XSS-Protection',          value: '1; mode=block' },
  // Control referrer information
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  // Restrict browser feature access
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  // Enforce HTTPS — 2 years, include subdomains, allow preload registration
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Content Security Policy
  { key: 'Content-Security-Policy',   value: ContentSecurityPolicy },
];

const nextConfig: NextConfig = {
  // Standalone output: bundles all runtime deps into .next/standalone/ so
  // Amplify WEB_COMPUTE can find them without relying on pnpm symlinks.
  output: 'standalone',
  // WEB_COMPUTE platform on Amplify handles Next.js SSR natively
  async headers() {
    return [
      {
        source:  '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
