import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface StorageStackProps extends cdk.StackProps {
  /** 'dev' | 'staging' | 'prod' */
  envName: string;
  /**
   * Aurora CMK from SecurityStack.
   * Used for SSE-KMS on compliance bucket and working-files bucket.
   */
  auroraKey: kms.IKey;
}

export class StorageStack extends cdk.Stack {
  // ── Public surface ────────────────────────────────────────────────────────
  public readonly complianceBucket: s3.Bucket;
  public readonly workingFilesBucket: s3.Bucket;
  public readonly exportsBucket: s3.Bucket;
  public readonly logsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const { envName, auroraKey } = props;

    const tag = (resource: Construct): void => {
      cdk.Tags.of(resource).add('project', 'aisentinels');
      cdk.Tags.of(resource).add('env', envName);
      cdk.Tags.of(resource).add('stack', 'storage');
    };

    // ════════════════════════════════════════════════════════════════════════
    // Bucket 4 — S3 access-log destination (created first; used by others)
    // ════════════════════════════════════════════════════════════════════════
    this.logsBucket = new s3.Bucket(this, 'LogsBucket', {
      bucketName: `aisentinels-s3-logs-${this.account}-${this.region}`,
      // BUCKET_OWNER_PREFERRED is required for S3 server access log delivery
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'expire-logs-after-1yr',
          expiration: cdk.Duration.days(365),
        },
      ],
    });
    tag(this.logsBucket);

    // ════════════════════════════════════════════════════════════════════════
    // Bucket 1 — Compliance Evidence
    //   Object Lock COMPLIANCE 7 years | SSE-KMS (auroraKey) | CRR → eu-west-1
    //
    // ⚠  The explicit DENY on s3:PutBucketPolicy makes this bucket policy
    //    immutable after first deployment — even root cannot modify it.
    //    Ensure the initial policy is exactly correct before deploying to prod.
    // ════════════════════════════════════════════════════════════════════════
    this.complianceBucket = new s3.Bucket(this, 'ComplianceBucket', {
      bucketName: `aisentinels-compliance-evidence-${this.region}`,
      versioned: true, // Mandatory prerequisite for Object Lock
      objectLockEnabled: true,
      objectLockDefaultRetention: s3.ObjectLockRetention.compliance(
        cdk.Duration.days(2555), // 7 years (365 × 7)
      ),
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: auroraKey,
      bucketKeyEnabled: true, // Reduces KMS API calls (cost optimisation)
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      serverAccessLogsBucket: this.logsBucket,
      serverAccessLogsPrefix: 'compliance-evidence/',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'compliance-tiering',
          transitions: [
            {
              // STANDARD → STANDARD_IA at 90 days
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(90),
            },
            {
              // STANDARD_IA → GLACIER Instant Retrieval at 365 days
              storageClass: s3.StorageClass.GLACIER_INSTANT_RETRIEVAL,
              transitionAfter: cdk.Duration.days(365),
            },
          ],
        },
      ],
    });
    tag(this.complianceBucket);

    // ── Compliance bucket explicit DENY policy ──────────────────────────────
    // Spec: DENY DeleteObject, DeleteObjectVersion, PutBucketPolicy for all
    // principals (including root). Combined with Object Lock, this creates a
    // truly immutable evidence store.
    this.complianceBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'DenyDestructiveOpsOnComplianceEvidence',
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: [
          's3:DeleteObject',
          's3:DeleteObjectVersion',
          's3:PutBucketPolicy',
        ],
        resources: [
          this.complianceBucket.bucketArn,
          this.complianceBucket.arnForObjects('*'),
        ],
      }),
    );

    // ── Cross-Region Replication → eu-west-1 ────────────────────────────────
    const replicationRole = new iam.Role(this, 'ReplicationRole', {
      roleName: `aisentinels-s3-replication-${envName}`,
      assumedBy: new iam.ServicePrincipal('s3.amazonaws.com'),
      description: 'Allows S3 to replicate compliance evidence to eu-west-1',
    });
    tag(replicationRole);

    // Source read + KMS decrypt (needed to read encrypted objects for replication)
    this.complianceBucket.grantRead(replicationRole);
    auroraKey.grantDecrypt(replicationRole);

    // Destination write permissions
    replicationRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AllowReplicateToEUWest1',
        actions: [
          's3:ReplicateObject',
          's3:ReplicateDelete',
          's3:ReplicateTags',
          's3:GetObjectVersionTagging',
        ],
        resources: ['arn:aws:s3:::aisentinels-compliance-evidence-eu-west-1/*'],
      }),
    );
    replicationRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AllowDestBucketVersioning',
        actions: ['s3:GetBucketVersioning', 's3:PutBucketVersioning'],
        resources: ['arn:aws:s3:::aisentinels-compliance-evidence-eu-west-1'],
      }),
    );

    // Attach replication configuration via CfnBucket escape hatch
    // (L2 Bucket does not expose ReplicationConfiguration natively)
    const cfnCompliance = this.complianceBucket.node.defaultChild as s3.CfnBucket;
    cfnCompliance.replicationConfiguration = {
      role: replicationRole.roleArn,
      rules: [
        {
          id: 'ReplicateAllToEUWest1',
          status: 'Enabled',
          priority: 1, // V2 schema — required with filter + deleteMarkerReplication
          filter: { prefix: '' }, // V2 schema — required for deleteMarkerReplication
          deleteMarkerReplication: { status: 'Enabled' },
          destination: {
            bucket: 'arn:aws:s3:::aisentinels-compliance-evidence-eu-west-1',
            storageClass: 'STANDARD_IA',
          },
        },
      ],
    };

    // ════════════════════════════════════════════════════════════════════════
    // Bucket 2 — Working Files  (SSE-KMS, versioned, 90-day noncurrent TTL)
    // ════════════════════════════════════════════════════════════════════════
    this.workingFilesBucket = new s3.Bucket(this, 'WorkingFilesBucket', {
      bucketName: `aisentinels-working-files-${this.region}`,
      versioned: true,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: auroraKey,
      bucketKeyEnabled: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'expire-noncurrent-versions',
          noncurrentVersionExpiration: cdk.Duration.days(90),
        },
      ],
    });
    tag(this.workingFilesBucket);

    // ════════════════════════════════════════════════════════════════════════
    // Bucket 3 — Exports  (SSE-S3, no versioning, 30-day TTL)
    // ════════════════════════════════════════════════════════════════════════
    this.exportsBucket = new s3.Bucket(this, 'ExportsBucket', {
      bucketName: `aisentinels-exports-${this.region}`,
      versioned: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true, // Safe: 30-day TTL keeps no long-lived objects
      lifecycleRules: [
        {
          id: 'expire-exports-30d',
          expiration: cdk.Duration.days(30),
        },
      ],
    });
    tag(this.exportsBucket);

    // ════════════════════════════════════════════════════════════════════════
    // SSM Parameters — consumed by downstream stacks at deploy time
    // ════════════════════════════════════════════════════════════════════════
    const bucketDefs: Array<[string, string, s3.IBucket]> = [
      ['SsmCompliance', 'compliance-bucket', this.complianceBucket],
      ['SsmWorkingFiles', 'working-files-bucket', this.workingFilesBucket],
      ['SsmExports', 'exports-bucket', this.exportsBucket],
      ['SsmLogs', 'logs-bucket', this.logsBucket],
    ];

    for (const [id, name, bucket] of bucketDefs) {
      new ssm.StringParameter(this, `${id}Name`, {
        parameterName: `/aisentinels/${envName}/storage/${name}`,
        stringValue: bucket.bucketName,
      });
      new ssm.StringParameter(this, `${id}Arn`, {
        parameterName: `/aisentinels/${envName}/storage/${name}-arn`,
        stringValue: bucket.bucketArn,
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // CloudFormation Outputs — all bucket ARNs and names
    // ════════════════════════════════════════════════════════════════════════
    new cdk.CfnOutput(this, 'ComplianceBucketName', {
      value: this.complianceBucket.bucketName,
      exportName: `aisentinels-${envName}-compliance-bucket`,
      description: 'Compliance evidence bucket (Object Lock COMPLIANCE 7yr)',
    });
    new cdk.CfnOutput(this, 'ComplianceBucketArn', {
      value: this.complianceBucket.bucketArn,
      exportName: `aisentinels-${envName}-compliance-bucket-arn`,
    });
    new cdk.CfnOutput(this, 'WorkingFilesBucketName', {
      value: this.workingFilesBucket.bucketName,
      exportName: `aisentinels-${envName}-working-files-bucket`,
      description: 'Working files bucket (SSE-KMS, versioned)',
    });
    new cdk.CfnOutput(this, 'WorkingFilesBucketArn', {
      value: this.workingFilesBucket.bucketArn,
      exportName: `aisentinels-${envName}-working-files-bucket-arn`,
    });
    new cdk.CfnOutput(this, 'ExportsBucketName', {
      value: this.exportsBucket.bucketName,
      exportName: `aisentinels-${envName}-exports-bucket`,
      description: 'Exports bucket (SSE-S3, 30-day TTL)',
    });
    new cdk.CfnOutput(this, 'ExportsBucketArn', {
      value: this.exportsBucket.bucketArn,
      exportName: `aisentinels-${envName}-exports-bucket-arn`,
    });
    new cdk.CfnOutput(this, 'LogsBucketName', {
      value: this.logsBucket.bucketName,
      exportName: `aisentinels-${envName}-logs-bucket`,
      description: 'S3 server access log destination',
    });
  }
}
