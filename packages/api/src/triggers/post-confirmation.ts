/**
 * PostConfirmation Cognito trigger — non-VPC, no DB access.
 *
 * Fires after a user confirms their email (PostConfirmation_ConfirmSignUp).
 *
 * Assigns a new tenantId UUID and sets the 'owner' role on Cognito user
 * attributes so the pre-token trigger can inject them into every JWT.
 *
 * Guard: If custom:tenantId is ALREADY set (e.g. by an invite flow that called
 * AdminCreateUser with the attribute pre-populated), this trigger skips the
 * write to avoid overwriting the invited tenant with a new random UUID.
 *
 * DB provisioning is intentionally deferred to POST /api/v1/tenants/provision
 * (called from the frontend onboarding flow) to avoid VPC cold-start latency
 * during the email confirmation UX.
 */
import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminUpdateUserAttributesCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { randomUUID } from 'crypto';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
});

export const handler: PostConfirmationTriggerHandler = async (event) => {
  // Only act on sign-up confirmation — not on password reset confirmation
  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') {
    return event;
  }

  // If tenantId is already set (e.g. by invite flow), do NOT overwrite
  const existingTenantId = event.request.userAttributes['custom:tenantId'];
  if (existingTenantId) {
    console.log(
      JSON.stringify({
        event: 'PostConfirmation_SkipExisting',
        user: event.userName,
        tenantId: existingTenantId,
      }),
    );
    return event;
  }

  const tenantId = randomUUID();
  const { userPoolId, userName } = event;

  await cognitoClient.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: userPoolId,
      Username: userName,
      UserAttributes: [
        { Name: 'custom:tenantId', Value: tenantId },
        { Name: 'custom:role', Value: 'owner' },
      ],
    }),
  );

  console.log(
    JSON.stringify({
      event: 'PostConfirmation',
      user: userName,
      tenantId,
    }),
  );

  return event;
};
