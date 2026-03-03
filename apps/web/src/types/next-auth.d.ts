// Auth.js v5 type augmentation — extends Session and JWT with Cognito access_token
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    /** Cognito access_token forwarded by the jwt callback for API Bearer auth */
    accessToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
  }
}
