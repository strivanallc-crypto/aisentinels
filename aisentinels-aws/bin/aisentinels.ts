#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../infra/cdk/stacks/NetworkStack';
import { SecurityStack } from '../infra/cdk/stacks/SecurityStack';
import { StorageReplicationStack } from '../infra/cdk/stacks/StorageReplicationStack';
import { StorageStack } from '../infra/cdk/stacks/StorageStack';
import { DataStack } from '../infra/cdk/stacks/DataStack';
import { CognitoStack } from '../infra/cdk/stacks/CognitoStack';
import { ApiStack } from '../infra/cdk/stacks/ApiStack';
import { ComputeStack } from '../infra/cdk/stacks/ComputeStack';
import { SearchStack } from '../infra/cdk/stacks/SearchStack';
import { AmplifyStack } from '../infra/cdk/stacks/AmplifyStack';
import { ObservabilityStack } from '../infra/cdk/stacks/ObservabilityStack';

const app = new cdk.App();

// ── Resolve target environment ─────────────────────────────────────────────
const account = process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_ACCOUNT_ID;
const region = process.env.CDK_DEFAULT_REGION ?? 'us-east-1';
const envName = (process.env.ENV_NAME ?? 'prod') as 'dev' | 'staging' | 'prod';

if (!account) {
  throw new Error(
    'AWS account ID is not set.\n' +
      'Run: export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)',
  );
}

const env: cdk.Environment = { account, region };
const envTitle = envName.charAt(0).toUpperCase() + envName.slice(1);
const vpcCidr =
  envName === 'prod' ? '10.0.0.0/16' : envName === 'staging' ? '10.1.0.0/16' : '10.2.0.0/16';

const commonProps = {
  env,
  envName,
  terminationProtection: envName === 'prod',
  tags: { project: 'aisentinels', env: envName },
};

// ════════════════════════════════════════════════════════════════════════════
// E1.1 — NetworkStack
// ════════════════════════════════════════════════════════════════════════════
const networkStack = new NetworkStack(app, `AiSentinels-Network-${envTitle}`, {
  ...commonProps,
  vpcCidr,
  description: `AI Sentinels — Network Foundation [${envName}] (VPC · Subnets · Endpoints · SGs)`,
});

// ════════════════════════════════════════════════════════════════════════════
// E1.2 — SecurityStack
// ════════════════════════════════════════════════════════════════════════════
const securityStack = new SecurityStack(app, `AiSentinels-Security-${envTitle}`, {
  ...commonProps,
  description: `AI Sentinels — Security Foundation [${envName}] (KMS · CloudTrail · GuardDuty · SecurityHub · IAM Boundary)`,
});

// ════════════════════════════════════════════════════════════════════════════
// E1.3a — StorageReplicationStack (eu-west-1 CRR destination — deploy first)
// ════════════════════════════════════════════════════════════════════════════
new StorageReplicationStack(app, `AiSentinels-Storage-Replication-${envTitle}`, {
  env: { account, region: 'eu-west-1' },
  envName,
  terminationProtection: envName === 'prod',
  tags: { project: 'aisentinels', env: envName },
  description: `AI Sentinels — CRR Destination [${envName}] (eu-west-1 compliance bucket)`,
});

// ════════════════════════════════════════════════════════════════════════════
// E1.3b — StorageStack (compliance, working-files, exports, logs)
// Depends on SecurityStack for auroraKey
// ════════════════════════════════════════════════════════════════════════════
const storageStack = new StorageStack(app, `AiSentinels-Storage-${envTitle}`, {
  ...commonProps,
  auroraKey: securityStack.auroraKey,
  description: `AI Sentinels — Storage Foundation [${envName}] (Compliance · Working Files · Exports · Logs)`,
});

// ════════════════════════════════════════════════════════════════════════════
// E1.4 — DataStack (Aurora, RDS Proxy, DynamoDB, Redis)
// Depends on NetworkStack (VPC + SGs) and SecurityStack (KMS keys)
// ════════════════════════════════════════════════════════════════════════════
const dataStack = new DataStack(app, `AiSentinels-Data-${envTitle}`, {
  ...commonProps,
  vpc: networkStack.vpc,
  sgFargate: networkStack.sgFargate,
  sgLambda: networkStack.sgLambda,
  auroraKey: securityStack.auroraKey,
  dynamoDbKey: securityStack.dynamoDbKey,
  description: `AI Sentinels — Data Foundation [${envName}] (Aurora · RDS Proxy · DynamoDB · Redis)`,
});

// ════════════════════════════════════════════════════════════════════════════
// E1.5 — CognitoStack (User Pool, MFA, App Clients, Trigger Lambdas)
// No cross-stack dependencies — standalone
// ════════════════════════════════════════════════════════════════════════════
const cognitoStack = new CognitoStack(app, `AiSentinels-Cognito-${envTitle}`, {
  ...commonProps,
  description: `AI Sentinels — Auth Foundation [${envName}] (Cognito User Pool · MFA · App Clients · Trigger Lambdas)`,
});

