/**
 * AmplifyStack — E6
 *
 * Provisions AWS Amplify Hosting for the Next.js SSR frontend (apps/web).
 * Connects to GitHub via a PAT stored in Secrets Manager and auto-deploys
 * on push to the target branch.
 *
 * All runtime configuration values (Cognito IDs, API endpoint) are read from
 * SSM Parameter Store at deploy time — no cross-stack CloudFormation token
 * passing. AmplifyStack only depends on CognitoStack and ApiStack for ordering.
 *
 * Pre-deploy manual steps (user must complete before `cdk deploy AmplifyStack`):
 *   1. Create Secrets Manager secret `/aisentinels/github/token`
 *      containing the GitHub PAT (repo + webhook scopes)
 *   2. Create SSM parameter `/aisentinels/github/repo-url`
 *      containing the full GitHub HTTPS URL (e.g. https://github.com/org/repo)
 *   3. After first deploy: add NEXTAUTH_URL + NEXTAUTH_SECRET in Amplify Console
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as amplify from 'aws-cdk-lib/aws-amplify';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export interface AmplifyStackProps extends cdk.StackProps {
  envName: string;
}

// Build spec — pnpm monorepo with 'applications' key for Amplify monorepo support
// .npmrc sets node-linker=hoisted so pnpm creates flat node_modules (per Amplify FAQ).
// This ensures Amplify's post-build check finds node_modules/next as a real directory.
const BUILD_SPEC = `version: 1
applications:
  - appRoot: apps/web
    frontend:
      phases:
        preBuild:
          commands:
            - npm install -g pnpm@9.15.0
            - cd ../.. && pnpm install --frozen-lockfile && cd apps/web
            - |
              echo "AUTH_SECRET=$AUTH_SECRET" >> .env.production
              echo "NEXTAUTH_SECRET=$NEXTAUTH_SECRET" >> .env.production
              echo "AUTH_URL=$AUTH_URL" >> .env.production
              echo "NEXTAUTH_URL=$NEXTAUTH_URL" >> .env.production
              echo "AUTH_TRUST_HOST=$AUTH_TRUST_HOST" >> .env.production
              echo "COGNITO_CLIENT_ID=$COGNITO_CLIENT_ID" >> .env.production
              echo "COGNITO_CLIENT_SECRET=$COGNITO_CLIENT_SECRET" >> .env.production
              echo "COGNITO_ISSUER=$COGNITO_ISSUER" >> .env.production
              echo "COGNITO_DOMAIN=$COGNITO_DOMAIN" >> .env.production
              echo "GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID" >> .env.production
              echo "GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET" >> .env.production
              echo "NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL" >> .env.production
              echo "NEXT_PUBLIC_AWS_REGION=$NEXT_PUBLIC_AWS_REGION" >> .env.production
        build:
          commands:
            - cd ../.. && pnpm --filter @aisentinels/web run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - .next/cache/**/*
          - ../../node_modules/**/*
