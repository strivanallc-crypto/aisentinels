/**
 * Next.js Route Handler for NextAuth.
 *
 * IMPORTANT: Only HTTP method names (GET, POST, …) may be exported from
 * Next.js route files. All NextAuth config lives in lib/auth.ts so that
 * `auth`, `signIn`, `signOut` can be imported by server components and
 * middleware without polluting the route type checker.
 */
import { handlers } from '@/lib/auth';

// Force request-time evaluation so server-side env vars (COGNITO_DOMAIN,
// COGNITO_CLIENT_SECRET, etc.) are read from the Lambda environment rather
// than baked in during the static build phase.
export const dynamic = 'force-dynamic';

export const { GET, POST } = handlers;
