/**
 * CognitoStack — E1.5
 *
 * Provisions the Cognito User Pool that is shared across all tenants of
 * AI Sentinels.  Each tenant gets its own app client (Epic 2 onboarding),
 * but the pool itself is a singleton per environment.
 *
 * Resources created here:
 *  • UserPool                  — TOTP + SMS MFA (optional at signup, required
 *                                after first login for users in the 'admin' group)
 *  • UserPoolDomain            — Cognito-hosted UI domain
 *  • App client — Web SPA      — PKCE, no client secret
 *  • App client — M2M/API GW   — client-credentials flow (server-to-server)
 *  • Pre-token-generation Lambda trigger placeholder (Epic 3 — adds tenantId
 *    custom claim to every JWT)
 *  • Post-confirmation Lambda trigger placeholder (Epic 2 — creates default
 *    tenant row on first admin sign-up)
 *  • SSM Parameters + CfnOutputs for all IDs/ARNs
 */
import * as cdk from 'aws-cdk-lib';
import { SecretValue } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';

export interface CognitoStackProps extends cdk.StackProps {
  /** 'dev' | 'staging' | 'prod' */
  envName: string;
}

export class CognitoStack extends cdk.Stack {
  // ── Public surface ─────────────────────────────────────────────────────────
  public readonly userPool: cognito.UserPool;
  public readonly userPoolDomain: cognito.UserPoolDomain;
  public readonly webAppClient: cognito.UserPoolClient;
  public readonly m2mAppClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: CognitoStackProps) {
    super(scope, id, props);

    const { envName } = props;
    const isProd = envName === 'prod';

    const tag = (resource: Construct): void => {
      cdk.Tags.of(resource).add('project', 'aisentinels');
      cdk.Tags.of(resource).add('env', envName);
      cdk.Tags.of(resource).add('stack', 'cognito');
    };

    // ══════════════════════════════════════════════════════════════════════════
    // Lambda execution role — shared by trigger placeholders
    // Full trigger logic is added in Epic 2 (post-confirmation) and
    // Epic 3 (pre-token-generation).  The role is created now so its ARN
    // can be referenced across stacks without redeploying Cognito.
    // ══════════════════════════════════════════════════════════════════════════
    const triggerRole = new iam.Role(this, 'TriggerLambdaRole', {
      roleName: `aisentinels-cognito-trigger-${envName}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Execution role for Cognito trigger Lambdas (post-confirm, pre-token)',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });
    tag(triggerRole);

    // ── Post-confirmation trigger (placeholder — Epic 2 adds tenant-init logic)
    const postConfirmLogGroup = new logs.LogGroup(this, 'PostConfirmLogGroup', {
      logGroupName: `/aws/lambda/aisentinels-cognito-post-confirm-${envName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    tag(postConfirmLogGroup);

    const postConfirmFn = new NodejsFunction(this, 'PostConfirmationFn', {
      functionName: `aisentinels-cognito-post-confirm-${envName}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, '../../../../packages/api/src/triggers/post-confirmation.ts'),
      handler: 'handler',
      role: triggerRole,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: { ENV_NAME: envName },
      logGroup: postConfirmLogGroup,
      bundling: {
        minify: true,
        target: 'node22',
        format: OutputFormat.CJS,
        externalModules: ['@aws-sdk/*'],
      },
    });
    tag(postConfirmFn);

    // ── Pre-token-generation trigger (placeholder — Epic 3 adds tenantId claim)
    const preTokenLogGroup = new logs.LogGroup(this, 'PreTokenLogGroup', {
      logGroupName: `/aws/lambda/aisentinels-cognito-pre-token-${envName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    tag(preTokenLogGroup);

    const preTokenFn = new NodejsFunction(this, 'PreTokenGenerationFn', {
      functionName: `aisentinels-cognito-pre-token-${envName}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, '../../../../packages/api/src/triggers/pre-token-generation.ts'),
      handler: 'handler',
      role: triggerRole,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: { ENV_NAME: envName },
      logGroup: preTokenLogGroup,
      bundling: {
        minify: true,
        target: 'node22',
        format: OutputFormat.CJS,
        externalModules: ['@aws-sdk/*'],
      },
    });
    tag(preTokenFn);

    // ══════════════════════════════════════════════════════════════════════════
    // User Pool
    //
    // Sign-in: email only (username alias disabled)
    // Password policy: 12 chars, uppercase + lowercase + digit + symbol
    // MFA: OPTIONAL at pool level; enforced for Admin group in ComputeStack
    //      via Cognito group + pre-token trigger
    // Account recovery: email only (no SMS fallback — avoids SMS cost at scale)
    // Self sign-up: DISABLED — tenants are provisioned via admin flow (Epic 2)
    // ══════════════════════════════════════════════════════════════════════════
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `aisentinels-${envName}`,
      selfSignUpEnabled: false, // Tenant admins are invited, not self-registered

      // Sign-in aliases
      signInAliases: {
        email: true,
        username: false,
        phone: false,
      },
      autoVerify: { email: true },
      keepOriginal: { email: true }, // Require re-verify if email changes

      // Password policy
      passwordPolicy: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(7),
      },

      // MFA — OPTIONAL at pool level; enforced per user-group in app logic
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: false,   // No SMS — TOTP only (avoids SNS charges + SIM-swap risk)
        otp: true,    // TOTP authenticator app (Google Authenticator, Authy, etc.)
      },

      // Account recovery — email only
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,

      // Custom attributes consumed by the pre-token trigger (Epic 3)
      customAttributes: {
        tenantId: new cognito.StringAttribute({
          minLen: 1,
          maxLen: 64,
          mutable: true, // Needs mutable=true so admin can set after invite
        }),
        role: new cognito.StringAttribute({
          minLen: 1,
          maxLen: 32,
          mutable: true,
        }),
      },

      // User-facing email (Cognito default SES for now — Epic 6 upgrades to SES custom domain)
      email: cognito.UserPoolEmail.withCognito(),

      // Trigger Lambdas
      // Note: preTokenGeneration is NOT set here — it must use addTrigger() with
      // LambdaVersion.V2_0 (below) to enable claimsAndScopeOverrideDetails.
      lambdaTriggers: {
        postConfirmation: postConfirmFn,
      },

      // Device tracking — not needed (stateless JWT)
      deviceTracking: {
        challengeRequiredOnNewDevice: false,
        deviceOnlyRememberedOnUserPrompt: false,
      },

      // Deletion protection for prod
      deletionProtection: isProd,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,

      // Threat protection — full enforcement (block + log anomalies)
      standardThreatProtectionMode: cognito.StandardThreatProtectionMode.FULL_FUNCTION,
    });
    tag(this.userPool);

    // Wire preTokenGeneration as V2_0 — must use addTrigger, not lambdaTriggers,
    // to enable claimsAndScopeOverrideDetails (required for access token injection).
    // addTrigger() automatically adds the Lambda resource-based permission.
    this.userPool.addTrigger(
      cognito.UserPoolOperation.PRE_TOKEN_GENERATION_CONFIG,
      preTokenFn,
      cognito.LambdaVersion.V2_0,
    );

    // Trigger Lambdas share triggerRole. This policy grants both postConfirmFn
    // and preTokenFn permission to call AdminUpdateUserAttributes.
    // Uses ${region}_* pattern (not this.userPool.userPoolArn) to break
    // circular dependency: UserPool -> PostConfirmFn -> Role -> Policy -> UserPool
    postConfirmFn.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'AllowCognitoUpdateAttributes',
        actions: ['cognito-idp:AdminUpdateUserAttributes'],
        resources: [
          `arn:aws:cognito-idp:${this.region}:${this.account}:userpool/${this.region}_*`,
        ],
      }),
    );

    // ══════════════════════════════════════════════════════════════════════════
    // Cognito-hosted UI domain
    // Domain prefix must be globally unique: aisentinels-<env>-<accountId>
    // ══════════════════════════════════════════════════════════════════════════
    this.userPoolDomain = this.userPool.addDomain('HostedUiDomain', {
      cognitoDomain: {
        domainPrefix: `aisentinels-${envName}-${this.account}`,
      },
    });
    tag(this.userPoolDomain);

    // ══════════════════════════════════════════════════════════════════════════
    // Google Federated Identity Provider
    //
    // Google sign-in flows through Cognito's hosted UI so that users get a
    // proper Cognito JWT (access_token + id_token) that API Gateway can
    // validate.  Credentials are stored in SSM Parameter Store.
    // ══════════════════════════════════════════════════════════════════════════
    const googleClientId = ssm.StringParameter.valueForStringParameter(
      this, `/aisentinels/${envName}/auth/google-client-id`,
    );
    const googleClientSecret = ssm.StringParameter.valueForStringParameter(
      this, `/aisentinels/${envName}/auth/google-client-secret`,
    );

    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(
      this, 'GoogleProvider', {
        userPool: this.userPool,
        clientId: googleClientId,
        clientSecretValue: SecretValue.unsafePlainText(googleClientSecret),
        scopes: ['openid', 'email', 'profile'],
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
          givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
          familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
        },
      },
    );
    tag(googleProvider);
    // ══════════════════════════════════════════════════════════════════════════
    // App Client 1 — Web SPA  (PKCE, Authorization Code, no secret)
    //
    // Used by the Next.js frontend via Auth.js / Amazon Cognito provider.
    // Refresh token: 30 days (prod) / 1 day (dev)
    // Access token: 1 hour
    // ══════════════════════════════════════════════════════════════════════════
    this.webAppClient = this.userPool.addClient('WebAppClient', {
      userPoolClientName: `aisentinels-web-${envName}`,
      generateSecret: false, // SPA — secret not safe to embed in browser

      // Identity providers — both native Cognito email/password and Google federation
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        cognito.UserPoolClientIdentityProvider.GOOGLE,
      ],

      authFlows: {
        // PKCE Authorization Code flow only — most secure for SPAs
        userSrp: false,
        userPassword: false,
        adminUserPassword: false, // Enabled in ComputeStack admin Lambda only
        custom: false,
      },

      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false, // Deprecated — never use
          clientCredentials: false,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        // Callback URLs — placeholder localhost for dev; production URL set in Epic 5
        callbackUrls: isProd
          ? [
              'https://app.aisentinels.io/api/auth/callback/cognito',
              'https://aisentinels.io/api/auth/callback/cognito',
              'https://www.aisentinels.io/api/auth/callback/cognito',
            ]
          : ['http://localhost:3000/api/auth/callback/cognito'],
        logoutUrls: isProd
          ? [
              'https://app.aisentinels.io',
              'https://aisentinels.io',
              'https://www.aisentinels.io',
            ]
          : ['http://localhost:3000'],
      },

      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: isProd ? cdk.Duration.days(30) : cdk.Duration.days(1),

      // Prevent token reuse after refresh (security hardening)
      enableTokenRevocation: true,
      preventUserExistenceErrors: true, // Mitigate user-enumeration attacks

      // Read/write access to custom attributes
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true, emailVerified: true, fullname: true })
        .withCustomAttributes('tenantId', 'role'),
      writeAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true, fullname: true }),
      // Custom attributes (tenantId, role) are set by admin flow — not user self-write
    });

    // Ensure Google IdP is created before the app client references it
    this.webAppClient.node.addDependency(googleProvider);

    // ══════════════════════════════════════════════════════════════════════════
    // App Client 2 — M2M / API Gateway  (client credentials, with secret)
    //
    // Used for server-to-server calls (background workers, webhooks) that
    // need a machine identity but no user context.
    // ══════════════════════════════════════════════════════════════════════════
    // Resource server for M2M scopes
    const apiResourceServer = this.userPool.addResourceServer('ApiResourceServer', {
      identifier: `https://api.aisentinels.io/${envName}`,
      userPoolResourceServerName: `aisentinels-api-${envName}`,
      scopes: [
        {
          scopeName: 'read',
          scopeDescription: 'Read-only access to AI Sentinels API',
        },
        {
          scopeName: 'write',
          scopeDescription: 'Read-write access to AI Sentinels API',
        },
        {
          scopeName: 'admin',
          scopeDescription: 'Administrative access to AI Sentinels API',
        },
      ],
    });

    this.m2mAppClient = this.userPool.addClient('M2mAppClient', {
      userPoolClientName: `aisentinels-m2m-${envName}`,
      generateSecret: true, // M2M — secret stored server-side

      authFlows: {
        userSrp: false,
        userPassword: false,
        adminUserPassword: false,
        custom: false,
      },

      oAuth: {
        flows: {
          authorizationCodeGrant: false,
          implicitCodeGrant: false,
          clientCredentials: true, // M2M flow
        },
        scopes: [
          cognito.OAuthScope.resourceServer(apiResourceServer, {
            scopeName: 'read',
            scopeDescription: 'Read-only access to AI Sentinels API',
          }),
          cognito.OAuthScope.resourceServer(apiResourceServer, {
            scopeName: 'write',
            scopeDescription: 'Read-write access to AI Sentinels API',
          }),
        ],
      },

      accessTokenValidity: cdk.Duration.hours(1),
      // Refresh tokens are not issued for client_credentials flow
      enableTokenRevocation: true,
      preventUserExistenceErrors: true,
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Cognito → Lambda trigger permissions
    // Both lambdaTriggers (postConfirmation) and addTrigger (preTokenGeneration)
    // automatically grant invoke permissions — no explicit addPermission needed.
    // ══════════════════════════════════════════════════════════════════════════

    // ══════════════════════════════════════════════════════════════════════════
    // SSM Parameters — consumed by downstream stacks at deploy time
    // ══════════════════════════════════════════════════════════════════════════
    const ssmDefs: Array<[string, string, string]> = [
      ['SsmUserPoolId', 'user-pool-id', this.userPool.userPoolId],
      ['SsmUserPoolArn', 'user-pool-arn', this.userPool.userPoolArn],
      ['SsmUserPoolDomain', 'user-pool-domain', this.userPoolDomain.domainName],
      ['SsmWebClientId', 'web-client-id', this.webAppClient.userPoolClientId],
      ['SsmM2mClientId', 'm2m-client-id', this.m2mAppClient.userPoolClientId],
      ['SsmPostConfirmFnArn', 'post-confirm-fn-arn', postConfirmFn.functionArn],
      ['SsmPreTokenFnArn', 'pre-token-fn-arn', preTokenFn.functionArn],
    ];

    for (const [id, name, value] of ssmDefs) {
      new ssm.StringParameter(this, id, {
        parameterName: `/aisentinels/${envName}/cognito/${name}`,
        stringValue: value,
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CloudFormation Outputs
    // ══════════════════════════════════════════════════════════════════════════
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: `aisentinels-${envName}-user-pool-id`,
      description: 'Cognito User Pool ID',
    });
    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      exportName: `aisentinels-${envName}-user-pool-arn`,
    });
    new cdk.CfnOutput(this, 'UserPoolDomain', {
      value: this.userPoolDomain.domainName,
      exportName: `aisentinels-${envName}-user-pool-domain`,
      description: 'Cognito hosted UI domain prefix',
    });
    new cdk.CfnOutput(this, 'WebClientId', {
      value: this.webAppClient.userPoolClientId,
      exportName: `aisentinels-${envName}-web-client-id`,
      description: 'Web SPA app client ID (PKCE, no secret)',
    });
    new cdk.CfnOutput(this, 'M2mClientId', {
      value: this.m2mAppClient.userPoolClientId,
      exportName: `aisentinels-${envName}-m2m-client-id`,
      description: 'M2M app client ID (client_credentials)',
    });
    new cdk.CfnOutput(this, 'HostedUiBaseUrl', {
      value: this.userPoolDomain.baseUrl(),
      exportName: `aisentinels-${envName}-hosted-ui-url`,
      description: 'Base URL for Cognito hosted UI',
    });
    new cdk.CfnOutput(this, 'PostConfirmFnArn', {
      value: postConfirmFn.functionArn,
      exportName: `aisentinels-${envName}-post-confirm-fn-arn`,
      description: 'Post-confirmation Lambda ARN (replace in Epic 2)',
    });
    new cdk.CfnOutput(this, 'PreTokenFnArn', {
      value: preTokenFn.functionArn,
      exportName: `aisentinels-${envName}-pre-token-fn-arn`,
      description: 'Pre-token-generation Lambda ARN (replace in Epic 3)',
    });
  }
}
