/**
 * Legal Document Version Constants — Phase 10
 *
 * Single source of truth for current legal document versions.
 * When a legal document is updated, bump the version here —
 * the onboarding gate will require re-acceptance automatically.
 */

export const LEGAL_VERSIONS = {
  terms:   '1.0',
  privacy: '1.0',
  eula:    '1.0',
} as const;

export type LegalDocumentType = keyof typeof LEGAL_VERSIONS;

export const LEGAL_EFFECTIVE_DATE = '2026-03-09';

export const CURRENT_TERMS_VERSION = LEGAL_VERSIONS.terms;
export const CURRENT_PRIVACY_VERSION = LEGAL_VERSIONS.privacy;

/** Returns true if user has accepted all current versions of terms + privacy */
export function hasAcceptedAllCurrentVersions(
  acceptances: Array<{ documentType: string; version: string }>,
): boolean {
  return (
    acceptances.some(
      (a) => a.documentType === 'terms' && a.version === LEGAL_VERSIONS.terms,
    ) &&
    acceptances.some(
      (a) => a.documentType === 'privacy' && a.version === LEGAL_VERSIONS.privacy,
    )
  );
}
