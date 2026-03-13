# AWS Architecture — AI Sentinels

## Account & Region
- Account ID: 304242047817
- Primary Region: us-east-1
- Naming Convention: {env}-{service}-{resource}

## Service Map

### Compute & Application
- **AWS Amplify**: Frontend hosting (Next.js 14), branch-based deployments
- **API Gateway**: https://4w9qshl20f.execute-api.us-east-1.amazonaws.com
- **Lambda**: Backend API handlers (via CDK in aisentinels-aws/)

### Data
- **Aurora Serverless v2**: PostgreSQL-compatible, primary database
- **ElastiCache Redis**: Session caching, frequently-read data

### Auth
- **Cognito User Pool**: Federated identity with Google IdP
- **Auth.js v5**: Frontend session management

### Infrastructure as Code
- **AWS CDK**: All infrastructure defined in `aisentinels-aws/lib/`
- **CDK Outputs**: `aisentinels-aws/cdk-outputs.json`

## CDK Structure
```
aisentinels-aws/
  bin/          — CDK app entry point
  lib/          — Stack definitions
  infra/        — Infrastructure configs
  cdk.json      — CDK configuration
```

## CLI Usage
```bash
# Always use the project profile
aws --profile ai-sentinels-dev [command]

# Check Cognito config
aws cognito-idp describe-user-pool --user-pool-id [POOL_ID]

# Check Amplify status
amplify status

# CDK operations
cd aisentinels-aws && npx cdk diff && npx cdk deploy
```
