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

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Cognito({
      clientId:     process.env.COGNITO_CLIENT_ID!,
      clientSecret: process.env.COGNITO_CLIENT_SECRET ?? '',
      issuer:       process.env.COGNITO_ISSUER!,
    }),
  ],
  callbacks: {
    jwt({ token, account }) {
      // Persist the Cognito access_token so the API client can attach it as Bearer
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    session({ session, token }) {
      return { ...session, accessToken: token.accessToken as string | undefined };
    },
  },
  pages: {
    signIn: '/login',
  },
});
