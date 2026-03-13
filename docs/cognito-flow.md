# Cognito + Google IdP Authentication Flow

## Overview
AI Sentinels uses AWS Cognito with Google Identity Provider federation, managed through Auth.js v5 (next-auth beta.30).

## Architecture

```
User -> Login Page (POST signIn) -> Cognito Hosted UI -> Google OAuth
                                                              |
                                                    Google auth code
                                                              |
                                         Cognito exchanges code for Google tokens
                                                              |
                                         Cognito issues authorization code
                                                              |
                                    Callback URL (/auth/callback)
                                                              |
                                    Auth.js exchanges code at /oauth2/token
                                                              |
                                    Session created with access_token
                                                              |
                                    JWT stored in httpOnly cookie
```

## Key Implementation Details

### Login Page
- Uses `'use client'` directive
- Calls `signIn` from `next-auth/react` (POST method, not GET)
- GET `/api/auth/signin/cognito` always returns "Configuration error" — this is expected and correct

### Auth Configuration (lib/auth.ts)
- Uses explicit OAuth endpoints via `COGNITO_DOMAIN` env var
- Bypasses OIDC discovery (which can be unreliable with Cognito)
- Token endpoint: `https://${COGNITO_DOMAIN}/oauth2/token`
- Authorization endpoint: `https://${COGNITO_DOMAIN}/oauth2/authorize`

### Environment Variables
| Variable | Purpose |
|----------|---------|
| `COGNITO_DOMAIN` | Cognito hosted UI domain (set in Amplify) |
| `COGNITO_CLIENT_SECRET` | App client secret |
| `NEXT_PUBLIC_BASE_URL` | Application base URL for callbacks |
| `NEXT_PUBLIC_COGNITO_CALLBACK` | OAuth callback URL |

### Session & JWT
- All API calls to sentinels MUST include JWT
- Pattern: `Authorization: Bearer ${session?.accessToken}`
- Missing JWT causes 401 errors that surface as "could not generate" in Doki/Audie/Nexus

## Common Issues

| Error | Cause | Fix |
|-------|-------|-----|
| `invalid_grant` | Callback URL mismatch or code reuse | Verify CallbackURLs in Cognito app client config |
| `401 on /oauth2/token` | Wrong client_id or client_secret | Check env vars match Cognito console |
| "Configuration error" on GET signin | Normal behavior | This is expected — login uses POST flow |
| "could not generate" in sentinels | Missing JWT in API call | Ensure `session?.accessToken` is passed in Authorization header |

## AWS Resources
- User Pool: us-east-1_XXXXX (replace with actual pool ID)
- App Client: YYYYY (replace with actual client ID)
- Account: 304242047817
- Region: us-east-1
