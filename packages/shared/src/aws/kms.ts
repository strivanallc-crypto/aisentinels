/**
 * packages/shared/src/aws/kms.ts
 *
 * Runtime utilities for tenant-scoped KMS CMK management.
 *
 * Per-tenant CMKs for S3 object encryption are NOT created in the CDK stacks
 * (SecurityStack only creates the shared platform CMKs). Instead, tenant keys
 * are created here at tenant onboarding time via the tenant provisioning Lambda.
 *
 * Full implementation is wired in Epic 3 (Tenant Provisioning).
 */

import {
  KMSClient,
  CreateKeyCommand,
  CreateAliasCommand,
  EnableKeyRotationCommand,
  type CreateKeyCommandOutput,
} from '@aws-sdk/client-kms';

export interface CreateTenantKeyInput {
  /** The tenant's unique ID (UUID) */
  tenantId: string;
  /** Environment — drives alias prefix */
  env: 'dev' | 'staging' | 'prod';
  /** AWS region — defaults to process.env.AWS_REGION */
  region?: string;
}

export interface CreateTenantKeyOutput {
  keyId: string;
  keyArn: string;
  alias: string;
}

/**
 * Creates a per-tenant S3 CMK (symmetric, AES-256) and enables annual rotation.
 *
 * Called during tenant onboarding by the provisioning Lambda:
 *   packages/api/src/lambdas/tenant-provision.ts
 *
 * Key alias format: alias/aisentinels-tenant-{tenantId}-{env}
 *
 * @throws KMS errors are surfaced as-is — caller is responsible for retries.
 */
export async function createTenantKey(
  input: CreateTenantKeyInput,
): Promise<CreateTenantKeyOutput> {
  const { tenantId, env, region = process.env.AWS_REGION } = input;

  const client = new KMSClient({ region });
  const alias = `alias/aisentinels-tenant-${tenantId}-${env}`;

  // Create the key
  const createResult: CreateKeyCommandOutput = await client.send(
    new CreateKeyCommand({
      Description: `AI Sentinels per-tenant S3 CMK — tenantId=${tenantId} env=${env}`,
      KeyUsage: 'ENCRYPT_DECRYPT',
      KeySpec: 'SYMMETRIC_DEFAULT',
      MultiRegion: false,
      Tags: [
        { TagKey: 'project', TagValue: 'aisentinels' },
        { TagKey: 'env', TagValue: env },
        { TagKey: 'tenantId', TagValue: tenantId },
        { TagKey: 'managedBy', TagValue: 'tenant-provisioning' },
      ],
    }),
  );

  const keyId = createResult.KeyMetadata!.KeyId!;
  const keyArn = createResult.KeyMetadata!.Arn!;

  // Attach alias
  await client.send(
    new CreateAliasCommand({
      AliasName: alias,
      TargetKeyId: keyId,
    }),
  );

  // Enable annual key rotation (symmetric keys only)
  await client.send(
    new EnableKeyRotationCommand({ KeyId: keyId }),
  );

  return { keyId, keyArn, alias };
}
