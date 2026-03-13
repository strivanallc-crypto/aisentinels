# AWS Deployment Procedures

## Environment
- Account ID: 304242047817
- Primary Region: us-east-1
- Profile: ai-sentinels-dev (use `aws --profile ai-sentinels-dev` prefix)
- Naming Convention: {env}-{service}-{resource} (e.g., dev-cognito-userpool)

## Amplify Deployment
- App URL: Check with `amplify status`
- Branch-based deployments: main -> production, dev -> staging

### Pre-Deploy Checklist
1. `pnpm web:typecheck` must exit 0
2. All tests passing
3. Environment variables verified in Amplify console
4. No uncommitted changes

### Deploy Commands
```bash
# Check current deployment state
amplify status

# Deploy to current branch environment
amplify push

# Verify deployment
amplify status
```

## Environment Variables (Amplify)
Critical env vars that must be set:
- `COGNITO_DOMAIN` — Cognito hosted UI domain
- `COGNITO_CLIENT_SECRET` — App client secret
- `NEXT_PUBLIC_BASE_URL` — Application base URL
- `NEXT_PUBLIC_COGNITO_CALLBACK` — OAuth callback URL
- API endpoint: https://4w9qshl20f.execute-api.us-east-1.amazonaws.com

## CDK Deployment (Infrastructure)
```bash
cd aisentinels-aws
npm install
npx cdk diff    # Always diff before deploy
npx cdk deploy  # Deploy stack changes
```

## Rollback Procedure
1. Check recent deployments in Amplify console
2. Use Amplify's built-in rollback to previous successful build
3. For CDK: `npx cdk diff` to understand current state before any changes
