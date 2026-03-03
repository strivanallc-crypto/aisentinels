import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface DataStackProps extends cdk.StackProps {
  /** 'dev' | 'staging' | 'prod' */
  envName: string;
  /** VPC from NetworkStack */
  vpc: ec2.IVpc;
  /**
   * sg-fargate from NetworkStack.
   * Used as ingress source for Aurora/Redis rules (CfnSecurityGroupIngress,
   * no L2 connections calls → no cyclic dependency).
   */
  sgFargate: ec2.ISecurityGroup;
  /**
   * sg-lambda from NetworkStack.
   * Same as sgFargate — ingress source only, no L2 connections calls.
   */
  sgLambda: ec2.ISecurityGroup;
  /** Aurora CMK from SecurityStack */
  auroraKey: kms.IKey;
  /** DynamoDB CMK from SecurityStack */
  dynamoDbKey: kms.IKey;
}

export class DataStack extends cdk.Stack {
  // ── Public surface ────────────────────────────────────────────────────────
  public readonly sgAurora: ec2.SecurityGroup;
  public readonly auroraCluster: rds.DatabaseCluster;
  public readonly auroraProxy: rds.DatabaseProxy;
  public readonly auditEventsTable: dynamodb.Table;
  public readonly sessionsTable: dynamodb.Table;
  public readonly redisCluster: elasticache.CfnReplicationGroup;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const { envName, vpc, sgFargate, sgLambda, auroraKey, dynamoDbKey } = props;
    const isProd = envName === 'prod';

    const tag = (resource: Construct): void => {
      cdk.Tags.of(resource).add('project', 'aisentinels');
      cdk.Tags.of(resource).add('env', envName);
      cdk.Tags.of(resource).add('stack', 'data');
    };

    // ════════════════════════════════════════════════════════════════════════
    // sgAurora — owned by DataStack (NOT NetworkStack)
    //
    // Aurora and its proxy must own their SG within this stack so that CDK's
    // L2 constructs (DatabaseProxy, HostedRotation) can call
    // connections.allowDefaultPortFrom() without creating a cross-stack
    // reference (Network → DataStack.Aurora.Endpoint.Port) that would cycle.
    // ════════════════════════════════════════════════════════════════════════
    this.sgAurora = new ec2.SecurityGroup(this, 'SgAurora', {
      vpc,
      securityGroupName: `aisentinels-sg-aurora-${envName}`,
      description: 'Aurora PostgreSQL + RDS Proxy -- owned by DataStack',
      allowAllOutbound: false,
    });
    tag(this.sgAurora);
    cdk.Tags.of(this.sgAurora).add('Name', `aisentinels-sg-aurora-${envName}`);

    // ════════════════════════════════════════════════════════════════════════
    // Security Group rules — Data tier
    //
    // Use CfnSecurityGroupIngress (L1) for cross-stack sources (sgFargate,
    // sgLambda from NetworkStack) — plain string IDs, no Token chain back
    // into NetworkStack route-table resources.
    // ════════════════════════════════════════════════════════════════════════

    // Aurora port 5432: Fargate → Aurora, Lambda → Aurora
    new ec2.CfnSecurityGroupIngress(this, 'AuroraTcpFromFargate', {
      groupId: this.sgAurora.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 5432,
      toPort: 5432,
      sourceSecurityGroupId: sgFargate.securityGroupId,
      description: 'Fargate tasks to Aurora 5432',
    });
    new ec2.CfnSecurityGroupIngress(this, 'AuroraTcpFromLambda', {
      groupId: this.sgAurora.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 5432,
      toPort: 5432,
      sourceSecurityGroupId: sgLambda.securityGroupId,
      description: 'Lambda functions to Aurora 5432',
    });

    // Redis port 6379: Fargate → Redis, Lambda → Redis
    // (sgAurora is reused for the data tier per spec)
    new ec2.CfnSecurityGroupIngress(this, 'RedisTcpFromFargate', {
      groupId: this.sgAurora.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 6379,
      toPort: 6379,
      sourceSecurityGroupId: sgFargate.securityGroupId,
      description: 'Fargate tasks to Redis 6379',
    });
    new ec2.CfnSecurityGroupIngress(this, 'RedisTcpFromLambda', {
      groupId: this.sgAurora.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 6379,
      toPort: 6379,
      sourceSecurityGroupId: sgLambda.securityGroupId,
      description: 'Lambda functions to Redis 6379',
    });

