# AI Sentinels SaaS Platform

## Stack
- Frontend: Next.js 14, Tailwind CSS, TipTap editor
- Backend: Node.js, Prisma ORM, Aurora Serverless v2, ElastiCache Redis
- Infrastructure: AWS CDK, AWS Amplify
- AI Engine: Gemini 2.5 Pro
- Auth: AWS Cognito + Google IdP Federation (Auth.js v5)
- Monorepo: pnpm workspaces + Turborepo

## AWS
- Account: 304242047817 | Region: us-east-1
- API: https://4w9qshl20f.execute-api.us-east-1.amazonaws.com
- Naming: {env}-{service}-{resource}

## Sentinels
- Qualy (9001, #3B82F6) — Quality Management
- Envi (14001, #22C55E) — Environmental
- Saffy (45001, #F59E0B) — Safety
- Doki (DocStudio, #6366F1) — Document Generation
- Audie (AuditRoom, #F43F5E) — Audit Planning
- Nexus (CAPA, #8B5CF6) — Corrective & Preventive Actions

## Auth (Critical — Read Before Touching)
- Auth.js v5 (next-auth beta.30) with Cognito provider
- lib/auth.ts uses explicit OAuth endpoints via COGNITO_DOMAIN (bypass OIDC discovery)
- Login: 'use client', signIn from next-auth/react (POST flow, not GET)
- GET /api/auth/signin/cognito returns "Configuration error" — this is EXPECTED
- For auth work, load skill: /cognito-auth
- Full flow documented in: docs/cognito-flow.md

## API Calls — JWT Required
```typescript
const session = await getSession();
headers: { Authorization: `Bearer ${session?.accessToken}` }
```
Missing JWT = 401 = "could not generate" errors in Doki/Audie/Nexus

## Build & Test
- `pnpm web:typecheck` — MUST exit 0 before every push
- `pnpm test` — Run all tests
- `pnpm build` — Full build

## Design System
- Fonts: Syne + DM Sans
- Accent: #c2fa69 (lime)
- Icons: SVG shields only — no mascots

## Critical Rules
- NEVER modify /src/sentinels/* without reading architecture first
- NEVER reintroduce ANY /api/v1/{proxy+} catch-all route
- NEVER reference ISO 27001/50001 in product
- NEVER use "unlimited" in sentinel feature descriptions
- NEVER use Lovable for this project
- One feature per prompt. Plan Mode (Shift+Tab x2) before every non-trivial task
- /compact at 70% context. /clear between unrelated tasks

## Skills (Load On Demand)
- `/cognito-auth` — OAuth/Cognito flow, debugging, known issues
- `/aws-deploy` — Amplify & CDK deployment procedures
- `/db-patterns` — Aurora RPC patterns, Prisma transactions
- `/sentinel-domain` — Sentinel architecture and API patterns
- `/test-strategy` — Test commands, coverage requirements, CI gates

## Reference Docs
- docs/claude-code-master-reference.md — Full prompting & efficiency guide
- docs/cognito-flow.md — Detailed OAuth/Cognito flow
- docs/db-patterns.md — RPC/atomic operation patterns
- docs/aws-architecture.md — AWS resource map and naming

## Forbidden Directories
- /node_modules, /.next, /coverage
