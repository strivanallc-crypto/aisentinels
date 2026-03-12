/**
 * Auth.js v5 (next-auth@5.0.0-beta.x) configuration.
 *
 * Exported from lib/ — NOT from the route file — so that `auth`, `signIn`,
 * `signOut` can be imported by server components and middleware without
 * polluting the Next.js route type checker (which only accepts HTTP method
 * exports from route files).
 *
 * Google sign-in is federated through Cognito (UserPoolIdentityProviderGoogle)
 * so only the Cognito provider is needed here — both email/password and Google
 * users get Cognito-issued JWTs that API Gateway can validate.
 *
 * NOTE: Explicit authorization/token/userinfo endpoints bypass OIDC discovery.
 * This avoids a runtime failure in the Amplify SSR Lambda where Next.js's
 * patched fetch() interferes with the well-known config request, causing
 * Auth.js to throw a masked "Configuration" error.
 *
 * TOKEN REFRESH: Cognito access tokens expire after 1 hour. When the JWT
 * callback detects an expired token, it uses the stored refresh_token to
 * obtain a new access/id token pair from Cognito's /oauth2/token endpoint.
 * If the refresh token is also expired (30 days in prod), the session is
 * marked with error="RefreshTokenExpired" so the frontend can force re-login.
 */
import NextAuth from 'next-auth';
import Cognito from 'next-auth/providers/cognito';

/** Cognito Hosted UI domain — set via COGNITO_DOMAIN env var. */
const cognitoDomain = process.env.COGNITO_DOMAIN!;
const clientId = process.env.COGNITO_CLIENT_ID!;
const clientSecret = process.env.COGNITO_CLIENT_SECRET ?? '';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Cognito({
      clientId,
      clientSecret,
      issuer:       process.env.COGNITO_ISSUER!,
      // Explicit endpoints bypass OIDC discovery (see header comment).
      authorization: {
        url: `https://${cognitoDomain}/oauth2/authorize`,
        params: { scope: 'openid email profile' },
      },
      token:    `https://${cognitoDomain}/oauth2/token`,
      userinfo: `https://${cognitoDomain}/oauth2/userInfo`,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        // First sign-in — persist Cognito tokens.
        // Both email/password and Google-federated users arrive here with
        // provider === 'cognito' because Google flows through Cognito's hosted UI.
        token.provider = account.provider;
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        return token;
      }

      // Subsequent requests — check if access token is still valid.
      if (typeof token.expiresAt === "number" && Date.now() < token.expiresAt * 1000) {
        return token;
      }

      // Access token expired — attempt refresh.
      if (!token.refreshToken) {
        token.error = 'RefreshTokenExpired';
        return token;
      }

      try {
        const params = new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          refresh_token: token.refreshToken as string,
        });
        if (clientSecret) {
          params.set('client_secret', clientSecret);
        }

        const response = await fetch(
          `https://${cognitoDomain}/oauth2/token`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? 'refresh_failed');
        }

        token.accessToken = data.access_token;
        token.idToken = data.id_token;
        // Cognito returns expires_in (seconds). Convert to epoch seconds.
        token.expiresAt = Math.floor(Date.now() / 1000) + (data.expires_in as number);
        // Cognito does not rotate refresh tokens — keep the existing one.
        delete token.error;
        return token;
      } catch {
        // Refresh failed — mark session so frontend can force re-login.
        token.error = 'RefreshTokenExpired';
        return token;
      }
    },
    session({ session, token }) {
      return {
        ...session,
        accessToken: token.accessToken as string | undefined,
        idToken: token.idToken as string | undefined,
        provider: token.provider as string | undefined,
        error: token.error as string | undefined,
      };
    },
  },
  pages: {
    signIn: '/login',
  },
});