    // ════════════════════════════════════════════════════════════════════════
    // Aurora Serverless v2 — PostgreSQL 16
    // writer: us-east-1a | readers: us-east-1b, us-east-1c
    // ════════════════════════════════════════════════════════════════════════
    const auroraParameterGroup = new rds.ParameterGroup(this, 'AuroraParamGroup', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_4,
      }),
      description: 'AI Sentinels Aurora PG16 -- pgaudit + pg_stat_statements',
      parameters: {
        'shared_preload_libraries': 'pgaudit,pg_stat_statements',
        'pgaudit.log': 'all',
        'pg_stat_statements.track': 'all',
        'log_min_duration_statement': '1000', // log queries > 1 s
      },
    });
    tag(auroraParameterGroup);

    this.auroraCluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      clusterIdentifier: `aisentinels-aurora-cluster-${envName}`,
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_4,
      }),
      writer: rds.ClusterInstance.serverlessV2('Writer', {
        availabilityZone: 'us-east-1a',
        enablePerformanceInsights: true,
        parameterGroup: auroraParameterGroup,
      }),
      readers: [], // Cost-optimized: no readers pre-launch; add back when traffic warrants
      serverlessV2MinCapacity: 0.5, // Cost-optimized: min capacity pre-launch
      serverlessV2MaxCapacity: 64,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.sgAurora],
      defaultDatabaseName: 'aisentinels',
      storageEncrypted: true,
      storageEncryptionKey: auroraKey,
      backup: {
        retention: cdk.Duration.days(35),
        preferredWindow: '03:00-04:00',
      },
      deletionProtection: isProd,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      cloudwatchLogsExports: ['postgresql'],
      cloudwatchLogsRetention: cdk.aws_logs.RetentionDays.ONE_YEAR,
      parameterGroup: auroraParameterGroup,
    });
    tag(this.auroraCluster);

    // Master credentials auto-rotation (30 days)
    // SecretRotation placed at stack level (short construct path) to keep the
    // nested-stack Lambda name under the 64-char limit.  The L2 calls
    // target.connections.allowDefaultPortFrom() internally — safe because
    // sgAurora lives in this same stack.
    if (this.auroraCluster.secret) {
      const rotationSg = new ec2.SecurityGroup(this, 'RotSg', {
        vpc,
        description: 'Secret rotation Lambda SG',
        allowAllOutbound: false,
      });

      new secretsmanager.SecretRotation(this, 'DbRot', {
        application: secretsmanager.SecretRotationApplication.POSTGRES_ROTATION_SINGLE_USER,
        secret: this.auroraCluster.secret,
        target: this.auroraCluster,
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroup: rotationSg,
        automaticallyAfter: cdk.Duration.days(30),
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // RDS Proxy — IAM authentication required, max 1000 connections
    // ════════════════════════════════════════════════════════════════════════
    this.auroraProxy = new rds.DatabaseProxy(this, 'AuroraProxy', {
      proxyTarget: rds.ProxyTarget.fromCluster(this.auroraCluster),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [this.sgAurora],
      iamAuth: true,
      requireTLS: true,
      dbProxyName: `aisentinels-aurora-proxy-${envName}`,
      maxConnectionsPercent: 80, // 80% of max_connections → effectively 800 for default settings
      idleClientTimeout: cdk.Duration.minutes(30),
      secrets: [this.auroraCluster.secret!],
    });
    tag(this.auroraProxy);

    // ════════════════════════════════════════════════════════════════════════
    // DynamoDB Table 1 — aisentinels-audit-events  (append-only audit log)
    //
    // PK: tenantId (S)  SK: timestampEventId (S)
    // GSI-1: by-actor   (actorId / createdAt)
    // GSI-2: by-record  (tableName / recordId)
    //
    // ⚠  App roles MUST have explicit DENY on DeleteItem / UpdateItem /
    //    BatchWriteItem — enforced in ComputeStack task-role definitions.
    // ════════════════════════════════════════════════════════════════════════
    this.auditEventsTable = new dynamodb.Table(this, 'AuditEventsTable', {
      tableName: `aisentinels-audit-events-${envName}`,
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestampEventId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: dynamoDbKey,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      stream: dynamodb.StreamViewType.NEW_IMAGE, // For archival Lambda
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    tag(this.auditEventsTable);

    // GSI-1: by-actor — query all events for a given actor
    this.auditEventsTable.addGlobalSecondaryIndex({
      indexName: 'by-actor',
      partitionKey: { name: 'actorId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI-2: by-record — query all events touching a specific record
    this.auditEventsTable.addGlobalSecondaryIndex({
      indexName: 'by-record',
      partitionKey: { name: 'tableName', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'recordId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ════════════════════════════════════════════════════════════════════════
    // DynamoDB Table 2 — aisentinels-sessions  (JWT session cache, TTL-based)
    // ════════════════════════════════════════════════════════════════════════
    this.sessionsTable = new dynamodb.Table(this, 'SessionsTable', {
      tableName: `aisentinels-sessions-${envName}`,
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: dynamoDbKey,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });
    tag(this.sessionsTable);

    // ════════════════════════════════════════════════════════════════════════
    // Redis auth token → Secrets Manager
    // ════════════════════════════════════════════════════════════════════════
    const redisAuthToken = new secretsmanager.Secret(this, 'RedisAuthToken', {
      secretName: `/aisentinels/${envName}/redis/auth-token`,
      description: 'Redis AUTH token for ElastiCache cluster',
      generateSecretString: {
        passwordLength: 64,
        excludePunctuation: true, // ElastiCache AUTH only allows !&#$^<>- as special chars; safest to exclude all
      },
      encryptionKey: auroraKey,
    });
    tag(redisAuthToken);

    // ════════════════════════════════════════════════════════════════════════
    // ElastiCache Redis — Cluster mode (Replication Group)
    // node type: cache.t4g.medium (prod), cache.t4g.micro (dev)
    // num node groups: 2 (prod), 1 (dev)
    // ════════════════════════════════════════════════════════════════════════
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: `AI Sentinels Redis subnet group -- ${envName}`,
      subnetIds: vpc
        .selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED })
        .subnetIds,
      cacheSubnetGroupName: `aisentinels-redis-subnet-${envName}`,
    });
    tag(redisSubnetGroup);

    this.redisCluster = new elasticache.CfnReplicationGroup(this, 'RedisCluster', {
      replicationGroupDescription: `AI Sentinels Redis cache -- ${envName}`,
      replicationGroupId: `aisentinels-redis-${envName}`,
      // Cluster mode
      numNodeGroups: 1,
      replicasPerNodeGroup: 0,            // Cost-optimized: single node, no replica
      automaticFailoverEnabled: false,     // Must be false with 0 replicas
      multiAzEnabled: false,               // Must be false with 0 replicas
      cacheNodeType: 'cache.t4g.micro',   // Cost-optimized
      engine: 'redis',
      engineVersion: '7.1',
      cacheSubnetGroupName: redisSubnetGroup.ref,
      securityGroupIds: [this.sgAurora.securityGroupId], // Data tier SG (per spec)
      // TLS in-transit
      transitEncryptionEnabled: true,
      // Auth token for at-rest "password" auth (complemented by TLS)
      authToken: redisAuthToken.secretValue.unsafeUnwrap(),
      // At-rest encryption
      atRestEncryptionEnabled: true,
      // Automatic minor version upgrades
      autoMinorVersionUpgrade: true,
    });
    tag(this.redisCluster);

    // ════════════════════════════════════════════════════════════════════════
    // SSM Parameters — consumed by downstream stacks
    // ════════════════════════════════════════════════════════════════════════
    new ssm.StringParameter(this, 'SsmSgAurora', {
      parameterName: `/aisentinels/${envName}/data/sg-aurora`,
      stringValue: this.sgAurora.securityGroupId,
      description: 'Aurora + RDS Proxy security group ID',
    });
    new ssm.StringParameter(this, 'SsmAuroraEndpoint', {
      parameterName: `/aisentinels/${envName}/data/aurora-endpoint`,
      stringValue: this.auroraCluster.clusterEndpoint.hostname,
      description: 'Aurora cluster write endpoint',
    });
    new ssm.StringParameter(this, 'SsmAuroraReadEndpoint', {
      parameterName: `/aisentinels/${envName}/data/aurora-read-endpoint`,
      stringValue: this.auroraCluster.clusterReadEndpoint.hostname,
      description: 'Aurora cluster read endpoint',
    });
    new ssm.StringParameter(this, 'SsmProxyEndpoint', {
      parameterName: `/aisentinels/${envName}/data/aurora-proxy-endpoint`,
      stringValue: this.auroraProxy.endpoint,
      description: 'RDS Proxy endpoint (use this from application)',
    });
    new ssm.StringParameter(this, 'SsmAuroraSecretArn', {
      parameterName: `/aisentinels/${envName}/data/aurora-secret-arn`,
      stringValue: this.auroraCluster.secret?.secretArn ?? 'MANUAL',
    });
    new ssm.StringParameter(this, 'SsmAuditEventsTableName', {
      parameterName: `/aisentinels/${envName}/data/audit-events-table`,
      stringValue: this.auditEventsTable.tableName,
    });
    new ssm.StringParameter(this, 'SsmAuditEventsTableArn', {
      parameterName: `/aisentinels/${envName}/data/audit-events-table-arn`,
      stringValue: this.auditEventsTable.tableArn,
    });
    new ssm.StringParameter(this, 'SsmSessionsTableName', {
      parameterName: `/aisentinels/${envName}/data/sessions-table`,
      stringValue: this.sessionsTable.tableName,
    });
    new ssm.StringParameter(this, 'SsmRedisEndpoint', {
      parameterName: `/aisentinels/${envName}/data/redis-endpoint`,
      stringValue: this.redisCluster.attrPrimaryEndPointAddress,
    });
    new ssm.StringParameter(this, 'SsmRedisPort', {
      parameterName: `/aisentinels/${envName}/data/redis-port`,
      stringValue: this.redisCluster.attrPrimaryEndPointPort,
    });
    new ssm.StringParameter(this, 'SsmRedisAuthTokenArn', {
      parameterName: `/aisentinels/${envName}/data/redis-auth-token-arn`,
      stringValue: redisAuthToken.secretArn,
    });

    // ════════════════════════════════════════════════════════════════════════
    // CloudFormation Outputs
    // ════════════════════════════════════════════════════════════════════════
    new cdk.CfnOutput(this, 'SgAuroraId', {
      value: this.sgAurora.securityGroupId,
      exportName: `aisentinels-${envName}-sg-aurora`,
      description: 'Security Group ID -- Aurora PostgreSQL + RDS Proxy',
    });
    new cdk.CfnOutput(this, 'AuroraClusterEndpoint', {
      value: this.auroraCluster.clusterEndpoint.hostname,
      exportName: `aisentinels-${envName}-aurora-endpoint`,
      description: 'Aurora Serverless v2 write endpoint',
    });
    new cdk.CfnOutput(this, 'AuroraProxyEndpoint', {
      value: this.auroraProxy.endpoint,
      exportName: `aisentinels-${envName}-aurora-proxy-endpoint`,
      description: 'RDS Proxy endpoint -- use this from all application code',
    });
    new cdk.CfnOutput(this, 'AuroraSecretArn', {
      value: this.auroraCluster.secret?.secretArn ?? 'MANUAL',
      exportName: `aisentinels-${envName}-aurora-secret-arn`,
    });
    new cdk.CfnOutput(this, 'AuditEventsTableArn', {
      value: this.auditEventsTable.tableArn,
      exportName: `aisentinels-${envName}-audit-events-table-arn`,
      description: 'DynamoDB audit events table ARN',
    });
    new cdk.CfnOutput(this, 'SessionsTableArn', {
      value: this.sessionsTable.tableArn,
      exportName: `aisentinels-${envName}-sessions-table-arn`,
    });
    new cdk.CfnOutput(this, 'RedisPrimaryEndpoint', {
      value: this.redisCluster.attrPrimaryEndPointAddress,
      exportName: `aisentinels-${envName}-redis-endpoint`,
    });
  }
}
