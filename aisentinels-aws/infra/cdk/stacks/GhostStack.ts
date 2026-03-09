/**
 * GhostStack — P6-B
 *
 * Deploys Ghost Sentinel (Sentinel 7) — the autonomous ISO SEO Content Engine.
 *
 * Resources:
 *   • 1 NodejsFunction Lambda (512MB, 300s timeout, VPC-attached, Node 22)
 *   • 1 EventBridge weekly schedule rule (Monday 04:00 UTC, ENABLED)
 *   • 1 SQS Dead Letter Queue (14d retention)
 *   • IAM grants: SSM read (Perplexity + Anthropic keys), RDS Proxy IAM connect
 *   • CloudWatch log group (30d retention)
 *
 * Pipeline:
 *   EventBridge → Ghost Lambda → Perplexity (research) → Claude (generate) → Aurora (store)
 */
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';

export interface GhostStackProps extends cdk.StackProps {
  /** 'dev' | 'staging' | 'prod' */
  envName: string;
  /** VPC from NetworkStack */
  vpc: ec2.IVpc;
  /** App-tier subnets from NetworkStack (Ghost Lambda runs here) */
  appSubnets: ec2.ISubnet[];
  /** Lambda security group from NetworkStack */
  sgLambda: ec2.ISecurityGroup;
  /** RDS Proxy hostname — from DataStack.auroraProxy.endpoint */
  auroraProxyEndpoint: string;
}

export class GhostStack extends cdk.Stack {
  public readonly ghostFn: NodejsFunction;

