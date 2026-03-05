/**
 * ComputeStack — E4
 *
 * Deploys the ECS Fargate compute tier:
 *   • 6 ECR repositories (one per service, with scan-on-push + lifecycle rules)
 *   • ECS Cluster (Fargate, ARM64, Container Insights)
 *   • Internal ALB in app subnets — reached only via API Gateway VpcLink
 *   • VpcLink — reuses sg-lambda (no new SG); ENIs live in app subnets
 *   • 6 FargateServices with placeholder nginx containers (replaced in E5–E8)
 *   • Path-based ALB routing + CPU/memory auto-scaling per service
 *
 * Security group ingress (L1 CfnSecurityGroupIngress — avoids cross-stack cycle):
 *   sg-alb    ← TCP 80 from sg-lambda  (VpcLink ENIs are members of sg-lambda)
 *   sg-fargate ← TCP 80 from sg-alb    (placeholder port; update to 8080 per-service in E5–E8)
 */
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { VpcLink } from 'aws-cdk-lib/aws-apigatewayv2';
import { Construct } from 'constructs';

export interface ComputeStackProps extends cdk.StackProps {
  /** 'dev' | 'staging' | 'prod' */
  envName: string;
  /** VPC from NetworkStack */
  vpc: ec2.IVpc;
  /** App-tier subnets from NetworkStack (services + ALB + VpcLink ENIs run here) */
  appSubnets: ec2.ISubnet[];
  /** ALB security group from NetworkStack */
  sgAlb: ec2.ISecurityGroup;
  /** Fargate task security group from NetworkStack */
  sgFargate: ec2.ISecurityGroup;
  /** Lambda security group from NetworkStack — reused for VpcLink ENIs */
  sgLambda: ec2.ISecurityGroup;
  /** Aurora security group from DataStack — for Fargate egress to Aurora */
  sgAurora: ec2.ISecurityGroup;
  /** IAM Permission Boundary from SecurityStack */
  permissionBoundary: iam.IManagedPolicy;
  /** RDS Proxy hostname — from DataStack.auroraProxy.endpoint */
  auroraProxyEndpoint: string;
  /** DynamoDB audit events table ARN — from DataStack.auditEventsTable.tableArn */
  auditEventsTableArn: string;
  /** DynamoDB sessions table ARN — from DataStack.sessionsTable.tableArn */
  sessionsTableArn: string;
  /** S3 working files bucket ARN — from StorageStack.workingFilesBucket.bucketArn */
  workingFilesBucketArn: string;
  /** S3 compliance evidence bucket ARN — from StorageStack.complianceBucket.bucketArn */
  complianceBucketArn: string;
  /** AOSS collection data endpoint — from SearchStack.collectionEndpoint (E5). Optional when SearchStack is not deployed. */
  aossCollectionEndpoint?: string;
}

// ── Service definitions ───────────────────────────────────────────────────────
// Port 80 = nginx placeholder. Real services use 8080 and a dedicated ECR image (E5–E8).
interface ServiceDef {
  id: string;
  name: string;
  cpu: number;
  memoryLimitMiB: number;
  port: number;
  routePaths: string[];
  priority: number;
  maxCapacity: number;
}

const SERVICES: ServiceDef[] = [
  {
    id: 'AiOrchestrator', name: 'ai-orchestrator', cpu: 2048, memoryLimitMiB: 4096, port: 8080,
    routePaths: ['/api/v1/ai', '/api/v1/ai/*'], priority: 10, maxCapacity: 10,
  },
  {
    id: 'Docs', name: 'docs', cpu: 1024, memoryLimitMiB: 2048, port: 8080,
    routePaths: ['/api/v1/documents', '/api/v1/documents/*'], priority: 20, maxCapacity: 5,
  },
  {
    id: 'Audit', name: 'audit', cpu: 1024, memoryLimitMiB: 2048, port: 8080,
    routePaths: ['/api/v1/audits', '/api/v1/audits/*'], priority: 30, maxCapacity: 5,
  },
  {
    id: 'Capa', name: 'capa', cpu: 512, memoryLimitMiB: 1024, port: 8080,
    routePaths: ['/api/v1/capas', '/api/v1/capas/*'], priority: 40, maxCapacity: 3,
  },
  {
    id: 'Records', name: 'records', cpu: 512, memoryLimitMiB: 1024, port: 8080,
    routePaths: ['/api/v1/records', '/api/v1/records/*'], priority: 50, maxCapacity: 3,
  },
  {
    id: 'Billing', name: 'billing', cpu: 256, memoryLimitMiB: 512, port: 8080,
    routePaths: ['/api/v1/billing', '/api/v1/billing/*'], priority: 60, maxCapacity: 2,
  },
];

