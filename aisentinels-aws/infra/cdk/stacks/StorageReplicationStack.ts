/**
 * StorageReplicationStack — deploys to eu-west-1
 *
 * Creates the CRR (Cross-Region Replication) destination bucket for
 * aisentinels-compliance-evidence-us-east-1.
 *
 * Deploy BEFORE StorageStack so the destination bucket exists when the
 * replication configuration first activates.
 */
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface StorageReplicationStackProps extends cdk.StackProps {
  /** 'dev' | 'staging' | 'prod' */
  envName: string;
}

export class StorageReplicationStack extends cdk.Stack {
  public readonly destinationBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageReplicationStackProps) {
    super(scope, id, props);

    const { envName } = props;

    const tag = (resource: Construct): void => {
      cdk.Tags.of(resource).add('project', 'aisentinels');
      cdk.Tags.of(resource).add('env', envName);
      cdk.Tags.of(resource).add('stack', 'storage-replication');
    };

    // ════════════════════════════════════════════════════════════════════════
    // Destination bucket (eu-west-1) — mirrors compliance-evidence us-east-1
    //
    // Encryption: SSE-S3 here (eu-west-1 KMS CMK added in Epic 6 hardening).
    // Object Lock: COMPLIANCE mode, matching source retention of 7 years.
    // ════════════════════════════════════════════════════════════════════════
    this.destinationBucket = new s3.Bucket(this, 'ComplianceBucketEu', {
      bucketName: 'aisentinels-compliance-evidence-eu-west-1',
      versioned: true, // Required for CRR and Object Lock
      objectLockEnabled: true,
      objectLockDefaultRetention: s3.ObjectLockRetention.compliance(
        cdk.Duration.days(2555), // 7 years — matches source bucket
      ),
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'compliance-tiering-eu',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(90),
            },
            {
              storageClass: s3.StorageClass.GLACIER_INSTANT_RETRIEVAL,
              transitionAfter: cdk.Duration.days(365),
            },
          ],
        },
      ],
    });
    tag(this.destinationBucket);

    // Allow S3 replication service to write replicated objects
    this.destinationBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowS3ReplicationServiceWrite',
        principals: [new iam.ServicePrincipal('s3.amazonaws.com')],
        actions: [
          's3:ReplicateObject',
          's3:ReplicateDelete',
          's3:ReplicateTags',
          's3:GetObjectVersionTagging',
          's3:ObjectOwnerOverrideToBucketOwner',
        ],
        resources: [this.destinationBucket.arnForObjects('*')],
      }),
    );

    // Mirror the same destructive-ops DENY from the source bucket
    this.destinationBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'DenyDestructiveOps',
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: [
          's3:DeleteObject',
          's3:DeleteObjectVersion',
          's3:PutBucketPolicy',
        ],
        resources: [
          this.destinationBucket.bucketArn,
          this.destinationBucket.arnForObjects('*'),
        ],
      }),
    );

    new cdk.CfnOutput(this, 'DestinationBucketArn', {
      value: this.destinationBucket.bucketArn,
      exportName: `aisentinels-${envName}-compliance-bucket-eu-west-1-arn`,
      description: 'CRR destination bucket ARN (eu-west-1)',
    });
    new cdk.CfnOutput(this, 'DestinationBucketName', {
      value: this.destinationBucket.bucketName,
      exportName: `aisentinels-${envName}-compliance-bucket-eu-west-1`,
    });
  }
}
