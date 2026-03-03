/**
 * PostConfirmation Cognito trigger — non-VPC, no DB access.
 *
 * Fires after a user confirms their email (PostConfirmation_ConfirmSignUp).
 *
 * Assigns a new tenantId UUID and sets the 'owner' role on Cognito user
 * attributes so the pre-token trigger can inject them into every JWT.
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
  // Only act on email sign-up confirmation — not on password reset confirmation
  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') {
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
