/**
 * PreTokenGeneration V2.0 Cognito trigger — non-VPC.
 *
 * Injects email, tenantId and role claims into BOTH the id token and the
 * access token on every authentication.
 *
 * CRITICAL — accessTokenGeneration is NOT optional:
 *   API Gateway JWT authorizer validates the ACCESS token (not the id token).
 *   If tenantId or email is missing from the access token, auth-context.ts
 *   throws on every protected route and all API calls return 500.
 *
 * Missing-tenantId fallback:
 *   Google-federated users may bypass PostConfirmation, leaving custom:tenantId
 *   unset. When detected, this trigger generates a new UUID, backfills the
 *   Cognito attribute (so future logins skip the slow path), and injects the
 *   generated tenantId into the current token. The AdminUpdateUserAttributes
 *   call is wrapped in try/catch — failure is logged but never thrown.
 *
 * Wired as V2_0 in CognitoStack via:
 *   userPool.addTrigger(
 *     cognito.UserPoolOperation.PRE_TOKEN_GENERATION_CONFIG,
 *     preTokenFn,
 *     cognito.LambdaVersion.V2_0,
 *   )
 */
import type { PreTokenGenerationV2TriggerHandler } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminUpdateUserAttributesCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { randomUUID } from 'crypto';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
});

export const handler: PreTokenGenerationV2TriggerHandler = async (event) => {
  const attrs = event.request.userAttributes;
  const email = attrs['email'] ?? '';

  let tenantId = attrs['custom:tenantId'] ?? '';
  let role = attrs['custom:role'] ?? '';

  // ── Missing tenantId fallback ──────────────────────────────────────────────
  // Google-federated users may bypass PostConfirmation, leaving custom:tenantId
  // unset. Generate a new UUID, backfill the Cognito attribute so future logins
  // skip this branch, and continue with token generation.
  if (!tenantId) {
    tenantId = randomUUID();
    role = role || 'owner';

    try {
      await cognitoClient.send(
        new AdminUpdateUserAttributesCommand({
          UserPoolId: event.userPoolId,
          Username: event.userName,
          UserAttributes: [
            { Name: 'custom:tenantId', Value: tenantId },
            { Name: 'custom:role', Value: role },
          ],
        }),
      );
      console.log(
        JSON.stringify({
          event: 'PreTokenGeneration_BackfillTenantId',
          user: event.userName,
          tenantId,
          role,
          triggerSource: event.triggerSource,
        }),
      );
    } catch (err) {
      // Log but do NOT throw — still inject the generated tenantId into this
      // token so the user can proceed. The backfill will retry on next login.
      console.error(
        JSON.stringify({
          event: 'PreTokenGeneration_BackfillFailed',
          user: event.userName,
          tenantId,
          error: String(err),
        }),
      );
    }
  }

  event.response = {
    claimsAndScopeOverrideDetails: {
      // id token — used by the frontend for identity display
      idTokenGeneration: {
        claimsToAddOrOverride: { email, tenantId, role },
      },
      // access token — validated by API Gateway JWT authorizer on every request
      accessTokenGeneration: {
        claimsToAddOrOverride: { email, tenantId, role },
      },
    },
  };

  return event;
};
