/**
 * Next.js Route Handler for NextAuth.
 *
 * IMPORTANT: Only HTTP method names (GET, POST, …) may be exported from
 * Next.js route files. All NextAuth config lives in lib/auth.ts so that
 * `auth`, `signIn`, `signOut` can be imported by server components and
 * middleware without polluting the route type checker.
 */
import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
