import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface NetworkStackProps extends cdk.StackProps {
  /** 'dev' | 'staging' | 'prod' */
  envName: string;
  /** Override VPC CIDR — defaults to 10.0.0.0/16 for prod */
  vpcCidr?: string;
}

export class NetworkStack extends cdk.Stack {
  // ── Public surface (consumed by downstream stacks) ──────────────────────
  public readonly vpc: ec2.Vpc;
  public readonly publicSubnets: ec2.ISubnet[];
  public readonly appSubnets: ec2.ISubnet[];
  public readonly dataSubnets: ec2.ISubnet[];
  public readonly sgAlb: ec2.SecurityGroup;
  public readonly sgFargate: ec2.SecurityGroup;
  public readonly sgOpenSearch: ec2.SecurityGroup;
  public readonly sgLambda: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const { envName, vpcCidr = '10.0.0.0/16' } = props;

    // ── Tag helper (adds project/env/stack to every resource) ───────────────
    const tag = (resource: Construct): void => {
      cdk.Tags.of(resource).add('project', 'aisentinels');
      cdk.Tags.of(resource).add('env', envName);
      cdk.Tags.of(resource).add('stack', 'network');
    };

    // ════════════════════════════════════════════════════════════════════════
    // VPC  — 3 AZs, 3 subnet tiers, 3 NAT Gateways (1 per AZ)
    // ════════════════════════════════════════════════════════════════════════
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `aisentinels-vpc-${envName}`,
      ipAddresses: ec2.IpAddresses.cidr(vpcCidr),
      availabilityZones: ['us-east-1a', 'us-east-1b', 'us-east-1c'],
      natGateways: 1, // Cost-optimized: single NAT pre-launch; bump to 3 when revenue starts
      subnetConfiguration: [
        {
          // Public: /24 each — ALB + NAT only, no compute
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
          mapPublicIpOnLaunch: false,
        },
        {
          // App: /23 each — ECS Fargate, Lambda (has internet via NAT)
          name: 'App',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 23,
        },
        {
          // Data: /24 each — Aurora, OpenSearch (fully isolated, no internet)
          name: 'Data',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });
    tag(this.vpc);

