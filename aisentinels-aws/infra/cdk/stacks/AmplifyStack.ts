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
// node-linker=hoisted: Amplify's bundler cannot follow pnpm symlinks, so we
// flatten node_modules at build time (does not affect local dev).
// Post-build symlink: Amplify checks apps/web/node_modules for 'next' at runtime;
// with hoisted layout all deps live at root, so we symlink to satisfy the check.
const BUILD_SPEC = `version: 1
applications:
  - appRoot: apps/web
    frontend:
      phases:
        preBuild:
          commands:
            - npm install -g pnpm@9.15.0
            - cd ../.. && echo "node-linker=hoisted" > .npmrc && pnpm install --frozen-lockfile
        build:
          commands:
            - cd ../.. && pnpm --filter @aisentinels/web run build
            - rm -rf node_modules 2>/dev/null; ln -s ../../node_modules node_modules
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

    // API endpoint
    const apiEndpoint = ssm.StringParameter.valueForStringParameter(
      this,
      `/aisentinels/${envName}/api/endpoint`,
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

      environmentVariables: [
        { name: 'NEXT_PUBLIC_API_URL',    value: apiEndpoint },
        { name: 'NEXT_PUBLIC_AWS_REGION', value: this.region },
        { name: 'COGNITO_CLIENT_ID',      value: webClientId },
        { name: 'COGNITO_ISSUER',         value: cognitoIssuer },
        // NEXTAUTH_URL:    set manually in Amplify Console after first deploy
        //                  (value: https://{branch}.{appId}.amplifyapp.com)
        // NEXTAUTH_SECRET: set manually in Amplify Console — never in CDK
        // COGNITO_CLIENT_SECRET: set manually if needed (PKCE flow may not require it)
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
