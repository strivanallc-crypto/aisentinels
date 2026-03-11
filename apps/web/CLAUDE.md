# AI Sentinels — Next.js Frontend
Stack: Next.js 14, Tailwind, TipTap, AWS Amplify, Cognito+NextAuth(Auth.js v5)
API: https://4w9qshl20f.execute-api.us-east-1.amazonaws.com
AWS: 304242047817 | us-east-1
Design: Syne+DM Sans fonts, #c2fa69 lime accent, SVG shield icons only
## Auth (DO NOT TOUCH without reading this)
- Auth.js v5 (next-auth beta.30) with Cognito provider
- lib/auth.ts uses explicit OAuth endpoints via COGNITO_DOMAIN env var (bypass OIDC discovery)
- Login page: 'use client', signIn from next-auth/react (POST flow, not GET)
- GET /api/auth/signin/cognito always returns Configuration error — this is expected/correct
- COGNITO_DOMAIN set in Amplify env vars — do not remove
## All API calls MUST include JWT
- Use: const session = await getSession(); headers: { Authorization: `Bearer ${session?.accessToken}` }
- Missing JWT = 401 = "could not generate" errors in Doki/Audie/Nexus
## Sentinels
Qualy(9001,#3B82F6) Envi(14001,#22C55E) Saffy(45001,#F59E0B)
Doki(DocStudio,#6366F1) Audie(AuditRoom,#F43F5E) Nexus(CAPA,#8B5CF6)
## Rules
- pnpm web:typecheck must exit 0 before every push
- One feature per prompt. Plan Mode (Shift+Tab x2) before every non-trivial task
- /compact at 70% context. /clear between unrelated tasks
- NEVER: ISO 27001/50001 in product, mascots, "unlimited", Lovable for this project
- NEVER reintroduce ANY /api/v1/{proxy+} catch-all route