  constructor(scope: Construct, id: string, props: GhostStackProps) {
    super(scope, id, props);

    const { envName, appSubnets, sgLambda } = props;

    const tag = (resource: Construct): void => {
      cdk.Tags.of(resource).add('project', 'aisentinels');
      cdk.Tags.of(resource).add('env', envName);
      cdk.Tags.of(resource).add('stack', 'ghost');
    };

    // ── Monorepo root is 4 levels up from stacks/ ────────────────────────────
    const repoRoot = path.join(__dirname, '../../../../');

    // ── postgres install hook ──────────────────────────────────────────────────
    // postgres.js is ESM-first. esbuild CJS bundling breaks parsers init order.
    // Fix: OutputFormat.ESM + afterBundling installs postgres npm package and
    // sets "type": "module" so Lambda treats the .js file as ESM.
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

    // ── DynamoDB audit events table name ──────────────────────────────────────
    const auditEventsTableName = `aisentinels-audit-events-${envName}`;

    // ══════════════════════════════════════════════════════════════════════════
    // CloudWatch Log Group — 30 day retention
    // ══════════════════════════════════════════════════════════════════════════
    const logGroup = new logs.LogGroup(this, 'GhostLogGroup', {
      logGroupName: '/aisentinels/ghost',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    tag(logGroup);

    // ══════════════════════════════════════════════════════════════════════════
    // Ghost Lambda
    //
    // - Runtime: Node 22 (matches all existing Lambdas)
    // - Memory: 512MB (Perplexity research + Claude generation needs headroom)
    // - Timeout: 300s (Perplexity 30s + Claude generation 60s + DB + buffer)
    // - VPC: same app subnets + sg-lambda as other business Lambdas
    // - Entry: packages/ghost/src/index.ts
    // - Bundling: ESM + postgres install hook (matches ApiStack pattern)
    // ══════════════════════════════════════════════════════════════════════════
    this.ghostFn = new NodejsFunction(this, 'GhostFn', {
      functionName: `aisentinels-ghost-${envName}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(repoRoot, 'packages/ghost/src/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(300),
      memorySize: 512,
      // VPC-attached — reaches RDS Proxy + external APIs via NAT
      vpc: props.vpc,
      vpcSubnets: { subnets: appSubnets as ec2.ISubnet[] },
      securityGroups: [sgLambda] as ec2.ISecurityGroup[],
      allowPublicSubnet: false,
      environment: {
        NODE_ENV: 'production',
        ENV_NAME: envName,
        AURORA_PROXY_ENDPOINT: props.auroraProxyEndpoint,
        AURORA_DB_USER: 'postgres',
        AURORA_DB_NAME: 'aisentinels',
        AURORA_IAM_AUTH: 'true',
        AUDIT_EVENTS_TABLE_NAME: auditEventsTableName,
        NOTIFICATIONS_FROM_EMAIL: 'notifications@aisentinels.io',
        SES_REGION: 'us-east-1',
      },
      logGroup,
      bundling: {
        minify: true,
        target: 'node22',
        format: OutputFormat.ESM,
        externalModules: ['@aws-sdk/*', 'postgres'] as string[],
        commandHooks: postgresInstallHook,
      },
    });
    tag(this.ghostFn);

    // ══════════════════════════════════════════════════════════════════════════
    // IAM Grants
    // ══════════════════════════════════════════════════════════════════════════

    // RDS Proxy IAM auth — connect to Aurora via proxy
    this.ghostFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'AllowRdsProxyIam',
      actions: ['rds-db:connect'],
      resources: [`arn:aws:rds-db:${this.region}:${this.account}:dbuser:*/*`],
    }));

    // SSM read — Perplexity API key
    this.ghostFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'GhostPerplexitySSM',
      effect: iam.Effect.ALLOW,
      actions: ['ssm:GetParameter'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/aisentinels/${envName}/ghost/*`,
      ],
    }));

    // SSM read — Anthropic API key (shared path /aisentinels/{env}/ai/*)
    this.ghostFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'GhostAnthropicSSM',
      effect: iam.Effect.ALLOW,
      actions: ['ssm:GetParameter'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/aisentinels/${envName}/ai/*`,
      ],
    }));

    // KMS decrypt — SSM SecureString uses AWS-managed key
    this.ghostFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'DecryptSSMSecrets',
      actions: ['kms:Decrypt'],
      resources: ['*'],
      conditions: {
        StringEquals: { 'kms:ViaService': `ssm.${this.region}.amazonaws.com` },
      },
    }));

    // SES: send ghost-post-published notification emails (Phase 10)
    this.ghostFn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'GhostSESSend',
      effect: iam.Effect.ALLOW,
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: [
        `arn:aws:ses:us-east-1:${this.account}:identity/aisentinels.io`,
        `arn:aws:ses:us-east-1:${this.account}:identity/*@aisentinels.io`,
      ],
    }));

    // ══════════════════════════════════════════════════════════════════════════
    // DLQ for failed Ghost runs
    // Matches EventStack DLQ pattern: 14d retention, SQS-managed encryption
    // ══════════════════════════════════════════════════════════════════════════
    const ghostDlq = new sqs.Queue(this, 'GhostDLQ', {
      queueName: 'aisentinels-ghost-dlq',
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });
    tag(ghostDlq);

    // ══════════════════════════════════════════════════════════════════════════
    // EventBridge Rule — Monday 04:00 UTC weekly schedule
    //
    // cron(Minutes Hours Day-of-month Month Day-of-week Year)
    // ENABLED from deploy — Ghost is active immediately.
    // ══════════════════════════════════════════════════════════════════════════
    const weeklyRule = new events.Rule(this, 'GhostWeeklyRule', {
      ruleName: 'aisentinels-ghost-weekly',
      description: 'Ghost Sentinel — weekly ISO blog post generation (Monday 04:00 UTC)',
      enabled: true,
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '4',
        weekDay: 'MON',
        month: '*',
        year: '*',
      }),
    });

    weeklyRule.addTarget(new targets.LambdaFunction(this.ghostFn, {
      retryAttempts: 1,
      deadLetterQueue: ghostDlq,
    }));

    // ══════════════════════════════════════════════════════════════════════════
    // CloudFormation Outputs
    // ══════════════════════════════════════════════════════════════════════════
    new cdk.CfnOutput(this, 'GhostFnArn', {
      value: this.ghostFn.functionArn,
      exportName: `aisentinels-${envName}-ghost-fn-arn`,
      description: 'Ghost Sentinel Lambda ARN',
    });

    new cdk.CfnOutput(this, 'GhostWeeklyRuleArn', {
      value: weeklyRule.ruleArn,
      exportName: `aisentinels-${envName}-ghost-weekly-rule-arn`,
      description: 'EventBridge weekly schedule rule ARN',
    });

    new cdk.CfnOutput(this, 'GhostDLQUrl', {
      value: ghostDlq.queueUrl,
      exportName: `aisentinels-${envName}-ghost-dlq-url`,
      description: 'Ghost DLQ URL for failed run monitoring',
    });
  }
}
