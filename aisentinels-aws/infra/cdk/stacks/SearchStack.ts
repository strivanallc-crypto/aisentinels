/**
 * SearchStack — E5
 *
 * Provisions OpenSearch Serverless (AOSS) for vector k-NN search:
 *   • AOSS VPC Endpoint (aws-opensearchserverless CfnVpcEndpoint, NOT aws-ec2.InterfaceVpcEndpoint)
 *   • Encryption policy (AWS-owned CMK — add customer CMK in hardening epic)
 *   • Network policy (VPC-only access via VPC endpoint, AllowFromPublic: false)
 *   • Collection (VECTORSEARCH type)
 *   • Data access policy (AiOrchestrator task role — ARN from naming convention, no circular dep)
 *
 * Cross-stack reference: SearchStack constructs the AiOrchestrator task role ARN from naming
 * convention (aisentinels-ai-orchestrator-task-{envName}) — no import from ComputeStack needed.
 * ComputeStack receives collectionEndpoint + collectionArn as props and adds a dependency.
 *
 * CF creation order requirement:
 *   encryptionPolicy → collection
 *   networkPolicy    → collection
 * Enforced via collection.addDependency() calls.
 */
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as aoss from 'aws-cdk-lib/aws-opensearchserverless';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface SearchStackProps extends cdk.StackProps {
  /** 'dev' | 'staging' | 'prod' */
  envName: string;
  /** VPC from NetworkStack */
  vpc: ec2.IVpc;
  /** App-tier subnets — AOSS VPC endpoint and collection live in the app tier */
  appSubnets: ec2.ISubnet[];
  /** Fargate security group — AOSS VPC endpoint is associated with this SG */
  sgFargate: ec2.ISecurityGroup;
}

export class SearchStack extends cdk.Stack {
  /** AOSS collection data endpoint — CloudFormation token, resolves at deploy time */
  public readonly collectionEndpoint: string;
  /** AOSS collection ARN */
  public readonly collectionArn: string;

