/**
 * ApiStack — E3
 *
 * Creates the HTTP API Gateway with Cognito JWT authorizer, two Lambda
 * functions (health check + tenant provisioning), and all supporting
 * IAM, SSM, and CloudFormation output resources.
 *
 * Routes:
 *   GET  /health                    — public (HttpNoneAuthorizer)
 *   POST /api/v1/tenants/provision  — JWT protected (default authorizer)
 *
 * Security:
 *   • Default authorizer: Cognito JWT (validates access token, not id token)
 *   • provisionFn: VPC-attached (app subnets + sg-lambda), IAM auth to Aurora
 *   • healthFn: non-VPC, no IAM needed
 */
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import {
  HttpApi,
  HttpMethod,
  CorsHttpMethod,
  HttpStage,
  HttpNoneAuthorizer,
  IVpcLink,
} from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpAlbIntegration, HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Construct } from 'constructs';
import * as events from 'aws-cdk-lib/aws-events';
import * as evtTargets from 'aws-cdk-lib/aws-events-targets';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as path from 'path';

export interface ApiStackProps extends cdk.StackProps {
  /** 'dev' | 'staging' | 'prod' */
  envName: string;
  /** VPC from NetworkStack */
  vpc: ec2.IVpc;
  /** App-tier subnets from NetworkStack (provisionFn runs here) */
  appSubnets: ec2.ISubnet[];
  /** Lambda security group from NetworkStack */
  sgLambda: ec2.ISecurityGroup;
  /** Cognito User Pool ID */
  userPoolId: string;
  /** Cognito User Pool ARN */
  userPoolArn: string;
  /** Web SPA app client ID (used as JWT audience) */
  webClientId: string;
  /** NextAuth app client ID (also accepted as JWT audience) */
  nextAuthClientId: string;
  /** RDS Proxy hostname — from DataStack.auroraProxy.endpoint */
  auroraProxyEndpoint: string;
  /** DynamoDB audit events table ARN — from DataStack.auditEventsTable.tableArn */
  auditEventsTableArn: string;
  /** Internal ALB listener from ComputeStack — routes all /api/v1/* domain traffic */
  albListener: elbv2.IApplicationListener;
  /** VpcLink connecting API Gateway to the internal ALB */
  vpcLink: IVpcLink;
}

export class ApiStack extends cdk.Stack {
  public readonly httpApi: HttpApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { envName, appSubnets, sgLambda } = props;
    const isProd = envName === 'prod';

    const tag = (resource: Construct): void => {
      cdk.Tags.of(resource).add('project', 'aisentinels');
      cdk.Tags.of(resource).add('env', envName);
      cdk.Tags.of(resource).add('stack', 'api');
    };

    // ── Monorepo root is 4 levels up from stacks/ ────────────────────────────
    const repoRoot = path.join(__dirname, '../../../../');

    // ── DynamoDB audit events table name (shared by all Lambdas) ─────────────
    const auditEventsTableName = `aisentinels-audit-events-${envName}`;

    // ── postgres install hook ──────────────────────────────────────────────────
    // postgres.js is ESM-first. Both esbuild CJS bundling AND the package's own
    // cjs/ build suffer a module init-order bug where `parsers` is undefined.
    //
    // Fix: use OutputFormat.ESM so esbuild emits `import postgres from 'postgres'`
    // which naturally resolves to the working ESM entry point. The afterBundling
    // hook installs the npm package and sets `"type": "module"` in package.json
    // so Lambda treats the .js file as ESM.
    const postgresInstallHook = {
      beforeBundling(): string[] { return []; },
      beforeInstall(): string[] { return []; },
      afterBundling(_inputDir: string, outputDir: string): string[] {
        const dir = outputDir.replace(/\\/g, '/');
        return [
          `cd "${outputDir}" && npm init -y --silent 2>nul && npm install postgres@3.4.8 --save --silent`,
          `node -e "var f=require('fs'),p=JSON.parse(f.readFileSync('${dir}/package.json','utf8'));p.type='module';f.writeFileSync('${dir}/package.json',JSON.stringify(p,null,2))"`,
        ];
      },
    };

    // ══════════════════════════════════════════════════════════════════════════
    // Cognito JWT Authorizer
    // Validates the Cognito access token on every request.
    // jwtAudience = webClientId (API GW checks both `aud` and `client_id` claims)
    // ══════════════════════════════════════════════════════════════════════════
    const jwtIssuer = `https://cognito-idp.${this.region}.amazonaws.com/${props.userPoolId}`;

