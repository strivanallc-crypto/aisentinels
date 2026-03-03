/**
 * PreTokenGeneration V2.0 Cognito trigger — non-VPC, no DB access.
 *
 * Injects tenantId and role claims into BOTH the id token and the access token
 * on every authentication.
 *
 * CRITICAL — accessTokenGeneration is NOT optional:
 *   API Gateway JWT authorizer validates the ACCESS token (not the id token).
 *   If tenantId is missing from the access token, auth-context.ts throws on
 *   every protected route and all API calls return 401.
 *
 * Wired as V2_0 in CognitoStack via:
 *   userPool.addTrigger(
 *     cognito.UserPoolOperation.PRE_TOKEN_GENERATION_CONFIG,
 *     preTokenFn,
 *     cognito.LambdaVersion.V2_0,
 *   )
 */
import type { PreTokenGenerationV2TriggerHandler } from 'aws-lambda';

export const handler: PreTokenGenerationV2TriggerHandler = async (event) => {
  const attrs = event.request.userAttributes;
  const tenantId = attrs['custom:tenantId'] ?? '';
  const role = attrs['custom:role'] ?? '';

  event.response = {
    claimsAndScopeOverrideDetails: {
      // id token — used by the frontend for identity display
      idTokenGeneration: {
        claimsToAddOrOverride: { tenantId, role },
      },
      // access token — validated by API Gateway JWT authorizer on every request
      accessTokenGeneration: {
        claimsToAddOrOverride: { tenantId, role },
      },
    },
  };

  return event;
};