  constructor(scope: Construct, id: string, props: SearchStackProps) {
    super(scope, id, props);

    const { envName } = props;

    // ══════════════════════════════════════════════════════════════════════════
    // AOSS VPC Endpoint
    //
    // aws-opensearchserverless CfnVpcEndpoint — NOT aws-ec2.InterfaceVpcEndpoint.
    // Resource type: AWS::OpenSearchServerless::VpcEndpoint
    // This creates an AOSS-specific private endpoint accessible from the app subnets.
    // ══════════════════════════════════════════════════════════════════════════
    const vpcEndpoint = new aoss.CfnVpcEndpoint(this, 'AossVpcEndpoint', {
      name: `aisentinels-aoss-${envName}`,      // max 32 chars; aisentinels-aoss-prod = 20 ✓
      vpcId: props.vpc.vpcId,
      subnetIds: props.appSubnets.map((s) => s.subnetId),
      securityGroupIds: [props.sgFargate.securityGroupId],
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Encryption policy — must exist BEFORE collection creation (CF dependency)
    // ══════════════════════════════════════════════════════════════════════════
    const encryptionPolicy = new aoss.CfnSecurityPolicy(this, 'EncryptionPolicy', {
      name: `aisentinels-${envName}-enc`,        // max 32 chars; aisentinels-prod-enc = 20 ✓
      type: 'encryption',
      policy: JSON.stringify({
        Rules: [
          {
            Resource: [`collection/aisentinels-${envName}`],
            ResourceType: 'collection',
          },
        ],
        AWSOwnedKey: true,   // AWS-owned CMK — add customer CMK in hardening epic
      }),
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Network policy — private VPC access only.
    // SourceVPCEs references the AOSS VpcEndpoint by ID (vpcEndpoint.ref).
    // AllowFromPublic: false — collection not accessible from the internet.
    // ══════════════════════════════════════════════════════════════════════════
    const networkPolicy = new aoss.CfnSecurityPolicy(this, 'NetworkPolicy', {
      name: `aisentinels-${envName}-net`,        // max 32 chars; aisentinels-prod-net = 20 ✓
      type: 'network',
      policy: JSON.stringify([
        {
          Rules: [
            {
              Resource: [`collection/aisentinels-${envName}`],
              ResourceType: 'collection',
            },
            {
              Resource: [`index/aisentinels-${envName}/*`],
              ResourceType: 'dashboard',
            },
          ],
          AllowFromPublic: false,
          SourceVPCEs: [vpcEndpoint.ref],   // ref = VPC endpoint ID, resolved by CF
        },
      ]),
    });

    // ══════════════════════════════════════════════════════════════════════════
    // AOSS Collection — VECTORSEARCH type
    //
    // addDependency() is mandatory:  CloudFormation will fail if policies don't
    // exist when the collection is created.
    // ══════════════════════════════════════════════════════════════════════════
    const collection = new aoss.CfnCollection(this, 'Collection', {
      name: `aisentinels-${envName}`,            // max 32 chars; aisentinels-prod = 16 ✓
      type: 'VECTORSEARCH',
      description: `AI Sentinels vector search [${envName}]`,
    });
    collection.addDependency(encryptionPolicy);
    collection.addDependency(networkPolicy);

    this.collectionEndpoint = collection.attrCollectionEndpoint;
    this.collectionArn = collection.attrArn;

    // ══════════════════════════════════════════════════════════════════════════
    // Data access policy
    //
    // Grants AiOrchestrator task role full index read/write access.
    // The task role ARN is constructed from the naming convention used in ComputeStack
    // (aisentinels-ai-orchestrator-task-{envName}) — no import from ComputeStack required.
    // this.account is concrete (CDK_DEFAULT_ACCOUNT is always set in this project).
    // ══════════════════════════════════════════════════════════════════════════
    const aiOrchestratorRoleArn =
      `arn:aws:iam::${this.account}:role/aisentinels-ai-orchestrator-task-${envName}`;

    new aoss.CfnAccessPolicy(this, 'AccessPolicy', {
      name: `aisentinels-${envName}-data`,       // max 32 chars; aisentinels-prod-data = 21 ✓
      type: 'data',
      policy: JSON.stringify([
        {
          Description: `ai-orchestrator read/write access [${envName}]`,
          Principal: [aiOrchestratorRoleArn],
          Rules: [
            {
              Resource: [`collection/aisentinels-${envName}`],
              Permission: [
                'aoss:CreateCollectionItems',
                'aoss:DeleteCollectionItems',
                'aoss:UpdateCollectionItems',
                'aoss:DescribeCollectionItems',
              ],
              ResourceType: 'collection',
            },
            {
              Resource: [`index/aisentinels-${envName}/*`],
              Permission: [
                'aoss:CreateIndex',
                'aoss:DeleteIndex',
                'aoss:UpdateIndex',
                'aoss:DescribeIndex',
                'aoss:ReadDocument',
                'aoss:WriteDocument',
              ],
              ResourceType: 'index',
            },
          ],
        },
      ]),
    });

    // ══════════════════════════════════════════════════════════════════════════
    // SSM Parameters
    // ══════════════════════════════════════════════════════════════════════════
    new ssm.StringParameter(this, 'SsmAossEndpoint', {
      parameterName: `/aisentinels/${envName}/search/aoss-endpoint`,
      stringValue: this.collectionEndpoint,
    });
    new ssm.StringParameter(this, 'SsmAossArn', {
      parameterName: `/aisentinels/${envName}/search/aoss-arn`,
      stringValue: this.collectionArn,
    });

    // ══════════════════════════════════════════════════════════════════════════
    // CloudFormation Outputs
    // ══════════════════════════════════════════════════════════════════════════
    new cdk.CfnOutput(this, 'AossEndpoint', {
      value: this.collectionEndpoint,
      exportName: `aisentinels-${envName}-aoss-endpoint`,
      description: 'AOSS collection data endpoint',
    });
    new cdk.CfnOutput(this, 'AossArn', {
      value: this.collectionArn,
      exportName: `aisentinels-${envName}-aoss-arn`,
      description: 'AOSS collection ARN',
    });
  }
}