    const jwtAuthorizer = new HttpJwtAuthorizer('CognitoJwtAuthorizer', jwtIssuer, {
      authorizerName: `aisentinels-cognito-jwt-${envName}`,
      jwtAudience: [props.webClientId, props.nextAuthClientId],
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Lambda: GET /health — public, non-VPC
    // ══════════════════════════════════════════════════════════════════════════
    const healthLogGroup = new logs.LogGroup(this, 'HealthFnLogGroup', {
      logGroupName: `/aws/lambda/aisentinels-api-health-${envName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    tag(healthLogGroup);

    const healthFn = new NodejsFunction(this, 'HealthFn', {
      functionName: `aisentinels-api-health-${envName}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(repoRoot, 'packages/api/src/handlers/health.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(5),
      memorySize: 128,
      environment: { ENV_NAME: envName },
      logGroup: healthLogGroup,
      bundling: {
        minify: true,
        target: 'node22',
        format: OutputFormat.CJS,
        externalModules: ['@aws-sdk/*'],
      },
    });
    tag(healthFn);

    // ══════════════════════════════════════════════════════════════════════════
    // Lambda: POST /api/v1/tenants/provision — JWT protected, VPC-attached
    // Uses IAM auth to RDS Proxy and writes to DynamoDB audit table.
    // ══════════════════════════════════════════════════════════════════════════
    const provisionLogGroup = new logs.LogGroup(this, 'ProvisionFnLogGroup', {
      logGroupName: `/aws/lambda/aisentinels-api-provision-${envName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    tag(provisionLogGroup);

    const provisionFn = new NodejsFunction(this, 'TenantProvisionFn', {
      functionName: `aisentinels-api-provision-${envName}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(repoRoot, 'packages/api/src/handlers/tenant-provision.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      // VPC-attached — reaches RDS Proxy in the data tier
      vpc: props.vpc,
      vpcSubnets: { subnets: appSubnets },
      securityGroups: [sgLambda],
      allowPublicSubnet: false,
      environment: {
        ENV_NAME: envName,
        // AWS_DEFAULT_REGION is reserved — Lambda runtime sets it automatically
        AURORA_PROXY_ENDPOINT: props.auroraProxyEndpoint,
        AURORA_DB_USER: 'postgres', // TODO: replace with dedicated IAM user post-E1-deploy
        AURORA_DB_NAME: 'aisentinels',
        AURORA_IAM_AUTH: 'true',
        AUDIT_EVENTS_TABLE_NAME: auditEventsTableName,
      },
      logGroup: provisionLogGroup,
      bundling: {
        minify: true,
        target: 'node22',
        format: OutputFormat.ESM,
        externalModules: ['@aws-sdk/*', 'postgres'],
        commandHooks: postgresInstallHook,
      },
    });
    tag(provisionFn);

    // ── IAM: allow provisionFn to connect via RDS Proxy (IAM auth) ───────────
    // TODO post-E1-deploy: tighten resource ARN to the actual proxy resource ID
    // e.g. arn:aws:rds-db:us-east-1:{account}:dbuser:{proxy-resource-id}/postgres
    provisionFn.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'AllowRdsProxyIam',
        actions: ['rds-db:connect'],
        resources: [`arn:aws:rds-db:${this.region}:${this.account}:dbuser:*/*`],
      }),
    );

    // ── IAM: allow provisionFn to write to DynamoDB audit events table ────────
    provisionFn.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'AllowAuditDynamo',
        actions: ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:Query'],
        resources: [
          props.auditEventsTableArn,
          `${props.auditEventsTableArn}/index/*`,
        ],
      }),
    );

    // ══════════════════════════════════════════════════════════════════════════
    // IAM helper — shared grants for all VPC-attached business Lambdas
    // ══════════════════════════════════════════════════════════════════════════
    const grantBusinessLambda = (fn: NodejsFunction): void => {
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          sid: 'AllowRdsProxyIam',
          actions: ['rds-db:connect'],
          resources: [`arn:aws:rds-db:${this.region}:${this.account}:dbuser:*/*`],
        }),
      );
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          sid: 'AllowAuditDynamo',
          actions: ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:Query'],
          resources: [
            props.auditEventsTableArn,
            `${props.auditEventsTableArn}/index/*`,
          ],
        }),
      );
      tag(fn);
    };

    // ── Shared VPC config for all business Lambdas ────────────────────────────
    const businessLambdaVpcConfig = {
      vpc:             props.vpc,
      vpcSubnets:      { subnets: appSubnets as ec2.ISubnet[] },
      securityGroups:  [sgLambda] as ec2.ISecurityGroup[],
      allowPublicSubnet: false,
    };

    const businessLambdaEnv = {
      ENV_NAME:                  envName,
      AURORA_PROXY_ENDPOINT:     props.auroraProxyEndpoint,
      AURORA_DB_USER:            'postgres',
      AURORA_DB_NAME:            'aisentinels',
      AURORA_IAM_AUTH:           'true',
      AUDIT_EVENTS_TABLE_NAME:   auditEventsTableName,
    };

    const businessLambdaBundling = {
      minify: true,
      target: 'node22',
      format: OutputFormat.ESM,
      externalModules: ['@aws-sdk/*', 'postgres'] as string[],
      commandHooks: postgresInstallHook,
    };

    // ══════════════════════════════════════════════════════════════════════════
    // Lambda: Document Studio — GET+POST /api/v1/document-studio/documents + sub-routes
    // ══════════════════════════════════════════════════════════════════════════
    const documentsLogGroup = new logs.LogGroup(this, 'DocumentsFnLogGroup', {
      logGroupName: `/aws/lambda/aisentinels-api-documents-${envName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    tag(documentsLogGroup);

    const documentsFn = new NodejsFunction(this, 'DocumentsFn', {
      functionName: `aisentinels-api-documents-${envName}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(repoRoot, 'packages/api/src/handlers/document-studio/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      ...businessLambdaVpcConfig,
      environment: businessLambdaEnv,
      logGroup: documentsLogGroup,
      bundling: businessLambdaBundling,
    });
    grantBusinessLambda(documentsFn);

    // ══════════════════════════════════════════════════════════════════════════
    // Lambda: Audit Studio — GET+POST /api/v1/audits + sub-routes
    // ══════════════════════════════════════════════════════════════════════════
    const auditsLogGroup = new logs.LogGroup(this, 'AuditsFnLogGroup', {
      logGroupName: `/aws/lambda/aisentinels-api-audits-${envName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    tag(auditsLogGroup);

    const auditsFn = new NodejsFunction(this, 'AuditsFn', {
      functionName: `aisentinels-api-audits-${envName}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(repoRoot, 'packages/api/src/handlers/audit/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      ...businessLambdaVpcConfig,
      environment: businessLambdaEnv,
      logGroup: auditsLogGroup,
      bundling: businessLambdaBundling,
    });
    grantBusinessLambda(auditsFn);

    // ══════════════════════════════════════════════════════════════════════════
    // Lambda: CAPA Engine — GET+POST /api/v1/capa + sub-routes
    // ══════════════════════════════════════════════════════════════════════════
    const capaLogGroup = new logs.LogGroup(this, 'CapaFnLogGroup', {
      logGroupName: `/aws/lambda/aisentinels-api-capa-${envName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    tag(capaLogGroup);

    const capaFn = new NodejsFunction(this, 'CapaFn', {
      functionName: `aisentinels-api-capa-${envName}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(repoRoot, 'packages/api/src/handlers/capa/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      ...businessLambdaVpcConfig,
      environment: businessLambdaEnv,
      logGroup: capaLogGroup,
      bundling: businessLambdaBundling,
    });
    grantBusinessLambda(capaFn);

    // ══════════════════════════════════════════════════════════════════════════
    // Lambda: Records Vault — GET+POST /api/v1/records-vault/records + sub-routes
    // ══════════════════════════════════════════════════════════════════════════
    const recordsLogGroup = new logs.LogGroup(this, 'RecordsFnLogGroup', {
      logGroupName: `/aws/lambda/aisentinels-api-records-${envName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    tag(recordsLogGroup);

    const recordsFn = new NodejsFunction(this, 'RecordsFn', {
      functionName: `aisentinels-api-records-${envName}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(repoRoot, 'packages/api/src/handlers/records-vault/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      ...businessLambdaVpcConfig,
      environment: businessLambdaEnv,
      logGroup: recordsLogGroup,
      bundling: businessLambdaBundling,
    });
    grantBusinessLambda(recordsFn);

    // ══════════════════════════════════════════════════════════════════════════
    // Lambda: Billing — /api/v1/billing/* routes
    // ══════════════════════════════════════════════════════════════════════════
    const billingLogGroup = new logs.LogGroup(this, 'BillingFnLogGroup', {
      logGroupName: `/aws/lambda/aisentinels-api-billing-${envName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    tag(billingLogGroup);

    const billingFn = new NodejsFunction(this, 'BillingFn', {
      functionName: `aisentinels-api-billing-${envName}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(repoRoot, 'packages/api/src/handlers/billing/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      ...businessLambdaVpcConfig,
      environment: {
        ...businessLambdaEnv,
        WISE_WEBHOOK_SECRET: ssm.StringParameter.valueForStringParameter(
          this, `/aisentinels/${envName}/billing/wise-webhook-secret`,
        ),
        // Wise API key for fetching transfer details on payment events
        WISE_API_KEY: ssm.StringParameter.valueForStringParameter(
          this, `/aisentinels/${envName}/billing/wise-api-key`,
        ),
        NOTIFICATIONS_FROM_EMAIL: 'notifications@aisentinels.io',
        SES_REGION: 'us-east-1',
      },
      logGroup: billingLogGroup,
      bundling: businessLambdaBundling,
    });
    grantBusinessLambda(billingFn);
    // Allow billingFn to read Wise SSM parameters at runtime (covers both
    // wise-webhook-secret and wise-api-key under the billing/* path)
    billingFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'ReadBillingSecrets',
      actions: ['ssm:GetParameter'],
      resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/aisentinels/${envName}/billing/*`],
    }));
    // SES: send subscription upgrade notification emails (Phase 10)
    billingFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'BillingSESSend',
      effect: iam.Effect.ALLOW,
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: [
        `arn:aws:ses:us-east-1:${this.account}:identity/aisentinels.io`,
        `arn:aws:ses:us-east-1:${this.account}:identity/*@aisentinels.io`,
      ],
    }));

    // Allow billingFn to emit CloudWatch metrics for unmatched payment alerts
    billingFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'EmitBillingMetrics',
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
      conditions: {
        StringEquals: { 'cloudwatch:namespace': 'AiSentinels/Billing' },
      },
    }));

    // ══════════════════════════════════════════════════════════════════════════
    // Lambda: Admin — POST /api/v1/admin/billing/activate
    // Manual activation of tenant subscriptions. JWT + admin role enforced.
    // ══════════════════════════════════════════════════════════════════════════
    const adminLogGroup = new logs.LogGroup(this, 'AdminFnLogGroup', {
      logGroupName: `/aws/lambda/aisentinels-api-admin-${envName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    tag(adminLogGroup);

    const adminFn = new NodejsFunction(this, 'AdminFn', {
      functionName: `aisentinels-api-admin-${envName}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(repoRoot, 'packages/api/src/handlers/admin/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      ...businessLambdaVpcConfig,
      environment: businessLambdaEnv,
      logGroup: adminLogGroup,
      bundling: businessLambdaBundling,
    });
    grantBusinessLambda(adminFn);

    // ══════════════════════════════════════════════════════════════════════════
    // Lambda: Settings — /api/v1/settings/* routes (P3)
    // Manages org context, standards, roles, users. Requires Cognito admin.
    // ══════════════════════════════════════════════════════════════════════════
    const settingsLogGroup = new logs.LogGroup(this, 'SettingsFnLogGroup', {
      logGroupName: `/aws/lambda/aisentinels-api-settings-${envName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    tag(settingsLogGroup);

    const settingsFn = new NodejsFunction(this, 'SettingsFn', {
      functionName: `aisentinels-api-settings-${envName}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(repoRoot, 'packages/api/src/handlers/settings/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      ...businessLambdaVpcConfig,
      environment: {
        ...businessLambdaEnv,
        COGNITO_USER_POOL_ID: props.userPoolId,
      },
      logGroup: settingsLogGroup,
      bundling: businessLambdaBundling,
    });
    grantBusinessLambda(settingsFn);
    // Allow settingsFn to create Cognito users (invite-user handler)
    settingsFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'AllowCognitoAdminCreateUser',
      actions: ['cognito-idp:AdminCreateUser'],
      resources: [props.userPoolArn],
    }));

    // ══════════════════════════════════════════════════════════════════════════
    // Lambda: Brain — /api/v1/brain/* routes (P3)
    // Document upload, text extraction (PDF/DOCX), chunking for RAG pipeline.
    // Higher memory for PDF processing, S3 access for working-files bucket.
    // ══════════════════════════════════════════════════════════════════════════
    const brainLogGroup = new logs.LogGroup(this, 'BrainFnLogGroup', {
      logGroupName: `/aws/lambda/aisentinels-api-brain-${envName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    tag(brainLogGroup);

    const workingFilesBucketName = `aisentinels-working-files-${this.region}`;

    const brainFn = new NodejsFunction(this, 'BrainFn', {
      functionName: `aisentinels-api-brain-${envName}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(repoRoot, 'packages/api/src/handlers/brain/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(60),
      memorySize: 1024,
      ...businessLambdaVpcConfig,
      environment: {
        ...businessLambdaEnv,
        WORKING_FILES_BUCKET: workingFilesBucketName,
      },
      logGroup: brainLogGroup,
      bundling: businessLambdaBundling,
    });
    grantBusinessLambda(brainFn);
    // Allow brainFn to read/write/delete objects in the working-files bucket
    brainFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'AllowS3WorkingFiles',
      actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
      resources: [`arn:aws:s3:::${workingFilesBucketName}/*`],
    }));

    // ══════════════════════════════════════════════════════════════════════════
    // HTTP API Gateway
    //
    // createDefaultStage: false — required so we can attach throttle settings
    // on a manually created HttpStage. API GW ignores throttle on the auto stage.
    // defaultAuthorizer: jwtAuthorizer — protects all routes unless overridden
    // ══════════════════════════════════════════════════════════════════════════
    this.httpApi = new HttpApi(this, 'HttpApi', {
      apiName: `aisentinels-api-${envName}`,
      createDefaultStage: false,
      defaultAuthorizer: jwtAuthorizer,
      corsPreflight: {
        allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key'],
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PUT,
          CorsHttpMethod.DELETE,
          CorsHttpMethod.PATCH,
          CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: isProd
          ? [
              'https://app.aisentinels.io',
              'https://aisentinels.io',
              'https://www.aisentinels.io',
            ]
          : ['http://localhost:3000', 'http://localhost:3001'],
        maxAge: cdk.Duration.days(1),
      },
    });
    tag(this.httpApi);

    // ── Stage with throttle ───────────────────────────────────────────────────
    // HttpStage (not HttpApi) is where throttle is configured in CDK v2.
    const defaultStage = new HttpStage(this, 'DefaultStage', {
      httpApi: this.httpApi,
      stageName: '$default',
      autoDeploy: true,
      throttle: isProd
        ? { burstLimit: 1_000, rateLimit: 500 }
        : { burstLimit: 100, rateLimit: 50 },
    });
    tag(defaultStage);

    // ── API Gateway Access Logging (E10) ──────────────────────────────────────
    // IMPORTANT: HTTP API access logging requires the account-level CloudWatch
    // Logs role to be set in API Gateway account settings BEFORE deploy:
    //   aws apigateway update-account --patch-operations \
    //     op=replace,path=/cloudwatchRoleArn,value=arn:aws:iam::{account}:role/APIGatewayCloudWatchRole
    // The grantWrite(ServicePrincipal) below is kept for explicit intent but the
    // account-level role is what API Gateway actually uses for log delivery.
    const apiAccessLogGroup = new logs.LogGroup(this, 'ApiAccessLogGroup', {
      logGroupName:  `/aws/apigateway/aisentinels-${envName}-access`,
      retention:     logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    apiAccessLogGroup.grantWrite(new iam.ServicePrincipal('apigateway.amazonaws.com'));
    tag(apiAccessLogGroup);

    // HttpStage does not expose accessLogSettings via L2 — use L1 override
    (defaultStage.node.defaultChild as cdk.CfnResource).addPropertyOverride(
      'AccessLogSettings',
      {
        DestinationArn: apiAccessLogGroup.logGroupArn,
        Format: JSON.stringify({
          requestId: '$context.requestId',
          ip: '$context.identity.sourceIp',
          requestTime: '$context.requestTime',
          httpMethod: '$context.httpMethod',
          routeKey: '$context.routeKey',
          status: '$context.status',
          protocol: '$context.protocol',
          responseLength: '$context.responseLength',
          integrationError: '$context.integrationErrorMessage',
        }),
      },
    );

    // ── WAF ─────────────────────────────────────────────────────────────────────
    // WAFv2 WebACLAssociation does NOT support API Gateway HTTP APIs (v2).
    // Supported: REST API, ALB, AppSync, Cognito, CloudFront, App Runner.
    // WAF protection is handled by Cloudflare (DNS/WAF layer) instead.
    // Re-enable when migrating to CloudFront-fronted API or REST API.
    // See: https://docs.aws.amazon.com/waf/latest/developerguide/waf-chapter.html

    // ── Routes ────────────────────────────────────────────────────────────────

    // GET /health — HttpNoneAuthorizer overrides the defaultAuthorizer
    this.httpApi.addRoutes({
      path: '/health',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('HealthIntegration', healthFn),
      authorizer: new HttpNoneAuthorizer(),
    });

    // POST /api/v1/tenants/provision — protected by default JWT authorizer
    this.httpApi.addRoutes({
      path: '/api/v1/tenants/provision',
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('ProvisionIntegration', provisionFn),
    });

    // ── Document Studio routes (E7) ───────────────────────────────────────────
    // More-specific paths take precedence over the catch-all ANY /api/v1/{proxy+}.
    // All routes use the default JWT authorizer (set on the HttpApi).
    const documentsIntegration = new HttpLambdaIntegration('DocumentsIntegration', documentsFn);

    this.httpApi.addRoutes({
      path: '/api/v1/document-studio/documents',
      methods: [HttpMethod.GET, HttpMethod.POST],
      integration: documentsIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/document-studio/documents/{id}',
      methods: [HttpMethod.GET],
      integration: documentsIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/document-studio/documents/{id}/submit-for-approval',
      methods: [HttpMethod.POST],
      integration: documentsIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/document-studio/approvals/{approvalId}/decide',
      methods: [HttpMethod.POST],
      integration: documentsIntegration,
    });

    // ── Audit Studio routes (E7) ──────────────────────────────────────────────
    const auditsIntegration = new HttpLambdaIntegration('AuditsIntegration', auditsFn);

    this.httpApi.addRoutes({
      path: '/api/v1/audits',
      methods: [HttpMethod.GET, HttpMethod.POST],
      integration: auditsIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/audits/{id}',
      methods: [HttpMethod.GET],
      integration: auditsIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/audits/{id}/findings',
      methods: [HttpMethod.POST],
      integration: auditsIntegration,
    });

    // ── CAPA Engine routes (E8) ───────────────────────────────────────────────
    const capaIntegration = new HttpLambdaIntegration('CapaIntegration', capaFn);

    this.httpApi.addRoutes({
      path: '/api/v1/capa',
      methods: [HttpMethod.GET, HttpMethod.POST],
      integration: capaIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/capa/{id}',
      methods: [HttpMethod.GET],
      integration: capaIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/capa/{id}/status',
      methods: [HttpMethod.PATCH],
      integration: capaIntegration,
    });

    // ── Records Vault routes (E8) ─────────────────────────────────────────────
    const recordsIntegration = new HttpLambdaIntegration('RecordsIntegration', recordsFn);

    this.httpApi.addRoutes({
      path: '/api/v1/records-vault/records',
      methods: [HttpMethod.GET, HttpMethod.POST],
      integration: recordsIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/records-vault/records/{id}/verify-integrity',
      methods: [HttpMethod.POST],
      integration: recordsIntegration,
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Lambda: AI Sentinels — POST /api/v1/ai/* routes (Gemini 2.5 Pro)
    // Higher memory + timeout for AI inference. SSM access for Gemini key.
    // ══════════════════════════════════════════════════════════════════════════
    const aiLogGroup = new logs.LogGroup(this, 'AiFnLogGroup', {
      logGroupName: `/aws/lambda/aisentinels-api-ai-${envName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    tag(aiLogGroup);

    const aiFn = new NodejsFunction(this, 'AiFn', {
      functionName: `aisentinels-api-ai-${envName}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(repoRoot, 'packages/api/src/handlers/ai/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(90),
      memorySize: 1024,
      ...businessLambdaVpcConfig,
      environment: businessLambdaEnv,
      logGroup: aiLogGroup,
      bundling: businessLambdaBundling,
    });
    grantBusinessLambda(aiFn);
    // Allow aiFn to read the Gemini API key from SSM (SecureString → needs decrypt)
    aiFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'ReadAiSecrets',
      actions: ['ssm:GetParameter'],
      resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/aisentinels/${envName}/ai/*`],
    }));
    aiFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'DecryptAiSecrets',
      actions: ['kms:Decrypt'],
      resources: ['*'], // SSM SecureString uses AWS-managed key
      conditions: {
        StringEquals: { 'kms:ViaService': `ssm.${this.region}.amazonaws.com` },
      },
    }));

    // ── Billing routes (E9) ──────────────────────────────────────────────────
    const billingIntegration = new HttpLambdaIntegration('BillingIntegration', billingFn);

    this.httpApi.addRoutes({
      path: '/api/v1/billing/subscription',
      methods: [HttpMethod.GET],
      integration: billingIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/billing/usage',
      methods: [HttpMethod.GET],
      integration: billingIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/billing/upgrade',
      methods: [HttpMethod.POST],
      integration: billingIntegration,
    });
    // Wise calls this without a JWT — override the default authorizer
    this.httpApi.addRoutes({
      path: '/api/v1/billing/wise/webhook',
      methods: [HttpMethod.POST],
      integration: billingIntegration,
      authorizer: new HttpNoneAuthorizer(),
    });

    // ── Admin routes ────────────────────────────────────────────────────────
    const adminIntegration = new HttpLambdaIntegration('AdminIntegration', adminFn);

    this.httpApi.addRoutes({
      path: '/api/v1/admin/billing/activate',
      methods: [HttpMethod.POST],
      integration: adminIntegration,
    });

    // ── AI Sentinel routes (Phase 1) ─────────────────────────────────────────
    const aiIntegration = new HttpLambdaIntegration('AiIntegration', aiFn);

    this.httpApi.addRoutes({
      path: '/api/v1/ai/document-generate',
      methods: [HttpMethod.POST],
      integration: aiIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/ai/clause-classify',
      methods: [HttpMethod.POST],
      integration: aiIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/ai/audit-plan',
      methods: [HttpMethod.POST],
      integration: aiIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/ai/audit-examine',
      methods: [HttpMethod.POST],
      integration: aiIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/ai/audit-report',
      methods: [HttpMethod.POST],
      integration: aiIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/ai/root-cause',
      methods: [HttpMethod.POST],
      integration: aiIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/ai/gap-detect',
      methods: [HttpMethod.POST],
      integration: aiIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/ai/management-review',
      methods: [HttpMethod.POST],
      integration: aiIntegration,
    });

    // ══════════════════════════════════════════════════════════════════════════
    // SES Domain Identity — Omni's email identity (Phase 5)
    // DKIM verification — Julio must add the 3 CNAME records to aisentinels.io DNS
    // ══════════════════════════════════════════════════════════════════════════
    const domainIdentity = new ses.EmailIdentity(this, 'OmniEmailIdentity', {
      identity: ses.Identity.domain('aisentinels.io'),
      mailFromDomain: 'mail.aisentinels.io',
    });
    tag(domainIdentity);

    new cdk.CfnOutput(this, 'SesDkimRecord1', {
      value: domainIdentity.dkimRecords[0]?.name ?? 'check SES console',
      description: 'Add this CNAME to aisentinels.io DNS (DKIM 1)',
    });
    new cdk.CfnOutput(this, 'SesDkimRecord2', {
      value: domainIdentity.dkimRecords[1]?.name ?? 'check SES console',
      description: 'Add this CNAME to aisentinels.io DNS (DKIM 2)',
    });
    new cdk.CfnOutput(this, 'SesDkimRecord3', {
      value: domainIdentity.dkimRecords[2]?.name ?? 'check SES console',
      description: 'Add this CNAME to aisentinels.io DNS (DKIM 3)',
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Lambda: Omni Orchestrator — POST /api/v1/omni/orchestrate (Claude Sonnet)
    // Multi-sentinel workflow orchestrator. Higher timeout (120s) for sequential
    // Claude + Gemini calls. SSM access for Anthropic + Gemini API keys.
    // SES email for Omni communications (Phase 5).
    // ══════════════════════════════════════════════════════════════════════════
    const omniLogGroup = new logs.LogGroup(this, 'OmniFnLogGroup', {
      logGroupName: `/aws/lambda/aisentinels-api-omni-${envName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    tag(omniLogGroup);

    const omniFn = new NodejsFunction(this, 'OmniFn', {
      functionName: `aisentinels-api-omni-${envName}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(repoRoot, 'packages/api/src/handlers/omni/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(120),
      memorySize: 1024,
      ...businessLambdaVpcConfig,
      environment: {
        ...businessLambdaEnv,
        ANTHROPIC_API_KEY_SSM_PATH: `/aisentinels/${envName}/ai/anthropic-api-key`,
        SENTINEL_EVENT_BUS_NAME: 'aisentinels-sentinel-bus',
        OMNI_FROM_EMAIL: 'omni@aisentinels.io',
        OMNI_REPLY_TO: 'support@aisentinels.io',
        SES_REGION: 'us-east-1',
        APPROVAL_TOKEN_SECRET_SSM_PATH: `/aisentinels/${envName}/auth/approval-token-secret`,
      },
      logGroup: omniLogGroup,
      bundling: businessLambdaBundling,
    });
    grantBusinessLambda(omniFn);
    // Allow omniFn to send email via SES (Phase 5)
    omniFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'AllowOmniSESSend',
      effect: iam.Effect.ALLOW,
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: [
        `arn:aws:ses:us-east-1:${this.account}:identity/aisentinels.io`,
        `arn:aws:ses:us-east-1:${this.account}:identity/*@aisentinels.io`,
      ],
    }));
    // Allow omniFn to read approval token secret from SSM (Phase 5)
    omniFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'ReadApprovalTokenSecret',
      actions: ['ssm:GetParameter'],
      resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/aisentinels/${envName}/auth/*`],
    }));
    // Allow omniFn to read AI API keys (Anthropic + Gemini) from SSM
    omniFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'ReadAiSecrets',
      actions: ['ssm:GetParameter'],
      resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/aisentinels/${envName}/ai/*`],
    }));
    omniFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'DecryptAiSecrets',
      actions: ['kms:Decrypt'],
      resources: ['*'],
      conditions: {
        StringEquals: { 'kms:ViaService': `ssm.${this.region}.amazonaws.com` },
      },
    }));
    // Allow omniFn to emit events to the Sentinel event bus (Phase 3)
    omniFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'AllowEventBridgePutEvents',
      actions: ['events:PutEvents'],
      resources: [`arn:aws:events:${this.region}:${this.account}:event-bus/aisentinels-sentinel-bus`],
    }));

    // ── Omni Orchestrator routes (Phase 2) ──────────────────────────────────
    const omniIntegration = new HttpLambdaIntegration('OmniIntegration', omniFn);

    this.httpApi.addRoutes({
      path: '/api/v1/omni/orchestrate',
      methods: [HttpMethod.POST],
      integration: omniIntegration,
    });
    // POST /api/v1/omni/approve — token-based auth (no JWT)
    this.httpApi.addRoutes({
      path: '/api/v1/omni/approve',
      methods: [HttpMethod.POST],
      integration: omniIntegration,
      authorizer: new HttpNoneAuthorizer(),
    });

    // ── Settings routes (P3) ──────────────────────────────────────────────────
    const settingsIntegration = new HttpLambdaIntegration('SettingsIntegration', settingsFn);

    this.httpApi.addRoutes({
      path: '/api/v1/settings/org',
      methods: [HttpMethod.GET, HttpMethod.PUT],
      integration: settingsIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/settings/standards/activate',
      methods: [HttpMethod.POST],
      integration: settingsIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/settings/standards/{code}',
      methods: [HttpMethod.DELETE],
      integration: settingsIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/settings/roles',
      methods: [HttpMethod.GET],
      integration: settingsIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/settings/users',
      methods: [HttpMethod.GET],
      integration: settingsIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/settings/users/invite',
      methods: [HttpMethod.POST],
      integration: settingsIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/settings/users/{userId}/role',
      methods: [HttpMethod.PUT],
      integration: settingsIntegration,
    });

    // ── Brain routes (P3) ─────────────────────────────────────────────────────
    const brainIntegration = new HttpLambdaIntegration('BrainIntegration', brainFn);

    this.httpApi.addRoutes({
      path: '/api/v1/brain/upload-url',
      methods: [HttpMethod.POST],
      integration: brainIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/brain/process',
      methods: [HttpMethod.POST],
      integration: brainIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/brain/documents',
      methods: [HttpMethod.GET],
      integration: brainIntegration,
    });
    this.httpApi.addRoutes({
      path: '/api/v1/brain/documents/{id}',
      methods: [HttpMethod.DELETE],
      integration: brainIntegration,
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Lambda: Audit Trail — GET /api/v1/audit-trail (DynamoDB query only)
    // Non-VPC for faster cold start — only needs DynamoDB access via Gateway endpoint.
    // ══════════════════════════════════════════════════════════════════════════
    const auditTrailLogGroup = new logs.LogGroup(this, 'AuditTrailFnLogGroup', {
      logGroupName: `/aws/lambda/aisentinels-api-audit-trail-${envName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    tag(auditTrailLogGroup);

    const auditTrailFn = new NodejsFunction(this, 'AuditTrailFn', {
      functionName: `aisentinels-api-audit-trail-${envName}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(repoRoot, 'packages/api/src/handlers/audit-trail/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: {
        ENV_NAME: envName,
        AUDIT_EVENTS_TABLE_NAME: auditEventsTableName,
      },
      logGroup: auditTrailLogGroup,
      bundling: {
        minify: true,
        target: 'node22',
        format: OutputFormat.ESM,
        externalModules: ['@aws-sdk/*'],
      },
    });
    tag(auditTrailFn);
    // Allow auditTrailFn to query the DynamoDB audit events table + GSIs
    auditTrailFn.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'AllowAuditDynamoQuery',
        actions: ['dynamodb:Query'],
        resources: [
          props.auditEventsTableArn,
          `${props.auditEventsTableArn}/index/*`,
        ],
      }),
    );

    // ── Audit Trail route (Phase 3) ────────────────────────────────────────
    const auditTrailIntegration = new HttpLambdaIntegration('AuditTrailIntegration', auditTrailFn);

    this.httpApi.addRoutes({
      path: '/api/v1/audit-trail',
      methods: [HttpMethod.GET],
      integration: auditTrailIntegration,
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Lambda: Ghost Trigger — POST /api/v1/ghost/trigger (P6-D)
    // Admin-only endpoint to manually invoke the Ghost Lambda (async).
    // Lightweight — only needs Lambda invoke + DynamoDB audit + JWT.
    // ══════════════════════════════════════════════════════════════════════════
    const ghostTriggerLogGroup = new logs.LogGroup(this, 'GhostTriggerFnLogGroup', {
      logGroupName: `/aws/lambda/aisentinels-api-ghost-trigger-${envName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    tag(ghostTriggerLogGroup);

    const ghostFnArn = `arn:aws:lambda:${this.region}:${this.account}:function:aisentinels-ghost-${envName}`;

    const ghostTriggerFn = new NodejsFunction(this, 'GhostTriggerFn', {
      functionName: `aisentinels-api-ghost-trigger-${envName}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(repoRoot, 'packages/api/src/handlers/ghost/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      ...businessLambdaVpcConfig,
      environment: {
        ...businessLambdaEnv,
        GHOST_LAMBDA_FN_NAME: `aisentinels-ghost-${envName}`,
      },
      logGroup: ghostTriggerLogGroup,
      bundling: businessLambdaBundling,
    });
    grantBusinessLambda(ghostTriggerFn);
    // Allow ghostTriggerFn to invoke the Ghost Lambda (async trigger)
    ghostTriggerFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'AllowInvokeGhostFn',
      effect: iam.Effect.ALLOW,
      actions: ['lambda:InvokeFunction'],
      resources: [ghostFnArn],
    }));

    // ── Ghost Trigger route (P6-D) ──────────────────────────────────────────
    const ghostTriggerIntegration = new HttpLambdaIntegration('GhostTriggerIntegration', ghostTriggerFn);

    this.httpApi.addRoutes({
      path: '/api/v1/ghost/trigger',
      methods: [HttpMethod.POST],
      integration: ghostTriggerIntegration,
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Lambda: Bulk Upload — POST /api/v1/bulk-upload/* (P8-B)
    // Presigned S3 URLs + parallel processing + Omni triage.
    // Needs S3 PutObject/HeadObject/GetObject on working-files bulk/* prefix,
    // plus RDS Proxy + DynamoDB (via grantBusinessLambda), plus Gemini SSM key.
    // ══════════════════════════════════════════════════════════════════════════
    const bulkUploadLogGroup = new logs.LogGroup(this, 'BulkUploadFnLogGroup', {
      logGroupName: `/aws/lambda/aisentinels-api-bulk-upload-${envName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    tag(bulkUploadLogGroup);

    const bulkUploadFn = new NodejsFunction(this, 'BulkUploadFn', {
      functionName: `aisentinels-api-bulk-upload-${envName}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(repoRoot, 'packages/api/src/handlers/bulk-upload/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(120),
      memorySize: 512,
      ...businessLambdaVpcConfig,
      environment: {
        ...businessLambdaEnv,
        WORKING_FILES_BUCKET: `aisentinels-working-files-${this.region}`,
      },
      logGroup: bulkUploadLogGroup,
      bundling: businessLambdaBundling,
    });
    grantBusinessLambda(bulkUploadFn);

    // S3 presigned URL generation + file verification + text extraction
    bulkUploadFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'BulkUploadS3Access',
      effect: iam.Effect.ALLOW,
      actions: ['s3:PutObject', 's3:HeadObject', 's3:GetObject'],
      resources: [
        `arn:aws:s3:::aisentinels-working-files-${this.region}/bulk/*`,
      ],
    }));

    // SSM read for Gemini API key (needed by Omni triage classification)
    bulkUploadFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'BulkUploadSsmRead',
      effect: iam.Effect.ALLOW,
      actions: ['ssm:GetParameter'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/aisentinels/${envName}/ai/*`,
      ],
    }));

    // ── Bulk Upload routes (P8-B) ────────────────────────────────────────────
    const bulkUploadIntegration = new HttpLambdaIntegration('BulkUploadIntegration', bulkUploadFn);

    this.httpApi.addRoutes({
      path: '/api/v1/bulk-upload/initiate',
      methods: [HttpMethod.POST],
      integration: bulkUploadIntegration,
    });

    this.httpApi.addRoutes({
      path: '/api/v1/bulk-upload/process',
      methods: [HttpMethod.POST],
      integration: bulkUploadIntegration,
    });

    this.httpApi.addRoutes({
      path: '/api/v1/bulk-upload/batch/{batchId}',
      methods: [HttpMethod.GET],
      integration: bulkUploadIntegration,
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Lambda: Board Report — POST /api/v1/board-report/* (P9-B)
    // Isolated Lambda for Chromium/puppeteer PDF generation.
    // Higher memory (2048MB) for headless Chrome + 120s timeout.
    // Needs: S3 exports bucket, SSM Anthropic key, DynamoDB audit query, RDS Proxy.
    // ══════════════════════════════════════════════════════════════════════════
    const boardReportLogGroup = new logs.LogGroup(this, 'BoardReportFnLogGroup', {
      logGroupName: `/aws/lambda/aisentinels-api-board-report-${envName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    tag(boardReportLogGroup);

    const boardReportFn = new NodejsFunction(this, 'BoardReportFn', {
      functionName: `aisentinels-api-board-report-${envName}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(repoRoot, 'packages/api/src/handlers/board-report/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(120),
      memorySize: 2048,
      ...businessLambdaVpcConfig,
      environment: {
        ...businessLambdaEnv,
        EXPORTS_BUCKET: `aisentinels-exports-${this.region}`,
        NOTIFICATIONS_FROM_EMAIL: 'notifications@aisentinels.io',
        SES_REGION: 'us-east-1',
      },
      logGroup: boardReportLogGroup,
      bundling: {
        minify: true,
        target: 'node22',
        format: OutputFormat.ESM,
        externalModules: ['@aws-sdk/*', 'postgres', '@sparticuz/chromium'],
        commandHooks: {
          beforeBundling(): string[] { return []; },
          beforeInstall(): string[] { return []; },
          afterBundling(_inputDir: string, outputDir: string): string[] {
            const dir = outputDir.replace(/\\/g, '/');
            return [
              `cd "${outputDir}" && npm init -y --silent 2>nul && npm install postgres@3.4.8 @sparticuz/chromium@143 --save --silent`,
              `node -e "var f=require('fs'),p=JSON.parse(f.readFileSync('${dir}/package.json','utf8'));p.type='module';f.writeFileSync('${dir}/package.json',JSON.stringify(p,null,2))"`,
            ];
          },
        },
      },
    });
    grantBusinessLambda(boardReportFn);

    // S3: PutObject + GetObject on exports bucket board-reports/* prefix
    boardReportFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'BoardReportS3Access',
      effect: iam.Effect.ALLOW,
      actions: ['s3:PutObject', 's3:GetObject'],
      resources: [
        `arn:aws:s3:::aisentinels-exports-${this.region}/board-reports/*`,
      ],
    }));

    // SSM: read Anthropic API key (needed by Claude executive summary)
    boardReportFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'BoardReportSsmRead',
      effect: iam.Effect.ALLOW,
      actions: ['ssm:GetParameter'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/aisentinels/${envName}/ai/*`,
      ],
    }));

    // KMS: decrypt SSM SecureString (Anthropic key)
    boardReportFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'BoardReportKmsDecrypt',
      actions: ['kms:Decrypt'],
      resources: ['*'],
      conditions: {
        StringEquals: { 'kms:ViaService': `ssm.${this.region}.amazonaws.com` },
      },
    }));

    // SES: send board-report-ready notification emails (Phase 10)
    boardReportFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'BoardReportSESSend',
      effect: iam.Effect.ALLOW,
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: [
        `arn:aws:ses:us-east-1:${this.account}:identity/aisentinels.io`,
        `arn:aws:ses:us-east-1:${this.account}:identity/*@aisentinels.io`,
      ],
    }));

    // ── Board Report routes (P9-B) ──────────────────────────────────────────
    const boardReportIntegration = new HttpLambdaIntegration('BoardReportIntegration', boardReportFn);

    this.httpApi.addRoutes({
      path: '/api/v1/board-report/generate',
      methods: [HttpMethod.POST],
      integration: boardReportIntegration,
    });

    this.httpApi.addRoutes({
      path: '/api/v1/board-report/list',
      methods: [HttpMethod.GET],
      integration: boardReportIntegration,
    });

    // ── EventBridge: Monthly board report cron (P9-B) ───────────────────────
    // 1st of every month at 08:00 UTC. Invokes boardReportFn directly.
    // EventBridge passes a minimal event — the scheduled handler queries all
    // active tenants and generates reports for each.
    const boardReportDlq = new sqs.Queue(this, 'BoardReportDLQ', {
      queueName: `aisentinels-board-report-dlq-${envName}`,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });
    tag(boardReportDlq);

    const boardReportRule = new events.Rule(this, 'BoardReportMonthlyRule', {
      ruleName: `aisentinels-board-report-monthly-${envName}`,
      description: 'Board Report — monthly generation on 1st at 08:00 UTC',
      enabled: true,
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '8',
        day: '1',
        month: '*',
        year: '*',
      }),
    });
    tag(boardReportRule);

    boardReportRule.addTarget(new evtTargets.LambdaFunction(boardReportFn, {
      retryAttempts: 1,
      deadLetterQueue: boardReportDlq,
    }));

    // ══════════════════════════════════════════════════════════════════════════
    // Lambda: Legal — POST /api/v1/legal/accept, GET /api/v1/legal/status (P10)
    // Handles legal acceptance recording + status queries. VPC-attached (Aurora).
    // SES for confirmation emails. DynamoDB audit logging.
    // ══════════════════════════════════════════════════════════════════════════
    const legalLogGroup = new logs.LogGroup(this, 'LegalFnLogGroup', {
      logGroupName: `/aws/lambda/aisentinels-api-legal-${envName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    tag(legalLogGroup);

    const legalFn = new NodejsFunction(this, 'LegalFn', {
      functionName: `aisentinels-api-legal-${envName}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(repoRoot, 'packages/api/src/handlers/legal/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      ...businessLambdaVpcConfig,
      environment: {
        ...businessLambdaEnv,
        LEGAL_FROM_EMAIL: 'legal@aisentinels.io',
        SES_REGION: 'us-east-1',
      },
      logGroup: legalLogGroup,
      bundling: businessLambdaBundling,
    });
    grantBusinessLambda(legalFn);

    // SES: send legal acceptance confirmation emails (Phase 10)
    legalFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'LegalSESSend',
      effect: iam.Effect.ALLOW,
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: [
        `arn:aws:ses:us-east-1:${this.account}:identity/aisentinels.io`,
        `arn:aws:ses:us-east-1:${this.account}:identity/*@aisentinels.io`,
      ],
    }));

    // ── Legal routes (Phase 10) ─────────────────────────────────────────────
    const legalIntegration = new HttpLambdaIntegration('LegalIntegration', legalFn);

    this.httpApi.addRoutes({
      path: '/api/v1/legal/accept',
      methods: [HttpMethod.POST],
      integration: legalIntegration,
    });

    this.httpApi.addRoutes({
      path: '/api/v1/legal/status',
      methods: [HttpMethod.GET],
      integration: legalIntegration,
    });

    // Catch-all routes to internal ALB via VpcLink
    // API Gateway evaluates more-specific routes first:
    //   POST /api/v1/tenants/provision → Lambda (matched above)
    //   E7 document-studio + audit routes → Lambda (matched above)
    //   E8 CAPA + records routes → Lambda (matched above)
    //   E9 billing routes → Lambda (matched above)
    //   Phase 1 AI routes → Lambda (matched above)
    //   P3 settings + brain routes → Lambda (matched above)
    //   P6-D ghost trigger → Lambda (matched above)
    //   P8-B bulk upload → Lambda (matched above)
    //   P9-B board report → Lambda (matched above)
    //   P10 legal routes → Lambda (matched above)
    //   Everything else → ALB → Fargate service (path-based routing on ALB)
    //
    // IMPORTANT: Uses explicit methods instead of HttpMethod.ANY to avoid
    // catching OPTIONS preflight requests. HTTP API auto-CORS only responds
    // to OPTIONS when no route matches — ANY would hijack preflights and
    // send them through the JWT authorizer, causing 401 on CORS preflight.
    this.httpApi.addRoutes({
      path: '/api/v1/{proxy+}',
      methods: [HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT, HttpMethod.DELETE, HttpMethod.PATCH],
      integration: new HttpAlbIntegration('AlbProxyIntegration', props.albListener, {
        vpcLink: props.vpcLink,
      }),
    });

    // ══════════════════════════════════════════════════════════════════════════
    // SSM Parameters
    // ══════════════════════════════════════════════════════════════════════════
    new ssm.StringParameter(this, 'SsmApiEndpoint', {
      parameterName: `/aisentinels/${envName}/api/endpoint`,
      stringValue: this.httpApi.apiEndpoint,
    });
    new ssm.StringParameter(this, 'SsmApiId', {
      parameterName: `/aisentinels/${envName}/api/id`,
      stringValue: this.httpApi.apiId,
    });
    new ssm.StringParameter(this, 'SsmProvisionFnArn', {
      parameterName: `/aisentinels/${envName}/api/provisioning-fn-arn`,
      stringValue: provisionFn.functionArn,
    });
    // WAF SSM param removed — WAFv2 does not support HTTP API v2 (see WAF section above)

    // ══════════════════════════════════════════════════════════════════════════
    // CloudFormation Outputs
    // ══════════════════════════════════════════════════════════════════════════
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.httpApi.apiEndpoint,
      exportName: `aisentinels-${envName}-api-endpoint`,
      description: 'HTTP API Gateway endpoint URL',
    });
    new cdk.CfnOutput(this, 'ApiId', {
      value: this.httpApi.apiId,
      exportName: `aisentinels-${envName}-api-id`,
      description: 'HTTP API Gateway ID',
    });
    new cdk.CfnOutput(this, 'ProvisionFnArn', {
      value: provisionFn.functionArn,
      exportName: `aisentinels-${envName}-provision-fn-arn`,
      description: 'Tenant provisioning Lambda ARN',
    });
  }
}
