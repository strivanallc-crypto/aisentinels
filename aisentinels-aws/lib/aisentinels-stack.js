const cdk = require('aws-cdk-lib');
const rds = require('aws-cdk-lib/aws-rds');
const ec2 = require('aws-cdk-lib/aws-ec2');
const cognito = require('aws-cdk-lib/aws-cognito');
const s3 = require('aws-cdk-lib/aws-s3');
const iam = require('aws-cdk-lib/aws-iam');
const backup = require('aws-cdk-lib/aws-backup');
const cloudtrail = require('aws-cdk-lib/aws-cloudtrail');
const logs = require('aws-cdk-lib/aws-logs');
const secretsmanager = require('aws-cdk-lib/aws-secretsmanager');
const ecr = require('aws-cdk-lib/aws-ecr');
const apprunner = require('aws-cdk-lib/aws-apprunner');
const events = require('aws-cdk-lib/aws-events');

class AisentinelsStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // ==================== NETWORKING ====================
    const vpc = new ec2.Vpc(this, 'AIsentinelsVPC', {
      maxAzs: 2,
      subnetConfiguration: [
        { name: 'Public',   subnetType: ec2.SubnetType.PUBLIC,              cidrMask: 24 },
        { name: 'Private',  subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
        { name: 'Isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED,    cidrMask: 24 },
      ],
      natGateways: 1, // enables internet access for backend (Gemini API, Stripe, etc.)
    });

    // VPC Endpoints — cheaper than NAT for AWS service calls
    vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    });
    vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // ==================== SECURITY GROUPS ====================
    const backendSG = new ec2.SecurityGroup(this, 'BackendSecurityGroup', {
      vpc,
      description: 'App Runner VPC connector SG',
      allowAllOutbound: true,
    });

    const dbSG = new ec2.SecurityGroup(this, 'DBSecurityGroup', {
      vpc,
      description: 'Aurora PostgreSQL SG - only allows backend',
      allowAllOutbound: false,
    });

    dbSG.addIngressRule(backendSG, ec2.Port.tcp(5432), 'Backend to Aurora');

    // ==================== DATABASE (Aurora Serverless v2) ====================
    const dbCluster = new rds.DatabaseCluster(this, 'IMSDatabase', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_6,
      }),
      writer: rds.ClusterInstance.serverlessV2('Writer'),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSG],
      defaultDatabaseName: 'aisentinels_db',
      storageEncrypted: true,
      cloudwatchLogsExports: ['postgresql'],
      cloudwatchLogsRetention: logs.RetentionDays.ONE_YEAR,
      deletionProtection: false,
      backup: { retention: cdk.Duration.days(30), preferredWindow: '03:00-04:00' },
    });

    // ==================== S3 (Document Storage) ====================
    const documentBucket = new s3.Bucket(this, 'ISODocuments', {
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [{
        transitions: [{
          storageClass: s3.StorageClass.INFREQUENT_ACCESS,
          transitionAfter: cdk.Duration.days(90),
        }],
      }],
    });

    // ==================== COGNITO (Authentication) ====================
    const userPool = new cognito.UserPool(this, 'AIsentinelsUsers', {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        givenName: { required: true },
        familyName: { required: true },
      },
      customAttributes: {
        role:     new cognito.StringAttribute({ mutable: true }), // Admin/Manager/Auditor/Viewer
        tenantId: new cognito.StringAttribute({ mutable: true }), // multi-tenant
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(3),
      },
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: { sms: false, otp: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
    });

    const userPoolDomain = new cognito.UserPoolDomain(this, 'AuthDomain', {
      userPool,
      cognitoDomain: { domainPrefix: 'aisentinels-auth' },
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'WebClient', {
      userPool,
      generateSecret: false,
      authFlows: { userPassword: true, userSrp: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [
          'https://aisentinels.io/api/auth/callback/cognito',
          'http://localhost:3000/api/auth/callback/cognito',
        ],
        logoutUrls: ['https://aisentinels.io', 'http://localhost:3000'],
      },
    });

    // ==================== SECRETS MANAGER ====================
    const dbSecret = new secretsmanager.Secret(this, 'DBSecret', {
      description: 'Aurora credentials - read by backend at startup',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'saasadmin',
          host: dbCluster.clusterEndpoint.hostname,
          port: 5432,
          dbname: 'aisentinels_db',
        }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\',
      },
    });

    // ==================== ECR REPOSITORY ====================
    const ecrRepo = new ecr.Repository(this, 'BackendRepo', {
      repositoryName: 'aisentinels-backend',
      imageScanOnPush: true,
      lifecycleRules: [{ maxImageCount: 10 }],
    });

    // ==================== IAM ROLES ====================
    // Access role: App Runner pulls the Docker image from ECR
    const accessRole = new iam.Role(this, 'AppRunnerAccessRole', {
      assumedBy: new iam.ServicePrincipal('build.apprunner.amazonaws.com'),
      description: 'Allows App Runner to pull images from ECR',
    });
    ecrRepo.grantPull(accessRole);

    // Instance role: your backend code assumes this at runtime
    const instanceRole = new iam.Role(this, 'AppRunnerInstanceRole', {
      assumedBy: new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
      description: 'Runtime permissions for AI Sentinels backend',
    });
    documentBucket.grantReadWrite(instanceRole);
    // Use Aurora's auto-generated master credentials (dbCluster.secret)
    // NOT dbSecret (which has 'saasadmin' that doesn't exist in Aurora)
    dbCluster.secret.grantRead(instanceRole);

    // ==================== APP RUNNER VPC CONNECTOR ====================
    // Allows App Runner to connect to Aurora in the isolated subnet
    const vpcConnector = new apprunner.CfnVpcConnector(this, 'VpcConnector', {
      vpcConnectorName: 'aisentinels-vpc-connector',
      subnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }).subnetIds,
      securityGroups: [backendSG.securityGroupId],
    });

    // ==================== APP RUNNER SERVICE ====================
    const appRunnerService = new apprunner.CfnService(this, 'BackendService', {
      serviceName: 'aisentinels-backend',
      sourceConfiguration: {
        authenticationConfiguration: { accessRoleArn: accessRole.roleArn },
        autoDeploymentsEnabled: true, // redeploys on new ECR push
        imageRepository: {
          imageIdentifier: ecrRepo.repositoryUri + ':latest',
          imageRepositoryType: 'ECR',
          imageConfiguration: {
            port: '3001',
            runtimeEnvironmentVariables: [
              { name: 'NODE_ENV',             value: 'production' },
              { name: 'PORT',                 value: '3001' },
              { name: 'AWS_REGION',           value: cdk.Aws.REGION },
              { name: 'COGNITO_USER_POOL_ID', value: userPool.userPoolId },
              { name: 'COGNITO_CLIENT_ID',    value: userPoolClient.userPoolClientId },
              { name: 'S3_BUCKET_NAME',       value: documentBucket.bucketName },
              { name: 'DB_SECRET_ARN',        value: dbCluster.secret.secretArn },
            ],
          },
        },
      },
      instanceConfiguration: {
        instanceRoleArn: instanceRole.roleArn,
        cpu: '1 vCPU',
        memory: '2 GB',
      },
      networkConfiguration: {
        egressConfiguration: {
          egressType: 'VPC',
          vpcConnectorArn: vpcConnector.attrVpcConnectorArn,
        },
      },
      healthCheckConfiguration: {
        path: '/health',
        protocol: 'HTTP',
        interval: 20,
        timeout: 5,
        healthyThreshold: 1,
        unhealthyThreshold: 5,
      },
    });

    // ==================== COMPLIANCE (CloudTrail + Backup) ====================
    const trailBucket = new s3.Bucket(this, 'TrailBucket', {
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });
    new cloudtrail.Trail(this, 'IMSAuditTrail', {
      isMultiRegionTrail: true,
      enableFileValidation: true,
      bucket: trailBucket,
      cloudWatchLogsRetention: logs.RetentionDays.ONE_YEAR,
    });

    const backupPlan = new backup.BackupPlan(this, 'IMSBackupPlan', {
      backupPlanName: 'ISO-Compliant-Backup',
    });
    backupPlan.addRule(new backup.BackupPlanRule({
      ruleName: 'Daily-30Days',
      schedule: events.Schedule.cron({ hour: '2', minute: '0' }),
      deleteAfter: cdk.Duration.days(30),
      enableContinuousBackup: true,
    }));
    backupPlan.addSelection('Selection', {
      resources: [
        backup.BackupResource.fromRdsDatabaseCluster(dbCluster),
        // S3 bucket uses versioning for data protection; no separate backup needed
      ],
    });

    // ==================== OUTPUTS ====================
    new cdk.CfnOutput(this, 'AppRunnerServiceUrl', {
      value: appRunnerService.attrServiceUrl,
      description: 'Set as NEXT_PUBLIC_API_URL in frontend .env',
    });
    new cdk.CfnOutput(this, 'ECRRepository', {
      value: ecrRepo.repositoryUri,
      description: 'docker push <this>:latest to deploy backend',
    });
    new cdk.CfnOutput(this, 'DatabaseSecretArn',  { value: dbCluster.secret.secretArn });
    new cdk.CfnOutput(this, 'DatabaseEndpoint',   { value: dbCluster.clusterEndpoint.hostname });
    new cdk.CfnOutput(this, 'CognitoUserPoolId',  { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'CognitoClientId',    { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'CognitoDomain',      { value: userPoolDomain.domainName });
    new cdk.CfnOutput(this, 'DocumentBucketName', { value: documentBucket.bucketName });
    new cdk.CfnOutput(this, 'VpcId',              { value: vpc.vpcId });
  }
}

module.exports = { AisentinelsStack };
