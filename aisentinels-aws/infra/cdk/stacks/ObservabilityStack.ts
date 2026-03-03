/**
 * ObservabilityStack — E9
 *
 * Creates a CloudWatch Dashboard covering all API Gateway and Lambda metrics,
 * three alarms routed to an SNS topic, and SSM parameters + CfnOutputs for
 * operational use.
 *
 * Pre-deploy: The SNS topic is created without subscriptions.
 * Subscribe via: aws sns subscribe --topic-arn <arn> --protocol email --notification-endpoint you@example.com
 */
import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface ObservabilityStackProps extends cdk.StackProps {
  /** 'dev' | 'staging' | 'prod' */
  envName: string;
  /** HTTP API Gateway ID — from ApiStack.httpApi.apiId */
  httpApiId: string;
}

export class ObservabilityStack extends cdk.Stack {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    const { envName, httpApiId } = props;

    const tag = (resource: Construct): void => {
      cdk.Tags.of(resource).add('project', 'aisentinels');
      cdk.Tags.of(resource).add('env', envName);
      cdk.Tags.of(resource).add('stack', 'observability');
    };

    // ── Lambda function names (derived from naming convention) ────────────────
    const businessLambdaNames = [
      'provision', 'documents', 'audits', 'capa', 'records', 'billing',
    ].map((n) => `aisentinels-api-${n}-${envName}`);