`;

export class AmplifyStack extends cdk.Stack {
  public readonly appId: string;
  public readonly defaultDomain: string;

  constructor(scope: Construct, id: string, props: AmplifyStackProps) {
    super(scope, id, props);

    const { envName } = props;
    const isProd    = envName === 'prod';
    const branch    = isProd ? 'main' : 'develop';

    // ── Secrets & SSM lookups (all resolved at deploy time) ────────────────────
    // GitHub PAT — user must create /aisentinels/github/token in Secrets Manager
    const githubToken = secretsmanager.Secret.fromSecretNameV2(
      this,
      'GhToken',
      '/aisentinels/github/token',
    );

    // GitHub repo URL — user must populate /aisentinels/github/repo-url in SSM
    const repoUrl = ssm.StringParameter.valueForStringParameter(
      this,
      '/aisentinels/github/repo-url',
    );

    // Cognito values
    const userPoolId = ssm.StringParameter.valueForStringParameter(
      this,
      `/aisentinels/${envName}/cognito/user-pool-id`,
    );
    const webClientId = ssm.StringParameter.valueForStringParameter(
      this,
      `/aisentinels/${envName}/cognito/web-client-id`,
    );
    const userPoolDomainPrefix = ssm.StringParameter.valueForStringParameter(
      this,
      `/aisentinels/${envName}/cognito/user-pool-domain`,
    );

    // Full Cognito hosted UI domain — used by Auth.js for explicit OAuth endpoints
    const cognitoDomain = `${userPoolDomainPrefix}.auth.${this.region}.amazoncognito.com`;

    // API endpoint
    const apiEndpoint = ssm.StringParameter.valueForStringParameter(
      this,
      `/aisentinels/${envName}/api/endpoint`,
    );

    // Google OAuth credentials — stored in Secrets Manager as JSON
    const googleOauth = secretsmanager.Secret.fromSecretNameV2(
      this,
      'GoogleOAuth',
      'aisentinels/google-oauth',
    );

    // Auth.js secret — used for JWT encryption and CSRF protection
    const authSecret = secretsmanager.Secret.fromSecretCompleteArn(
      this,
      'AuthSecret',
      'arn:aws:secretsmanager:us-east-1:304242047817:secret:aisentinels/auth-secret-yIs85M',
    );

    // Cognito OIDC issuer — constructed from user pool ID + region
    const cognitoIssuer = `https://cognito-idp.${this.region}.amazonaws.com/${userPoolId}`;

    // ── Amplify App ─────────────────────────────────────────────────────────────
    const amplifyApp = new amplify.CfnApp(this, 'AmplifyApp', {
      name:       `aisentinels-${envName}`,
      repository: repoUrl,

      // TODO: Replace CfnApp (L1) with @aws-cdk/aws-amplify-alpha (L2) when stable
      // to avoid embedding the GitHub PAT in the CloudFormation template.
      // Tracked: E10 security hardening.
      oauthToken: githubToken.secretValue.unsafeUnwrap(),

      platform: 'WEB_COMPUTE', // Next.js App Router SSR — required for server components

      buildSpec: BUILD_SPEC,

      // ── Custom headers — CSP, security headers ──────────────────────────────
      // Calendly embed needs script-src, style-src, frame-src allowlisted.
      customHeaders: `customHeaders:
  - pattern: '**/*'
    headers:
      - key: Content-Security-Policy
        value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://assets.calendly.com; style-src 'self' 'unsafe-inline' https://assets.calendly.com; frame-src 'self' https://calendly.com; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.amazonaws.com https://*.amazoncognito.com https://accounts.google.com https://calendly.com"
      - key: X-Frame-Options
        value: SAMEORIGIN
      - key: X-Content-Type-Options
        value: nosniff
      - key: Referrer-Policy
        value: strict-origin-when-cross-origin`,

      environmentVariables: [
        { name: 'AMPLIFY_MONOREPO_APP_ROOT', value: 'apps/web' },
        { name: 'NEXT_PUBLIC_API_URL',    value: apiEndpoint },
        { name: 'NEXT_PUBLIC_AWS_REGION', value: this.region },
        { name: 'COGNITO_CLIENT_ID',      value: webClientId },
        { name: 'COGNITO_ISSUER',         value: cognitoIssuer },
        { name: 'COGNITO_DOMAIN',         value: cognitoDomain },
        { name: 'GOOGLE_CLIENT_ID',       value: googleOauth.secretValueFromJson('client_id').unsafeUnwrap() },
        { name: 'GOOGLE_CLIENT_SECRET',   value: googleOauth.secretValueFromJson('client_secret').unsafeUnwrap() },
        { name: 'AUTH_SECRET',            value: authSecret.secretValue.unsafeUnwrap() },
        { name: 'NEXTAUTH_SECRET',        value: authSecret.secretValue.unsafeUnwrap() },
        { name: 'AUTH_URL',               value: 'https://aisentinels.io' },
        { name: 'NEXTAUTH_URL',           value: 'https://aisentinels.io' },
        { name: 'AUTH_TRUST_HOST',        value: 'true' },
      ],
    });

    this.appId = amplifyApp.attrAppId;

    // ── Branch (auto-deploy on push) ────────────────────────────────────────────
    const mainBranch = new amplify.CfnBranch(this, 'MainBranch', {
      appId:           amplifyApp.attrAppId,
      branchName:      branch,
      enableAutoBuild: true,
      framework:       'Next.js - SSR',
      stage:           isProd ? 'PRODUCTION' : 'DEVELOPMENT',
    });

    this.defaultDomain = amplifyApp.attrDefaultDomain;

    const appUrl = `https://${branch}.${amplifyApp.attrDefaultDomain}`;

    // ── Custom Domain — aisentinels.io (E10) ────────────────────────────────────
    // Maps both apex (aisentinels.io) and www subdomain to the same branch.
    // After deploy: check Amplify Console → Domain Management for the DNS
    // verification CNAME and the ALIAS/ANAME record to add at your registrar.
    const customDomain = new amplify.CfnDomain(this, 'CustomDomain', {
      appId:      amplifyApp.attrAppId,
      domainName: 'aisentinels.io',
      subDomainSettings: [
        { branchName: mainBranch.branchName, prefix: '' },    // apex: aisentinels.io
        { branchName: mainBranch.branchName, prefix: 'www' }, // www.aisentinels.io
      ],
      enableAutoSubDomain: false,
    });
    customDomain.addDependency(mainBranch);

    // ── SSM Outputs ─────────────────────────────────────────────────────────────
    new ssm.StringParameter(this, 'SsmAmplifyAppId', {
      parameterName: `/aisentinels/${envName}/amplify/app-id`,
      stringValue:   amplifyApp.attrAppId,
    });
    new ssm.StringParameter(this, 'SsmAmplifyUrl', {
      parameterName: `/aisentinels/${envName}/amplify/app-url`,
      stringValue:   appUrl,
    });

    // ── CloudFormation Outputs ───────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'AmplifyAppId', {
      value:       amplifyApp.attrAppId,
      exportName:  `aisentinels-${envName}-amplify-app-id`,
      description: 'AWS Amplify Application ID',
    });
    new cdk.CfnOutput(this, 'AmplifyUrl', {
      value:       appUrl,
      exportName:  `aisentinels-${envName}-amplify-url`,
      description: `Amplify hosted URL (${branch} branch)`,
    });
    new cdk.CfnOutput(this, 'ProductionDomain', {
      value:       'https://aisentinels.io',
      exportName:  `aisentinels-${envName}-production-domain`,
      description: 'Production custom domain — configure DNS at registrar after first deploy',
    });
    new cdk.CfnOutput(this, 'AmplifyDnsVerificationNote', {
      value:       'After deploy: check Amplify Console → Domain Management for CNAME/ALIAS records to add at registrar',
      exportName:  `aisentinels-${envName}-dns-note`,
      description: 'Manual DNS step required after CDK deploy',
    });

    // Suppress CDK nag warning for intentional unsafeUnwrap — tracked in E10
    cdk.Aspects.of(amplifyApp).add(new cdk.Tag('amplify:github-pat-exposure', 'tracked-E10'));

    // Ensure branch depends on app
    mainBranch.addDependency(amplifyApp);

    // ── Stack tags ───────────────────────────────────────────────────────────────
    cdk.Tags.of(this).add('stack', 'amplify');
  }
}
