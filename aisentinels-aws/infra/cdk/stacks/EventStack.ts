/**
 * EventStack — Phase 2
 *
 * Event-driven backbone for sentinel workflows.
 * Infrastructure only — all EventBridge rules are DISABLED until Phase 3.
 *
 * Resources:
 *   • 1 custom event bus (aisentinels-sentinel-bus)
 *   • 5 SQS queues (with DLQ each)
 *   • 5 EventBridge rules (disabled — skeleton for Phase 3)
 *
 * Events flow:
 *   Sentinel Lambda/ECS → EventBridge PutEvents → Rule → SQS → Consumer
 */
import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

export interface EventStackProps extends cdk.StackProps {
  /** 'dev' | 'staging' | 'prod' */
  envName: string;
}

export class EventStack extends cdk.Stack {
  public readonly eventBus: events.EventBus;

  // SQS Queues (DLQ pattern on each)
  public readonly documentApprovedQueue: sqs.Queue;
  public readonly auditCompletedQueue: sqs.Queue;
  public readonly capaOverdueQueue: sqs.Queue;
  public readonly retentionExpiredQueue: sqs.Queue;
  public readonly approvalRequestedQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: EventStackProps) {
    super(scope, id, props);

    const { envName } = props;

    const tag = (resource: Construct): void => {
      cdk.Tags.of(resource).add('project', 'aisentinels');
      cdk.Tags.of(resource).add('env', envName);
      cdk.Tags.of(resource).add('stack', 'event');
    };

    // ══════════════════════════════════════════════════════════════════════════
    // Custom event bus — all sentinel events route here
    // ══════════════════════════════════════════════════════════════════════════
    this.eventBus = new events.EventBus(this, 'SentinelEventBus', {
      eventBusName: 'aisentinels-sentinel-bus',
    });
    tag(this.eventBus);

    // ══════════════════════════════════════════════════════════════════════════
    // DLQ helper — 14d retention, SQS-managed encryption
    // ══════════════════════════════════════════════════════════════════════════
    const dlq = (name: string) => {
      const q = new sqs.Queue(this, `${name}DLQ`, {
        queueName: `aisentinels-${name}-dlq`,
        retentionPeriod: cdk.Duration.days(14),
        encryption: sqs.QueueEncryption.SQS_MANAGED,
      });
      tag(q);
      return q;
    };

    // ══════════════════════════════════════════════════════════════════════════
    // Queue definitions (with DLQ)
    // ══════════════════════════════════════════════════════════════════════════

    this.documentApprovedQueue = new sqs.Queue(this, 'DocumentApprovedQueue', {
      queueName: 'aisentinels-document-approved',
      visibilityTimeout: cdk.Duration.seconds(300),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: { queue: dlq('document-approved'), maxReceiveCount: 3 },
    });
    tag(this.documentApprovedQueue);

    this.auditCompletedQueue = new sqs.Queue(this, 'AuditCompletedQueue', {
      queueName: 'aisentinels-audit-completed',
      visibilityTimeout: cdk.Duration.seconds(300),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: { queue: dlq('audit-completed'), maxReceiveCount: 3 },
    });
    tag(this.auditCompletedQueue);

    this.capaOverdueQueue = new sqs.Queue(this, 'CapaOverdueQueue', {
      queueName: 'aisentinels-capa-overdue',
      visibilityTimeout: cdk.Duration.seconds(120),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: { queue: dlq('capa-overdue'), maxReceiveCount: 3 },
    });
    tag(this.capaOverdueQueue);

    this.retentionExpiredQueue = new sqs.Queue(this, 'RetentionExpiredQueue', {
      queueName: 'aisentinels-retention-expired',
      visibilityTimeout: cdk.Duration.seconds(120),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: { queue: dlq('retention-expired'), maxReceiveCount: 3 },
    });
    tag(this.retentionExpiredQueue);

    this.approvalRequestedQueue = new sqs.Queue(this, 'ApprovalRequestedQueue', {
      queueName: 'aisentinels-approval-requested',
      visibilityTimeout: cdk.Duration.seconds(120),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: { queue: dlq('approval-requested'), maxReceiveCount: 3 },
    });
    tag(this.approvalRequestedQueue);

    // ══════════════════════════════════════════════════════════════════════════
    // EventBridge Rules — DISABLED until Phase 3 activates them
    // ══════════════════════════════════════════════════════════════════════════

    // Rule: audit.completed → auditCompletedQueue
    new events.Rule(this, 'AuditCompletedRule', {
      eventBus: this.eventBus,
      ruleName: 'aisentinels-audit-completed',
      enabled: false,
      eventPattern: {
        source: ['aisentinels.audie'],
        detailType: ['audit.completed'],
      },
      targets: [new targets.SqsQueue(this.auditCompletedQueue)],
    });

    // Rule: document.approved → documentApprovedQueue
    new events.Rule(this, 'DocumentApprovedRule', {
      eventBus: this.eventBus,
      ruleName: 'aisentinels-document-approved',
      enabled: false,
      eventPattern: {
        source: ['aisentinels.doki'],
        detailType: ['document.approved'],
      },
      targets: [new targets.SqsQueue(this.documentApprovedQueue)],
    });

    // Rule: capa.overdue → capaOverdueQueue
    new events.Rule(this, 'CapaOverdueRule', {
      eventBus: this.eventBus,
      ruleName: 'aisentinels-capa-overdue',
      enabled: false,
      eventPattern: {
        source: ['aisentinels.nexus'],
        detailType: ['capa.overdue'],
      },
      targets: [new targets.SqsQueue(this.capaOverdueQueue)],
    });

    // Rule: record.retention_expired → retentionExpiredQueue
    new events.Rule(this, 'RetentionExpiredRule', {
      eventBus: this.eventBus,
      ruleName: 'aisentinels-retention-expired',
      enabled: false,
      eventPattern: {
        source: ['aisentinels.vault'],
        detailType: ['record.retention_expired'],
      },
      targets: [new targets.SqsQueue(this.retentionExpiredQueue)],
    });

    // Rule: approval.requested → approvalRequestedQueue
    new events.Rule(this, 'ApprovalRequestedRule', {
      eventBus: this.eventBus,
      ruleName: 'aisentinels-approval-requested',
      enabled: false,
      eventPattern: {
        source: ['aisentinels.omni'],
        detailType: ['approval.requested'],
      },
      targets: [new targets.SqsQueue(this.approvalRequestedQueue)],
    });

    // ══════════════════════════════════════════════════════════════════════════
    // CloudFormation Outputs
    // ══════════════════════════════════════════════════════════════════════════
    new cdk.CfnOutput(this, 'SentinelEventBusArn', {
      value: this.eventBus.eventBusArn,
      exportName: `aisentinels-${envName}-sentinel-bus-arn`,
      description: 'Sentinel EventBridge bus ARN',
    });

    new cdk.CfnOutput(this, 'SentinelEventBusName', {
      value: this.eventBus.eventBusName,
      exportName: `aisentinels-${envName}-sentinel-bus-name`,
      description: 'Sentinel EventBridge bus name',
    });
  }
}
