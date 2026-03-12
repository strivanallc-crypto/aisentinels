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
      if (account) {
        // First sign-in — persist Cognito tokens.
        // Both email/password and Google-federated users arrive here with
        // provider === 'cognito' because Google flows through Cognito's hosted UI.
        token.provider = account.provider;
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
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