export class ComputeStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly albListener: elbv2.ApplicationListener;
  public readonly vpcLink: VpcLink;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const { envName, appSubnets } = props;
    const isProd = envName === 'prod';

    const tag = (resource: Construct): void => {
      cdk.Tags.of(resource).add('project', 'aisentinels');
      cdk.Tags.of(resource).add('env', envName);
      cdk.Tags.of(resource).add('stack', 'compute');
    };

    // ══════════════════════════════════════════════════════════════════════════
    // Security group ingress rules
    //
    // L1 CfnSecurityGroupIngress — NOT L2 addIngressRule().
    // L2 addIngressRule() on a cross-stack SG modifies that stack's resources and
    // creates a forward reference cycle. L1 references SG IDs as strings — safe.
    // ══════════════════════════════════════════════════════════════════════════

    // VpcLink ENIs (sg-lambda) → ALB on port 80
    new ec2.CfnSecurityGroupIngress(this, 'AlbFromVpcLink', {
      groupId: props.sgAlb.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 80,
      toPort: 80,
      sourceSecurityGroupId: props.sgLambda.securityGroupId,
    });

    // ALB → Fargate tasks on port 8080 (all services use 8080)
    new ec2.CfnSecurityGroupIngress(this, 'FargateFromAlb', {
      groupId: props.sgFargate.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 8080,
      toPort: 8080,
      sourceSecurityGroupId: props.sgAlb.securityGroupId,
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Security group egress rules for sg-fargate
    //
    // NetworkStack creates sg-fargate with allowAllOutbound: false (locked down).
    // Fargate tasks need outbound to: VPC endpoints (443), public ECR (443 via NAT),
    // Aurora (5432), Redis (6379).
    // ══════════════════════════════════════════════════════════════════════════

    // HTTPS to VPC interface endpoints (CW Logs, ECR, SSM, SecretsManager, etc.)
    new ec2.CfnSecurityGroupEgress(this, 'FargateToVpcEndpoints', {
      groupId: props.sgFargate.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 443,
      toPort: 443,
      cidrIp: '10.0.0.0/16',
      description: 'HTTPS to VPC endpoints',
    });

    // HTTPS to internet via NAT for public ECR image pulls
    new ec2.CfnSecurityGroupEgress(this, 'FargateToInternet', {
      groupId: props.sgFargate.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 443,
      toPort: 443,
      cidrIp: '0.0.0.0/0',
      description: 'HTTPS to internet via NAT for public ECR',
    });

    // PostgreSQL to Aurora via sg-aurora (DataStack)
    new ec2.CfnSecurityGroupEgress(this, 'FargateToAurora', {
      groupId: props.sgFargate.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 5432,
      toPort: 5432,
      destinationSecurityGroupId: props.sgAurora.securityGroupId,
      description: 'PostgreSQL to Aurora',
    });

    // Redis TLS to data subnets
    new ec2.CfnSecurityGroupEgress(this, 'FargateToRedis', {
      groupId: props.sgFargate.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 6379,
      toPort: 6379,
      cidrIp: '10.0.0.0/16',
      description: 'Redis TLS to data subnets',
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Security group egress rules for sg-lambda
    //
    // NetworkStack creates sg-lambda with allowAllOutbound: false (locked down).
    // VPC-attached Lambdas and VpcLink ENIs (both use sg-lambda) need outbound
    // to: RDS Proxy (5432 via sg-aurora), VPC endpoints (443), and internet (443
    // via NAT for AWS SDK calls, Cognito token fetch, etc.).
    // ══════════════════════════════════════════════════════════════════════════

    // PostgreSQL to RDS Proxy via sg-aurora
    new ec2.CfnSecurityGroupEgress(this, 'LambdaToAurora', {
      groupId: props.sgLambda.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 5432,
      toPort: 5432,
      destinationSecurityGroupId: props.sgAurora.securityGroupId,
      description: 'PostgreSQL to RDS Proxy via sg-aurora',
    });

    // HTTPS to VPC endpoints + internet via NAT (STS, Cognito, CW Logs, etc.)
    new ec2.CfnSecurityGroupEgress(this, 'LambdaToHttps', {
      groupId: props.sgLambda.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 443,
      toPort: 443,
      cidrIp: '0.0.0.0/0',
      description: 'HTTPS to VPC endpoints and internet via NAT',
    });

    // ══════════════════════════════════════════════════════════════════════════
    // ECR Repositories — one per service
    // AWS-managed encryption (no CMK here — add in hardening epic).
    // Stored in a map so the services loop can reference them by service id.
    // ══════════════════════════════════════════════════════════════════════════
    const ecrRepos = new Map<string, ecr.Repository>();
    for (const svc of SERVICES) {
      const repo = new ecr.Repository(this, `${svc.id}Repo`, {
        repositoryName: `aisentinels-${envName}-${svc.name}`,
        imageScanOnPush: true,
        imageTagMutability: ecr.TagMutability.MUTABLE,
        removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        emptyOnDelete: !isProd,
      });
      repo.addLifecycleRule({
        description: 'Keep last 10 tagged images',
        maxImageCount: 10,
      });
      repo.addLifecycleRule({
        description: 'Expire untagged images after 7 days',
        tagStatus: ecr.TagStatus.UNTAGGED,
        maxImageAge: cdk.Duration.days(7),
      });
      tag(repo);
      ecrRepos.set(svc.id, repo);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ECS Cluster
    // ══════════════════════════════════════════════════════════════════════════
    this.cluster = new ecs.Cluster(this, 'EcsCluster', {
      clusterName: `aisentinels-${envName}`,
      vpc: props.vpc,
      enableFargateCapacityProviders: true,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    });
    tag(this.cluster);

    // ══════════════════════════════════════════════════════════════════════════
    // Shared Task Execution Role
    // All services use this role to pull images from ECR and write CloudWatch logs.
    // ══════════════════════════════════════════════════════════════════════════
    const executionRole = new iam.Role(this, 'TaskExecutionRole', {
      roleName: `aisentinels-ecs-exec-${envName}`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
      permissionsBoundary: props.permissionBoundary,
      description: 'Shared ECS task execution role -- ECR pull, CWL logs',
    });
    tag(executionRole);

    // ══════════════════════════════════════════════════════════════════════════
    // Internal ALB
    // internetFacing: false — only reachable via VpcLink from API Gateway.
    // open: false — no 0.0.0.0/0 inbound rule (internal ALB, VpcLink only).
    // ══════════════════════════════════════════════════════════════════════════
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      loadBalancerName: `aisentinels-alb-${envName}`,
      vpc: props.vpc,
      internetFacing: false,
      vpcSubnets: { subnets: appSubnets },
      securityGroup: props.sgAlb,
      deletionProtection: isProd,
    });
    tag(this.alb);

    this.albListener = this.alb.addListener('HttpListener', {
      port: 80,
      open: false, // internal ALB — no 0.0.0.0/0 rule
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: 'application/json',
        messageBody: '{"error":"Route not found"}',
      }),
    });

    // ══════════════════════════════════════════════════════════════════════════
    // VpcLink
    // Reuses sg-lambda — VpcLink ENIs are added to sg-lambda. No new SG needed.
    // Inbound rule on sg-alb (AlbFromVpcLink above) allows traffic from sg-lambda.
    // ══════════════════════════════════════════════════════════════════════════
    this.vpcLink = new VpcLink(this, 'VpcLink', {
      vpc: props.vpc,
      vpcLinkName: `aisentinels-vpclink-${envName}`,
      subnets: { subnets: appSubnets },
      securityGroups: [props.sgLambda],
    });
    tag(this.vpcLink);

    // ══════════════════════════════════════════════════════════════════════════
    // GCP service account credentials for Vertex AI (AiOrchestrator only)
    //
    // Placeholder secret — populate manually after first deploy:
    //   aws secretsmanager put-secret-value \
    //     --secret-id /aisentinels/{envName}/gcp/vertex-ai-credentials \
    //     --secret-string "$(cat service-account.json)"
    //
    // RETAIN policy: credentials must never be auto-deleted.
    // ══════════════════════════════════════════════════════════════════════════
    const gcpCredentialsSecret = new secretsmanager.Secret(this, 'GcpCredentialsSecret', {
      secretName: `/aisentinels/${envName}/gcp/vertex-ai-credentials`,
      description: 'GCP service account JSON for Vertex AI. Populate manually -- never commit to source.',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    cdk.Tags.of(gcpCredentialsSecret).add('project', 'aisentinels');
    cdk.Tags.of(gcpCredentialsSecret).add('env', envName);
    cdk.Tags.of(gcpCredentialsSecret).add('stack', 'compute');

    // ══════════════════════════════════════════════════════════════════════════
    // Services loop — per-service: LogGroup, TaskRole, TaskDef, TG, Service,
    //                              ListenerRule, Auto-scaling
    // ══════════════════════════════════════════════════════════════════════════
    for (const svc of SERVICES) {
      // ── a) CloudWatch Log Group ─────────────────────────────────────────────
      const logGroup = new logs.LogGroup(this, `${svc.id}LogGroup`, {
        logGroupName: `/aws/ecs/aisentinels-${svc.name}-${envName}`,
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });

      // ── b) Task Role (per-service) ─────────────────────────────────────────
      const taskRole = new iam.Role(this, `${svc.id}TaskRole`, {
        roleName: `aisentinels-${svc.name}-task-${envName}`,
        assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        permissionsBoundary: props.permissionBoundary,
        description: `Task role for aisentinels-${svc.name}`,
      });

      // RDS Proxy IAM auth — all services connect via IAM
      // TODO post-E1-deploy: tighten ARN to per-service DB user
      taskRole.addToPolicy(new iam.PolicyStatement({
        sid: 'AllowRdsProxyConnect',
        actions: ['rds-db:connect'],
        resources: [`arn:aws:rds-db:${this.region}:${this.account}:dbuser:*/*`],
      }));

      // DynamoDB — audit events: append-only (immutable audit log, no UpdateItem/DeleteItem)
      taskRole.addToPolicy(new iam.PolicyStatement({
        sid: 'AllowDynamoAuditAppendOnly',
        actions: ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:Query'],
        resources: [props.auditEventsTableArn, `${props.auditEventsTableArn}/index/*`],
      }));

      // DynamoDB — sessions: read/write (UpdateItem for TTL refresh, DeleteItem for logout)
      taskRole.addToPolicy(new iam.PolicyStatement({
        sid: 'AllowDynamoSessions',
        actions: [
          'dynamodb:PutItem',
          'dynamodb:GetItem',
          'dynamodb:Query',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
        ],
        resources: [props.sessionsTableArn, `${props.sessionsTableArn}/index/*`],
      }));

      // ECS Exec (SSM Messages) — allows `ecs execute-command` for live debugging
      taskRole.addToPolicy(new iam.PolicyStatement({
        sid: 'AllowEcsExec',
        actions: [
          'ssmmessages:CreateControlChannel',
          'ssmmessages:OpenControlChannel',
          'ssmmessages:CreateDataChannel',
          'ssmmessages:OpenDataChannel',
        ],
        resources: ['*'],
      }));

      // AiOrchestrator: AOSS data plane access (only when SearchStack is deployed)
      if (svc.id === 'AiOrchestrator' && props.aossCollectionEndpoint) {
        taskRole.addToPolicy(new iam.PolicyStatement({
          sid: 'AllowAossDataPlane',
          actions: ['aoss:APIAccessAll'],
          resources: [`arn:aws:aoss:${this.region}:${this.account}:collection/*`],
        }));
      }

      // Per-service S3 permissions
      if (svc.id === 'Docs') {
        taskRole.addToPolicy(new iam.PolicyStatement({
          sid: 'AllowWorkingFilesS3',
          actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
          resources: [props.workingFilesBucketArn, `${props.workingFilesBucketArn}/*`],
        }));
      }
      if (svc.id === 'Records') {
        taskRole.addToPolicy(new iam.PolicyStatement({
          sid: 'AllowComplianceS3',
          // No s3:DeleteObject — Object Lock on compliance bucket enforces WORM
          actions: ['s3:GetObject', 's3:PutObject'],
          resources: [props.complianceBucketArn, `${props.complianceBucketArn}/*`],
        }));
      }
      tag(taskRole);

      // ── c) Task Definition (ARM64) ─────────────────────────────────────────
      // runtimePlatform.cpuArchitecture = ARM64: must be explicit — default is AMD64.
      // Real service images will be built for linux/arm64 (E5–E8).
      const taskDef = new ecs.FargateTaskDefinition(this, `${svc.id}TaskDef`, {
        cpu: svc.cpu,
        memoryLimitMiB: svc.memoryLimitMiB,
        executionRole,
        taskRole,
        runtimePlatform: {
          cpuArchitecture: ecs.CpuArchitecture.ARM64,
          operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        },
      });

      // Container image: AiOrchestrator uses its ECR repo; others stay on nginx placeholder
      const containerImage =
        svc.id === 'AiOrchestrator'
          ? ecs.ContainerImage.fromEcrRepository(ecrRepos.get(svc.id)!, 'latest')
          : ecs.ContainerImage.fromRegistry('public.ecr.aws/docker/library/nginx:stable-alpine');

      // Per-service environment additions
      const containerEnv: Record<string, string> = {
        ENV_NAME: envName,
        SERVICE_NAME: svc.name,
        AURORA_PROXY_ENDPOINT: props.auroraProxyEndpoint,
        AURORA_DB_USER: 'postgres',   // TODO: tighten to per-service user post-E1-deploy
        AURORA_DB_NAME: 'aisentinels',
        AURORA_IAM_AUTH: 'true',
      };
      if (svc.id === 'AiOrchestrator') {
        if (props.aossCollectionEndpoint) {
          containerEnv['AOSS_COLLECTION_ENDPOINT'] = props.aossCollectionEndpoint;
        }
        containerEnv['VERTEX_AI_LOCATION'] = 'us-central1';
      }

      // Per-service ECS secrets (ECS agent injects at container start via execution role)
      const containerSecrets: Record<string, ecs.Secret> = {};
      if (svc.id === 'AiOrchestrator') {
        containerSecrets['GCP_CREDENTIALS_JSON'] = ecs.Secret.fromSecretsManager(gcpCredentialsSecret);
      }

      // Placeholder nginx containers need a command override to listen on 8080
      // and serve /health — real service images (E5–E8) will serve on 8080 natively.
      const isNginxPlaceholder = svc.id !== 'AiOrchestrator';

      taskDef.addContainer(`${svc.id}Container`, {
        image: containerImage,
        ...(isNginxPlaceholder && {
          command: [
            'sh', '-c',
            // eslint-disable-next-line max-len
            "echo 'server { listen 8080; location /health { return 200 ok; } location / { return 200 ok; } }' > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'",
          ],
        }),
        portMappings: [{ containerPort: svc.port, protocol: ecs.Protocol.TCP }],
        environment: containerEnv,
        secrets: containerSecrets,
        logging: ecs.LogDrivers.awsLogs({
          streamPrefix: svc.name,
          logGroup,
        }),
        healthCheck: {
          command: ['CMD-SHELL', 'curl -sf http://localhost:8080/health || exit 1'],
          interval: cdk.Duration.seconds(30),
          retries: 3,
          startPeriod: cdk.Duration.seconds(60),
          timeout: cdk.Duration.seconds(5),
        },
        readonlyRootFilesystem: false, // nginx writes to /var/cache/nginx and /tmp
        essential: true,
      });

      // ── d) ALB Target Group ────────────────────────────────────────────────
      // targetType: IP — required for Fargate (tasks register by private IP, not EC2 instance)
      // Target group name ≤ 32 chars — all prod names fit; .slice(0, 32) as safety guard
      const targetGroup = new elbv2.ApplicationTargetGroup(this, `${svc.id}TG`, {
        targetGroupName: `aisentinels-${svc.name}-${envName}`.slice(0, 32),
        vpc: props.vpc,
        port: svc.port,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targetType: elbv2.TargetType.IP,
        healthCheck: {
          path: '/health',
          interval: cdk.Duration.seconds(30),
          healthyHttpCodes: '200-399',
          healthyThresholdCount: 2,
          unhealthyThresholdCount: 3,
          timeout: cdk.Duration.seconds(5),
        },
        deregistrationDelay: cdk.Duration.seconds(30),
      });

      // ── e) Fargate Service ─────────────────────────────────────────────────
      // desiredCount: 1 — not 0. Services at 0 tasks fail ALB health checks.
      // enableExecuteCommand: true — ECS Exec via `aws ecs execute-command` for debugging.
      // capacityProviderStrategies: prod uses FARGATE_SPOT (weight 2) for cost savings,
      //   with FARGATE base=1 to guarantee at least one reliable task.
      const service = new ecs.FargateService(this, `${svc.id}Service`, {
        cluster: this.cluster,
        taskDefinition: taskDef,
        serviceName: `aisentinels-${svc.name}-${envName}`,
        desiredCount: svc.id === 'AiOrchestrator' ? 0 : 1, // AiOrchestrator: 0 until SearchStack deployed
        // Rolling deploy: keep 100% healthy (1 new task launched before old is killed)
        minHealthyPercent: 100,
        maxHealthyPercent: 200,
        vpcSubnets: { subnets: appSubnets },
        securityGroups: [props.sgFargate],
        assignPublicIp: false,
        enableExecuteCommand: true,
        capacityProviderStrategies: isProd
          ? [
              { capacityProvider: 'FARGATE',      weight: 1, base: 1 },
              { capacityProvider: 'FARGATE_SPOT',  weight: 2 },
            ]
          : [
              { capacityProvider: 'FARGATE', weight: 1 },
            ],
        healthCheckGracePeriod: cdk.Duration.seconds(60),
      });
      service.attachToApplicationTargetGroup(targetGroup);
      tag(service);

      // ── f) ALB Listener Rule ───────────────────────────────────────────────
      this.albListener.addTargetGroups(`${svc.id}Rule`, {
        priority: svc.priority,
        conditions: [elbv2.ListenerCondition.pathPatterns(svc.routePaths)],
        targetGroups: [targetGroup],
      });

      // ── g) Auto-scaling ────────────────────────────────────────────────────
      const scaling = service.autoScaleTaskCount({
        minCapacity: 1,
        maxCapacity: svc.maxCapacity,
      });
      scaling.scaleOnCpuUtilization(`${svc.id}CpuScaling`, {
        targetUtilizationPercent: 70,
        scaleInCooldown: cdk.Duration.seconds(300),
        scaleOutCooldown: cdk.Duration.seconds(30),
      });
      scaling.scaleOnMemoryUtilization(`${svc.id}MemoryScaling`, {
        targetUtilizationPercent: 80,
        scaleInCooldown: cdk.Duration.seconds(300),
        scaleOutCooldown: cdk.Duration.seconds(30),
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SSM Parameters
    // ══════════════════════════════════════════════════════════════════════════
    new ssm.StringParameter(this, 'SsmClusterName', {
      parameterName: `/aisentinels/${envName}/compute/cluster-name`,
      stringValue: this.cluster.clusterName,
    });
    new ssm.StringParameter(this, 'SsmAlbDns', {
      parameterName: `/aisentinels/${envName}/compute/alb-dns`,
      stringValue: this.alb.loadBalancerDnsName,
    });
    new ssm.StringParameter(this, 'SsmAlbArn', {
      parameterName: `/aisentinels/${envName}/compute/alb-arn`,
      stringValue: this.alb.loadBalancerArn,
    });
    new ssm.StringParameter(this, 'SsmVpcLinkId', {
      parameterName: `/aisentinels/${envName}/compute/vpclink-id`,
      stringValue: this.vpcLink.vpcLinkId,
    });

    // ══════════════════════════════════════════════════════════════════════════
    // CloudFormation Outputs
    // ══════════════════════════════════════════════════════════════════════════
    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      exportName: `aisentinels-${envName}-cluster-name`,
      description: 'ECS Cluster name',
    });
    new cdk.CfnOutput(this, 'AlbDns', {
      value: this.alb.loadBalancerDnsName,
      exportName: `aisentinels-${envName}-alb-dns`,
      description: 'Internal ALB DNS name',
    });
    new cdk.CfnOutput(this, 'VpcLinkId', {
      value: this.vpcLink.vpcLinkId,
      exportName: `aisentinels-${envName}-vpclink-id`,
      description: 'VpcLink ID connecting API Gateway to internal ALB',
    });
  }
}
