/**
 * Server Component layout for authenticated (app) routes.
 *
 * `cookies()` opts this subtree into dynamic rendering so Next.js never
 * emits s-maxage=31536000 (1-year CDN cache) for auth-protected pages.
 * Without this, CloudFront serves stale HTML from a previous build.
 */
import { cookies } from 'next/headers';
import { AppLayoutClient } from './layout-client';

export const dynamic = 'force-dynamic';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Reading cookies forces SSR on every request — critical for auth pages
  await cookies();

  return <AppLayoutClient>{children}</AppLayoutClient>;
}
