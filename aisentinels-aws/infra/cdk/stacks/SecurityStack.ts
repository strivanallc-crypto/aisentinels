import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as guardduty from 'aws-cdk-lib/aws-guardduty';
import * as securityhub from 'aws-cdk-lib/aws-securityhub';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface SecurityStackProps extends cdk.StackProps {
  /** 'dev' | 'staging' | 'prod' */
  envName: string;
}

export class SecurityStack extends cdk.Stack {
  // ── Public surface (consumed by downstream stacks) ──────────────────────
  public readonly auroraKey: kms.Key;
  public readonly dynamoDbKey: kms.Key;
  public readonly cloudTrailKey: kms.Key;
  public readonly signingKey: kms.Key;
  /** Attach to every ECS task role and Lambda execution role */
  public readonly permissionBoundary: iam.ManagedPolicy;

  constructor(scope: Construct, id: string, props: SecurityStackProps) {
    super(scope, id, props);

    const { envName } = props;

    // ── Tag helper ───────────────────────────────────────────────────────────
    const tag = (resource: Construct): void => {
      cdk.Tags.of(resource).add('project', 'aisentinels');
      cdk.Tags.of(resource).add('env', envName);
      cdk.Tags.of(resource).add('stack', 'security');
    };

    // ════════════════════════════════════════════════════════════════════════
    // KMS Keys — all symmetric (except signing), 90-day rotation, 30-day
    // deletion window.
    //
    // NOTE: Per-tenant CMKs for S3 are NOT created here — they are created at
    // tenant onboarding time. See packages/shared/src/aws/kms.ts →
    // createTenantKey() for the runtime utility.
    // ════════════════════════════════════════════════════════════════════════

    // 1. Aurora CMK (symmetric)
    this.auroraKey = new kms.Key(this, 'AuroraKey', {
      alias: `alias/aisentinels-aurora-cmk-${envName}`,
      description: 'Symmetric CMK for Aurora Serverless v2 cluster encryption',
      enableKeyRotation: true,
      rotationPeriod: cdk.Duration.days(90),
      pendingWindow: cdk.Duration.days(30),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    tag(this.auroraKey);

    // 2. DynamoDB CMK (symmetric)
    this.dynamoDbKey = new kms.Key(this, 'DynamoDbKey', {
      alias: `alias/aisentinels-dynamodb-cmk-${envName}`,
      description: 'Symmetric CMK for DynamoDB table encryption',
      enableKeyRotation: true,
      rotationPeriod: cdk.Duration.days(90),
      pendingWindow: cdk.Duration.days(30),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    tag(this.dynamoDbKey);

    // 3. CloudTrail CMK (symmetric)
    this.cloudTrailKey = new kms.Key(this, 'CloudTrailKey', {
      alias: `alias/aisentinels-cloudtrail-cmk-${envName}`,
      description: 'Symmetric CMK for CloudTrail log encryption',
      enableKeyRotation: true,
      rotationPeriod: cdk.Duration.days(90),
      pendingWindow: cdk.Duration.days(30),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    tag(this.cloudTrailKey);

    // Allow CloudTrail service to use this key for encryption
    this.cloudTrailKey.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowCloudTrailEncrypt',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
        actions: ['kms:GenerateDataKey*'],
        resources: ['*'],
        conditions: {
          StringLike: {
            'kms:EncryptionContext:aws:cloudtrail:arn': `arn:aws:cloudtrail:*:${this.account}:trail/*`,
          },
        },
      }),
    );
    this.cloudTrailKey.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowCloudTrailDescribe',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
        actions: ['kms:DescribeKey'],
        resources: ['*'],
      }),
    );

    // Allow GuardDuty to use the cloudtrail key for publishing destination
    this.cloudTrailKey.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowGuardDutyEncrypt',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('guardduty.amazonaws.com')],
        actions: ['kms:GenerateDataKey', 'kms:Encrypt'],
        resources: ['*'],
      }),
    );

    // 4. Signing CMK — Asymmetric RSA-4096, SIGN_VERIFY only
    //    Key rotation is NOT supported for asymmetric keys.
    this.signingKey = new kms.Key(this, 'SigningKey', {
      alias: `alias/aisentinels-signing-cmk-${envName}`,
      description: 'Asymmetric RSA-4096 CMK for ISO e-signature SIGN_VERIFY operations',
      keySpec: kms.KeySpec.RSA_4096,
      keyUsage: kms.KeyUsage.SIGN_VERIFY,
      enableKeyRotation: false, // Not supported for asymmetric keys
      pendingWindow: cdk.Duration.days(30),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    tag(this.signingKey);

    // ════════════════════════════════════════════════════════════════════════
    // CloudTrail S3 bucket
    // ════════════════════════════════════════════════════════════════════════
    const trailBucket = new s3.Bucket(this, 'TrailBucket', {
      bucketName: `aisentinels-cloudtrail-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.cloudTrailKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'transition-to-glacier',
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(365),
            },
          ],
        },
      ],
    });
    tag(trailBucket);

    // CloudTrail requires specific bucket policies
    trailBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AWSCloudTrailAclCheck',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
        actions: ['s3:GetBucketAcl'],
        resources: [trailBucket.bucketArn],
      }),
    );
    trailBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AWSCloudTrailWrite',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
        actions: ['s3:PutObject'],
        resources: [`${trailBucket.bucketArn}/AWSLogs/${this.account}/*`],
        conditions: {
          StringEquals: { 's3:x-amz-acl': 'bucket-owner-full-control' },
        },
      }),
    );

    // ════════════════════════════════════════════════════════════════════════
    // CloudTrail — multi-region, file validation, management events + S3 data
    // ════════════════════════════════════════════════════════════════════════
    const trail = new cloudtrail.Trail(this, 'AuditTrail', {
      trailName: `aisentinels-audit-trail-${envName}`,
      bucket: trailBucket,
      encryptionKey: this.cloudTrailKey,
      isMultiRegionTrail: true,
      enableFileValidation: true,
      includeGlobalServiceEvents: true,
      managementEvents: cloudtrail.ReadWriteType.ALL,
      sendToCloudWatchLogs: true,
      cloudWatchLogsRetention: logs.RetentionDays.ONE_YEAR,
    });
    tag(trail);

    // S3 data events on compliance bucket — referenced by predicted name
    // (compliance bucket is created in StorageStack)
    trail.addS3EventSelector(
      [
        {
          bucket: s3.Bucket.fromBucketName(
            this,
            'ComplianceBucketRef',
            `aisentinels-compliance-evidence-${this.region}`,
          ),
        },
      ],
      { readWriteType: cloudtrail.ReadWriteType.ALL },
    );

    // ════════════════════════════════════════════════════════════════════════
    // GuardDuty — enable detector with 7-day finding export to S3
    // ════════════════════════════════════════════════════════════════════════
    const guardDutyFindingsBucket = new s3.Bucket(this, 'GuardDutyFindingsBucket', {
      bucketName: `aisentinels-guardduty-findings-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.cloudTrailKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      lifecycleRules: [
        {
          id: 'expire-findings',
          // Retain findings for 180 days (6 months) for compliance purposes
          expiration: cdk.Duration.days(180),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    tag(guardDutyFindingsBucket);

    // GuardDuty requires permission to write to the findings bucket
    guardDutyFindingsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowGuardDutyWrite',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('guardduty.amazonaws.com')],
        actions: ['s3:GetBucketLocation', 's3:PutObject'],
        resources: [
          guardDutyFindingsBucket.bucketArn,
          `${guardDutyFindingsBucket.bucketArn}/*`,
        ],
      }),
    );

    const guardDutyDetector = new guardduty.CfnDetector(this, 'GuardDutyDetector', {
      enable: true,
      // Publish new/updated findings every hour
      findingPublishingFrequency: 'ONE_HOUR',
      features: [
        { name: 'S3_DATA_EVENTS', status: 'ENABLED' },
        { name: 'EKS_AUDIT_LOGS', status: 'ENABLED' },
        { name: 'EBS_MALWARE_PROTECTION', status: 'ENABLED' },
        { name: 'RDS_LOGIN_EVENTS', status: 'ENABLED' },
        { name: 'LAMBDA_NETWORK_LOGS', status: 'ENABLED' },
      ],
    });
    tag(guardDutyDetector);

    // Export GuardDuty findings to S3
    // Explicit dependency: bucket policy + KMS key policy must propagate before
    // GuardDuty can validate access — CloudFormation race condition otherwise.
    const gdPublishingDest = new guardduty.CfnPublishingDestination(this, 'GuardDutyPublishingDestination', {
      detectorId: guardDutyDetector.ref, // Ref returns detector ID for AWS::GuardDuty::Detector
      destinationType: 'S3',
      destinationProperties: {
        destinationArn: guardDutyFindingsBucket.bucketArn,
        kmsKeyArn: this.cloudTrailKey.keyArn,
      },
    });
    gdPublishingDest.node.addDependency(guardDutyFindingsBucket);
    gdPublishingDest.node.addDependency(this.cloudTrailKey);

    // ════════════════════════════════════════════════════════════════════════
    // Security Hub — AWS Foundational Security Best Practices standard
    // SKIPPED: Security Hub already enabled manually on this account.
    // Import into CDK state later with `cdk import` if needed.
    // ════════════════════════════════════════════════════════════════════════
    // const securityHub = new securityhub.CfnHub(this, 'SecurityHub', {
    //   enableDefaultStandards: true, // Enables AWS FSBP + CIS AWS Foundations
    //   autoEnableControls: true,
    // });
    // tag(securityHub);

    // ════════════════════════════════════════════════════════════════════════
    // IAM Permission Boundary
    // Attach to ALL ECS task roles and Lambda execution roles.
    //
    // Logic:
    //   - DENY dangerous IAM/STS/EC2/RDS/S3 operations unconditionally
    //   - ALLOW everything else (effective permissions still constrained
    //     by the role's own identity policies — this is only the outer bound)
    //
    // Note: "except for defined role list" for sts:AssumeRole will be
    // tightened in ComputeStack when specific cross-service role ARNs are known.
    // ════════════════════════════════════════════════════════════════════════
    this.permissionBoundary = new iam.ManagedPolicy(this, 'PermissionBoundary', {
      managedPolicyName: `aisentinels-permission-boundary-${envName}`,
      description: 'Outer permission boundary for all AI Sentinels task and execution roles',
      statements: [
        new iam.PolicyStatement({
          sid: 'DenyDangerousOps',
          effect: iam.Effect.DENY,
          actions: [
            // Full IAM control — lateral privilege escalation vector
            'iam:*',
            // Role assumption — lateral movement vector
            'sts:AssumeRole',
            // Network infrastructure changes
            'ec2:*',
            // Destructive data-layer operations
            'rds:Delete*',
            // Bucket destruction
            's3:DeleteBucket',
          ],
          resources: ['*'],
        }),
        // Must include an explicit Allow for the boundary to have any effect.
        // The actual allowed actions are further constrained by the role's
        // own identity policies (intersection, not union).
        new iam.PolicyStatement({
          sid: 'AllowWorkloads',
          effect: iam.Effect.ALLOW,
          actions: ['*'],
          resources: ['*'],
        }),
      ],
    });
    tag(this.permissionBoundary);

    // ════════════════════════════════════════════════════════════════════════
    // SSM Parameters — consumed by downstream stacks at deploy time
    // ════════════════════════════════════════════════════════════════════════
    const ssmParams: Array<[string, string, string]> = [
      ['SsmAuroraKeyArn', 'kms-aurora-arn', this.auroraKey.keyArn],
      ['SsmDynamoDbKeyArn', 'kms-dynamodb-arn', this.dynamoDbKey.keyArn],
      ['SsmCloudTrailKeyArn', 'kms-cloudtrail-arn', this.cloudTrailKey.keyArn],
      ['SsmSigningKeyArn', 'kms-signing-arn', this.signingKey.keyArn],
      ['SsmPermBoundaryArn', 'permission-boundary-arn', this.permissionBoundary.managedPolicyArn],
      ['SsmTrailBucketName', 'cloudtrail-bucket', trailBucket.bucketName],
    ];

    for (const [id, name, value] of ssmParams) {
      new ssm.StringParameter(this, id, {
        parameterName: `/aisentinels/${envName}/security/${name}`,
        stringValue: value,
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // CloudFormation Outputs — all KMS key ARNs + ancillary resources
    // ════════════════════════════════════════════════════════════════════════
    new cdk.CfnOutput(this, 'AuroraKeyArn', {
      value: this.auroraKey.keyArn,
      exportName: `aisentinels-${envName}-kms-aurora-arn`,
      description: 'KMS CMK ARN -- Aurora Serverless v2 encryption',
    });
    new cdk.CfnOutput(this, 'DynamoDbKeyArn', {
      value: this.dynamoDbKey.keyArn,
      exportName: `aisentinels-${envName}-kms-dynamodb-arn`,
      description: 'KMS CMK ARN -- DynamoDB encryption',
    });
    new cdk.CfnOutput(this, 'CloudTrailKeyArn', {
      value: this.cloudTrailKey.keyArn,
      exportName: `aisentinels-${envName}-kms-cloudtrail-arn`,
      description: 'KMS CMK ARN -- CloudTrail log encryption',
    });
    new cdk.CfnOutput(this, 'SigningKeyArn', {
      value: this.signingKey.keyArn,
      exportName: `aisentinels-${envName}-kms-signing-arn`,
      description: 'KMS CMK ARN -- Asymmetric RSA-4096 for ISO e-signatures',
    });
    new cdk.CfnOutput(this, 'PermissionBoundaryArn', {
      value: this.permissionBoundary.managedPolicyArn,
      exportName: `aisentinels-${envName}-permission-boundary-arn`,
      description: 'IAM Permission Boundary -- attach to all task/execution roles',
    });
    new cdk.CfnOutput(this, 'TrailBucketName', {
      value: trailBucket.bucketName,
      exportName: `aisentinels-${envName}-cloudtrail-bucket`,
      description: 'CloudTrail S3 bucket name',
    });
    new cdk.CfnOutput(this, 'GuardDutyDetectorId', {
      value: guardDutyDetector.ref,
      exportName: `aisentinels-${envName}-guardduty-detector-id`,
      description: 'GuardDuty Detector ID',
    });
  }
}