    // ════════════════════════════════════════════════════════════════════════
    // VPC Flow Logs  →  /aisentinels/vpc-flow
    // ════════════════════════════════════════════════════════════════════════
    const flowLogGroup = new logs.LogGroup(this, 'VpcFlowLogGroup', {
      logGroupName: '/aisentinels/vpc-flow',
      retention: logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    tag(flowLogGroup);

    const flowLogRole = new iam.Role(this, 'VpcFlowLogRole', {
      roleName: `aisentinels-vpc-flow-log-role-${envName}`,
      assumedBy: new iam.ServicePrincipal('vpc-flow-logs.amazonaws.com'),
      description: 'Allows VPC flow logs service to write to CloudWatch Logs',
    });
    tag(flowLogRole);

    const flowLog = new ec2.FlowLog(this, 'VpcFlowLog', {
      resourceType: ec2.FlowLogResourceType.fromVpc(this.vpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(flowLogGroup, flowLogRole),
      trafficType: ec2.FlowLogTrafficType.ALL,
    });
    tag(flowLog);

    // ════════════════════════════════════════════════════════════════════════
    // Gateway VPC Endpoints  —  S3, DynamoDB  (zero NAT cost for these)
    // ════════════════════════════════════════════════════════════════════════
    const s3GwEndpoint = this.vpc.addGatewayEndpoint('S3GatewayEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [
        { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });
    tag(s3GwEndpoint);

    const dynamoGwEndpoint = this.vpc.addGatewayEndpoint('DynamoDbGatewayEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
      subnets: [
        { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });
    tag(dynamoGwEndpoint);

    // ════════════════════════════════════════════════════════════════════════
    // Interface VPC Endpoints  —  eliminates NAT cost for AWS service calls
    // ════════════════════════════════════════════════════════════════════════
    const interfaceEndpointDefs: Array<{
      id: string;
      service: ec2.InterfaceVpcEndpointAwsService;
    }> = [
      {
        id: 'SecretsManagerEndpoint',
        service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      },
      {
        id: 'KmsEndpoint',
        service: ec2.InterfaceVpcEndpointAwsService.KMS,
      },
      {
        id: 'SsmEndpoint',
        service: ec2.InterfaceVpcEndpointAwsService.SSM,
      },
      {
        id: 'EcrApiEndpoint',
        service: ec2.InterfaceVpcEndpointAwsService.ECR,
      },
      {
        id: 'EcrDkrEndpoint',
        service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
      },
      {
        id: 'CloudWatchLogsEndpoint',
        service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      },
      {
        id: 'SqsEndpoint',
        service: ec2.InterfaceVpcEndpointAwsService.SQS,
      },
      {
        id: 'EventBridgeEndpoint',
        service: ec2.InterfaceVpcEndpointAwsService.EVENTBRIDGE,
      },
      {
        id: 'StepFunctionsEndpoint',
        service: ec2.InterfaceVpcEndpointAwsService.STEP_FUNCTIONS,
      },
    ];

    for (const { id, service } of interfaceEndpointDefs) {
      const ep = this.vpc.addInterfaceEndpoint(id, {
        service,
        // Place in App subnets — Fargate/Lambda call AWS APIs without hitting NAT
        subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        privateDnsEnabled: true,
      });
      tag(ep);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Security Groups  —  no ingress/egress rules yet
    //   Rules are added in ComputeStack (alb, fargate, lambda)
    //   and DataStack (aurora, opensearch)
    // ════════════════════════════════════════════════════════════════════════
    this.sgAlb = new ec2.SecurityGroup(this, 'SgAlb', {
      vpc: this.vpc,
      securityGroupName: `aisentinels-sg-alb-${envName}`,
      description: 'Internet-facing ALB -- ingress/egress rules added in ComputeStack',
      allowAllOutbound: false,
    });
    tag(this.sgAlb);
    cdk.Tags.of(this.sgAlb).add('Name', `aisentinels-sg-alb-${envName}`);

    this.sgFargate = new ec2.SecurityGroup(this, 'SgFargate', {
      vpc: this.vpc,
      securityGroupName: `aisentinels-sg-fargate-${envName}`,
      description: 'ECS Fargate tasks -- ingress/egress rules added in ComputeStack',
      allowAllOutbound: false,
    });
    tag(this.sgFargate);
    cdk.Tags.of(this.sgFargate).add('Name', `aisentinels-sg-fargate-${envName}`);

    // NOTE: sgAurora is created in DataStack (not here) to avoid the cyclic
    // cross-stack dependency that arises when DatabaseProxy L2 calls
    // cluster.connections.allowDefaultPortFrom() — which references Aurora's
    // Endpoint.Port token (DataStack) inside sgAurora (NetworkStack) → cycle.

    this.sgOpenSearch = new ec2.SecurityGroup(this, 'SgOpenSearch', {
      vpc: this.vpc,
      securityGroupName: `aisentinels-sg-opensearch-${envName}`,
      description: 'OpenSearch Serverless -- ingress/egress rules added in DataStack',
      allowAllOutbound: false,
    });
    tag(this.sgOpenSearch);
    cdk.Tags.of(this.sgOpenSearch).add('Name', `aisentinels-sg-opensearch-${envName}`);

    this.sgLambda = new ec2.SecurityGroup(this, 'SgLambda', {
      vpc: this.vpc,
      securityGroupName: `aisentinels-sg-lambda-${envName}`,
      description: 'Lambda functions -- ingress/egress rules added in ComputeStack',
      allowAllOutbound: false,
    });
    tag(this.sgLambda);
    cdk.Tags.of(this.sgLambda).add('Name', `aisentinels-sg-lambda-${envName}`);

    // ── Cache subnet arrays ─────────────────────────────────────────────────
    this.publicSubnets = this.vpc.selectSubnets({
      subnetType: ec2.SubnetType.PUBLIC,
    }).subnets;
    this.appSubnets = this.vpc.selectSubnets({
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    }).subnets;
    this.dataSubnets = this.vpc.selectSubnets({
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    }).subnets;

    // ════════════════════════════════════════════════════════════════════════
    // SSM Parameters  —  consumed by downstream stacks at deploy time
    // ════════════════════════════════════════════════════════════════════════
    new ssm.StringParameter(this, 'SsmVpcId', {
      parameterName: `/aisentinels/${envName}/network/vpc-id`,
      stringValue: this.vpc.vpcId,
      description: 'AI Sentinels VPC ID',
    });

    const sgDefinitions: Array<[string, string, ec2.SecurityGroup]> = [
      ['SsmSgAlb', 'sg-alb', this.sgAlb],
      ['SsmSgFargate', 'sg-fargate', this.sgFargate],
      ['SsmSgOpenSearch', 'sg-opensearch', this.sgOpenSearch],
      ['SsmSgLambda', 'sg-lambda', this.sgLambda],
    ];

    for (const [paramId, paramName, sg] of sgDefinitions) {
      new ssm.StringParameter(this, paramId, {
        parameterName: `/aisentinels/${envName}/network/${paramName}`,
        stringValue: sg.securityGroupId,
      });
    }

    const subnetGroups: Array<[string, ec2.ISubnet[]]> = [
      ['public', this.publicSubnets],
      ['app', this.appSubnets],
      ['data', this.dataSubnets],
    ];

    for (const [tier, subnets] of subnetGroups) {
      subnets.forEach((subnet, i) => {
        const cap = tier.charAt(0).toUpperCase() + tier.slice(1);
        new ssm.StringParameter(this, `Ssm${cap}Subnet${i}`, {
          parameterName: `/aisentinels/${envName}/network/subnet-${tier}-${i}`,
          stringValue: subnet.subnetId,
        });
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // CloudFormation Outputs  —  VPC ID, all subnet IDs, all SG IDs
    // ════════════════════════════════════════════════════════════════════════
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      exportName: `aisentinels-${envName}-vpc-id`,
      description: 'VPC ID',
    });

    this.publicSubnets.forEach((subnet, i) => {
      new cdk.CfnOutput(this, `PublicSubnetId${i}`, {
        value: subnet.subnetId,
        exportName: `aisentinels-${envName}-subnet-public-${i}`,
        description: `Public subnet ${i} -- AZ ${['us-east-1a', 'us-east-1b', 'us-east-1c'][i]} (ALB + NAT only)`,
      });
    });

    this.appSubnets.forEach((subnet, i) => {
      new cdk.CfnOutput(this, `AppSubnetId${i}`, {
        value: subnet.subnetId,
        exportName: `aisentinels-${envName}-subnet-app-${i}`,
        description: `App subnet ${i} -- AZ ${['us-east-1a', 'us-east-1b', 'us-east-1c'][i]} (Fargate, Lambda)`,
      });
    });

    this.dataSubnets.forEach((subnet, i) => {
      new cdk.CfnOutput(this, `DataSubnetId${i}`, {
        value: subnet.subnetId,
        exportName: `aisentinels-${envName}-subnet-data-${i}`,
        description: `Data subnet ${i} -- AZ ${['us-east-1a', 'us-east-1b', 'us-east-1c'][i]} (Aurora, OpenSearch -- no internet egress)`,
      });
    });

    new cdk.CfnOutput(this, 'SgAlbId', {
      value: this.sgAlb.securityGroupId,
      exportName: `aisentinels-${envName}-sg-alb`,
      description: 'Security Group ID -- ALB',
    });
    new cdk.CfnOutput(this, 'SgFargateId', {
      value: this.sgFargate.securityGroupId,
      exportName: `aisentinels-${envName}-sg-fargate`,
      description: 'Security Group ID -- ECS Fargate',
    });
    new cdk.CfnOutput(this, 'SgOpenSearchId', {
      value: this.sgOpenSearch.securityGroupId,
      exportName: `aisentinels-${envName}-sg-opensearch`,
      description: 'Security Group ID -- OpenSearch Serverless',
    });
    new cdk.CfnOutput(this, 'SgLambdaId', {
      value: this.sgLambda.securityGroupId,
      exportName: `aisentinels-${envName}-sg-lambda`,
      description: 'Security Group ID -- Lambda',
    });
  }
}
