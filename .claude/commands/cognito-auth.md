# Cognito Authentication Patterns

## User Pool Configuration
- Pool ID: us-east-1_XXXXX (replace with actual)
- App Client ID: YYYYY (replace with actual)
- Cognito Domain: Set via COGNITO_DOMAIN env var
- Callback URL: ${NEXT_PUBLIC_BASE_URL}/auth/callback

## Tech Stack
- Auth.js v5 (next-auth beta.30) with Cognito provider
- lib/auth.ts uses explicit OAuth endpoints via COGNITO_DOMAIN env var (bypass OIDC discovery)
- Login page: 'use client', signIn from next-auth/react (POST flow, not GET)
- GET /api/auth/signin/cognito always returns Configuration error — this is expected/correct

## Google IdP Federation Flow
1. User clicks 'Sign in with Google'
2. Redirect to Cognito hosted UI with identity_provider=Google
3. Cognito handles Google OAuth exchange
4. Cognito issues authorization code to callback URL
5. Backend exchanges code for tokens at /oauth2/token endpoint
6. Store access_token in httpOnly cookie via Auth.js session

## Debugging Checklist
Run these checks in order using the aws CLI:

```bash
# 1. Verify callback URLs in app client config
aws cognito-idp describe-user-pool-client \
  --user-pool-id [POOL_ID] --client-id [CLIENT_ID] \
  --query 'UserPoolClient.CallbackURLs'

# 2. Confirm Google IdP is enabled
aws cognito-idp list-identity-providers \
  --user-pool-id [POOL_ID]

# 3. Check env vars
echo $COGNITO_CLIENT_SECRET
echo $NEXT_PUBLIC_COGNITO_DOMAIN
echo $COGNITO_DOMAIN

# 4. Test token exchange manually
curl -X POST https://${COGNITO_DOMAIN}/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=[CODE]&client_id=[CLIENT_ID]&redirect_uri=[CALLBACK_URL]"
```

## Known Issues
- **invalid_grant**: Usually means callback URL mismatch in app client config, or code already used
- **401 on /oauth2/token**: Check client_id and client_secret in env vars
- **Configuration error on GET /api/auth/signin/cognito**: This is EXPECTED — login uses POST flow
- **"could not generate" errors in Doki/Audie/Nexus**: Missing JWT in API calls — check session.accessToken

## Critical Rules
- COGNITO_DOMAIN must be set in Amplify env vars — do not remove
- All API calls MUST include JWT: `Authorization: Bearer ${session?.accessToken}`
- Do NOT switch to GET-based signIn flow — POST is intentional
