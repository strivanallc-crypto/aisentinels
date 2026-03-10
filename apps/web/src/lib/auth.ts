/**
 * Auth.js v5 (next-auth@5.0.0-beta.x) configuration.
 *
 * Exported from lib/ — NOT from the route file — so that `auth`, `signIn`,
 * `signOut` can be imported by server components and middleware without
 * polluting the Next.js route type checker (which only accepts HTTP method
 * exports from route files).
 */
import NextAuth from 'next-auth';
import Cognito from 'next-auth/providers/cognito';
import Google from 'next-auth/providers/google';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Cognito({
      clientId:     process.env.COGNITO_CLIENT_ID!,
      clientSecret: process.env.COGNITO_CLIENT_SECRET ?? '',
      issuer:       process.env.COGNITO_ISSUER!,
    }),
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    jwt({ token, account }) {
      if (account) {
        // First sign-in — persist provider and tokens.
        // Cognito access_token is the preferred Bearer token for API Gateway.
        // Cognito id_token also passes JWT validation (aud = client_id).
        // Google access_token is an opaque token — NOT valid for our API Gateway.
        token.provider = account.provider;

        if (account.provider === 'cognito') {
          token.accessToken = account.access_token;
          token.idToken = account.id_token;
        } else {
          // Google (or other providers): no Cognito token available.
          // Store id_token in case it can be used; clear accessToken to avoid
          // sending an opaque Google token to API Gateway.
          token.accessToken = undefined;
          token.idToken = account.id_token;
        }
      }
      return token;
    },
    session({ session, token }) {
      return {
        ...session,
        accessToken: token.accessToken as string | undefined,
        idToken: token.idToken as string | undefined,
        provider: token.provider as string | undefined,
      };
    },
  },
  pages: {
    signIn: '/login',
  },
});