// ════════════════════════════════════════════════════════════════════════════
// E5 — SearchStack — SKIPPED (cost-optimized: $23/day AOSS minimum at idle)
// Deploy later when AI/RAG features are needed.
// ════════════════════════════════════════════════════════════════════════════
// const searchStack = new SearchStack(app, `AiSentinels-Search-${envTitle}`, {
//   ...commonProps,
//   vpc: networkStack.vpc,
//   appSubnets: networkStack.appSubnets,
//   sgFargate: networkStack.sgFargate,
//   description: `AI Sentinels — Search [${envName}] (AOSS · Vector k-NN · VPC Endpoint)`,
// });
// searchStack.addDependency(networkStack);

// ════════════════════════════════════════════════════════════════════════════
// E4 — ComputeStack (ECS Fargate · Internal ALB · ECR · VpcLink)
// Depends on NetworkStack, SecurityStack, DataStack, StorageStack
// (SearchStack dependency removed — AOSS not deployed yet)
// ════════════════════════════════════════════════════════════════════════════
const computeStack = new ComputeStack(app, `AiSentinels-Compute-${envTitle}`, {
  ...commonProps,
  vpc: networkStack.vpc,
  appSubnets: networkStack.appSubnets,
  sgAlb: networkStack.sgAlb,
  sgFargate: networkStack.sgFargate,
  sgLambda: networkStack.sgLambda,
  sgAurora: dataStack.sgAurora,
  permissionBoundary: securityStack.permissionBoundary,
  auroraProxyEndpoint: dataStack.auroraProxy.endpoint,
  auditEventsTableArn: dataStack.auditEventsTable.tableArn,
  sessionsTableArn: dataStack.sessionsTable.tableArn,
  workingFilesBucketArn: storageStack.workingFilesBucket.bucketArn,
  complianceBucketArn: storageStack.complianceBucket.bucketArn,
  // aossCollectionEndpoint omitted — SearchStack not deployed (cost-optimized)
  description: `AI Sentinels — Compute [${envName}] (ECS Fargate · ALB · ECR · VpcLink)`,
});
computeStack.addDependency(dataStack);
computeStack.addDependency(storageStack);

// ════════════════════════════════════════════════════════════════════════════
// E3 — ApiStack (HTTP API Gateway, JWT Authorizer, Lambda Handlers)
// Depends on CognitoStack (JWT issuer + audience), DataStack (Aurora, DynamoDB),
// and ComputeStack (ALB listener + VpcLink for /api/v1/* domain routes)
// ════════════════════════════════════════════════════════════════════════════
const apiStack = new ApiStack(app, `AiSentinels-Api-${envTitle}`, {
  ...commonProps,
  vpc: networkStack.vpc,
  appSubnets: networkStack.appSubnets,
  sgLambda: networkStack.sgLambda,
  userPoolId: cognitoStack.userPool.userPoolId,
  userPoolArn: cognitoStack.userPool.userPoolArn,
  webClientId: cognitoStack.webAppClient.userPoolClientId,
  nextAuthClientId: '2osgds469cgdss3facqigvr7b7', // aisentinels-web-nextauth (created outside CDK for NextAuth server-side auth)
  auroraProxyEndpoint: dataStack.auroraProxy.endpoint,
  auditEventsTableArn: dataStack.auditEventsTable.tableArn,
  albListener: computeStack.albListener,
  vpcLink: computeStack.vpcLink,
  description: `AI Sentinels — API Gateway [${envName}] (HTTP API · JWT Auth · Tenant Provision · VpcLink)`,
});
apiStack.addDependency(cognitoStack);
apiStack.addDependency(dataStack);
apiStack.addDependency(computeStack);

// ════════════════════════════════════════════════════════════════════════════
// E6 — AmplifyStack (Next.js SSR · GitHub CI/CD · Custom Domain)
// Depends on ApiStack (API endpoint SSM) and CognitoStack (user pool SSM)
// ════════════════════════════════════════════════════════════════════════════
const amplifyStack = new AmplifyStack(app, `AiSentinels-Amplify-${envTitle}`, {
  ...commonProps,
  envName,
  description: `AI Sentinels — Amplify Hosting [${envName}] (Next.js SSR · GitHub CI/CD · Auto-deploy)`,
});
amplifyStack.addDependency(apiStack);
amplifyStack.addDependency(cognitoStack);

// ════════════════════════════════════════════════════════════════════════════
// E9 — ObservabilityStack — SKIPPED (deploy later, nice-to-have pre-launch)
// ════════════════════════════════════════════════════════════════════════════
// const observabilityStack = new ObservabilityStack(app, `AiSentinels-Observability-${envTitle}`, {
//   ...commonProps,
//   envName,
//   httpApiId: apiStack.httpApi.apiId,
//   description: `AI Sentinels — Observability [${envName}] (CloudWatch Dashboard · Alarms · SNS)`,
// });
// observabilityStack.addDependency(apiStack);

app.synth();
