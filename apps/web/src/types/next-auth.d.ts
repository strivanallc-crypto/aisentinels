// Auth.js v5 type augmentation — extends Session and JWT with provider tokens
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    /** Cognito access_token (preferred) — used as Bearer token for API Gateway */
    accessToken?: string;
    /** Cognito id_token (fallback) — also valid for API Gateway JWT authorizer */
    idToken?: string;
    /** OAuth provider that issued the session (e.g. 'cognito', 'google') */
    provider?: string;
    /** Set to "RefreshTokenExpired" when Cognito refresh fails — frontend should signOut */
    error?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    idToken?: string;
    refreshToken?: string;
    /** Epoch seconds when the access token expires */
    expiresAt?: number;
    provider?: string;
    /** Set to "RefreshTokenExpired" when Cognito refresh fails */
    error?: string;
  }
}