    // ══════════════════════════════════════════════════════════════════════════
    // SNS Topic for alarm notifications
    // ══════════════════════════════════════════════════════════════════════════
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: `aisentinels-${envName}-alarms`,
      displayName: `AI Sentinels [${envName}] Platform Alarms`,
    });
    tag(this.alarmTopic);
    const snsAction = new cloudwatch_actions.SnsAction(this.alarmTopic);

    // ══════════════════════════════════════════════════════════════════════════
    // Shared metric helpers
    // ══════════════════════════════════════════════════════════════════════════
    const period5m = cdk.Duration.minutes(5);
    const period1m = cdk.Duration.minutes(1);

    const apiCountMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Count',
      dimensionsMap: { ApiId: httpApiId },
      statistic: 'Sum',
      period: period5m,
      label: 'Requests',
    });

    const api5xxMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '5XXError',
      dimensionsMap: { ApiId: httpApiId },
      statistic: 'Sum',
      period: period5m,
      label: '5xx Errors',
    });

    const apiLatencyMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Latency',
      dimensionsMap: { ApiId: httpApiId },
      statistic: 'p99',
      period: period5m,
      label: 'Latency p99 (ms)',
    });

    // ══════════════════════════════════════════════════════════════════════════
    // CloudWatch Dashboard
    // ══════════════════════════════════════════════════════════════════════════
    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `aisentinels-${envName}-platform`,
      periodOverride: cloudwatch.PeriodOverride.INHERIT,
    });

    // Row 1: API Gateway — requests, 5xx errors, latency
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway — Requests & 5xx Errors',
        width: 12,
        left: [apiCountMetric],
        right: [api5xxMetric],
        leftYAxis: { label: 'Requests', showUnits: false },
        rightYAxis: { label: '5xx Count', showUnits: false },
        view: cloudwatch.GraphWidgetView.TIME_SERIES,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway — Latency p99',
        width: 12,
        left: [apiLatencyMetric],
        leftYAxis: { label: 'ms', showUnits: false },
        view: cloudwatch.GraphWidgetView.TIME_SERIES,
      }),
    );

    // Row 2: Lambda errors and throttles
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda — Errors',
        width: 12,
        left: businessLambdaNames.map(
          (name) =>
            new cloudwatch.Metric({
              namespace: 'AWS/Lambda',
              metricName: 'Errors',
              dimensionsMap: { FunctionName: name },
              statistic: 'Sum',
              period: period5m,
              label: name.replace(`aisentinels-api-`, '').replace(`-${envName}`, ''),
            }),
        ),
        leftYAxis: { label: 'Error Count', showUnits: false },
        view: cloudwatch.GraphWidgetView.TIME_SERIES,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda — Throttles',
        width: 12,
        left: businessLambdaNames.map(
          (name) =>
            new cloudwatch.Metric({
              namespace: 'AWS/Lambda',
              metricName: 'Throttles',
              dimensionsMap: { FunctionName: name },
              statistic: 'Sum',
              period: period5m,
              label: name.replace(`aisentinels-api-`, '').replace(`-${envName}`, ''),
            }),
        ),
        leftYAxis: { label: 'Throttle Count', showUnits: false },
        view: cloudwatch.GraphWidgetView.TIME_SERIES,
      }),
    );

    // Row 3: Lambda duration p99
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda — Duration p99 (ms)',
        width: 24,
        left: businessLambdaNames.map(
          (name) =>
            new cloudwatch.Metric({
              namespace: 'AWS/Lambda',
              metricName: 'Duration',
              dimensionsMap: { FunctionName: name },
              statistic: 'p99',
              period: period5m,
              label: name.replace(`aisentinels-api-`, '').replace(`-${envName}`, ''),
            }),
        ),
        leftYAxis: { label: 'ms', showUnits: false },
        view: cloudwatch.GraphWidgetView.TIME_SERIES,
      }),
    );

    // ══════════════════════════════════════════════════════════════════════════
    // Alarms
    // ══════════════════════════════════════════════════════════════════════════

    // Alarm 1: API Gateway 5xx errors
    const api5xxAlarm = new cloudwatch.Alarm(this, 'Api5xxAlarm', {
      alarmName: `aisentinels-${envName}-api-5xx`,
      alarmDescription: 'API Gateway 5xx errors ≥ 10 in a 5-minute window',
      metric: api5xxMetric,
      threshold: 10,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    api5xxAlarm.addAlarmAction(snsAction);
    api5xxAlarm.addOkAction(snsAction);
    tag(api5xxAlarm);

    // Alarm 2: Combined Lambda errors across all non-billing business Lambdas
    const nonBillingLambdas = businessLambdaNames.filter((n) => !n.includes('-billing-'));
    const lambdaErrorExpression = new cloudwatch.MathExpression({
      expression: nonBillingLambdas.map((_, i) => `m${i}`).join('+'),
      usingMetrics: Object.fromEntries(
        nonBillingLambdas.map((name, i) => [
          `m${i}`,
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Errors',
            dimensionsMap: { FunctionName: name },
            statistic: 'Sum',
            period: period5m,
          }),
        ]),
      ),
      label: 'Total Lambda Errors',
      period: period5m,
    });
    const lambdaErrorAlarm = new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
      alarmName: `aisentinels-${envName}-lambda-errors`,
      alarmDescription: 'Combined Lambda errors ≥ 5 in 5 minutes across all business Lambdas',
      metric: lambdaErrorExpression,
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    lambdaErrorAlarm.addAlarmAction(snsAction);
    tag(lambdaErrorAlarm);

    // Alarm 3: Billing webhook errors (critical — zero tolerance)
    const billingErrorAlarm = new cloudwatch.Alarm(this, 'BillingErrorAlarm', {
      alarmName: `aisentinels-${envName}-billing-webhook-errors`,
      alarmDescription: 'Billing Lambda error detected — Wise payment webhook may be failing',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'Errors',
        dimensionsMap: { FunctionName: `aisentinels-api-billing-${envName}` },
        statistic: 'Sum',
        period: period1m,
        label: 'Billing Lambda Errors',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    billingErrorAlarm.addAlarmAction(snsAction);
    tag(billingErrorAlarm);

    // Row 4: Alarm status widget
    this.dashboard.addWidgets(
      new cloudwatch.AlarmStatusWidget({
        title: 'Alarm Status',
        width: 24,
        alarms: [api5xxAlarm, lambdaErrorAlarm, billingErrorAlarm],
      }),
    );

    // ══════════════════════════════════════════════════════════════════════════
    // SSM Parameters
    // ══════════════════════════════════════════════════════════════════════════
    new ssm.StringParameter(this, 'DashboardNameParam', {
      parameterName: `/aisentinels/${envName}/observability/dashboard-name`,
      stringValue: this.dashboard.dashboardName,
    });
    new ssm.StringParameter(this, 'AlarmTopicArnParam', {
      parameterName: `/aisentinels/${envName}/observability/alarm-topic-arn`,
      stringValue: this.alarmTopic.topicArn,
    });

    // ══════════════════════════════════════════════════════════════════════════
    // CloudFormation Outputs
    // ══════════════════════════════════════════════════════════════════════════
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home#dashboards:name=${this.dashboard.dashboardName}`,
      exportName: `aisentinels-${envName}-dashboard-url`,
      description: 'CloudWatch Dashboard URL',
    });
    new cdk.CfnOutput(this, 'AlarmTopicArnOutput', {
      value: this.alarmTopic.topicArn,
      exportName: `aisentinels-${envName}-alarm-topic-arn`,
      description: 'SNS alarm topic ARN — subscribe: aws sns subscribe --topic-arn <arn> --protocol email --notification-endpoint you@example.com',
    });
  }
}
