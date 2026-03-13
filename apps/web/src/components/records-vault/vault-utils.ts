import type { VaultRecord, RecordCategory } from '@/lib/types';
import type { DerivedStatus } from './vault-constants';
import { CATEGORY_ISO_MAP } from './vault-constants';

/* ═══════════════════════════════════════════════════════════════════════════ */
/* RV-1 — Records Vault Pure Utility Functions                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

/** Enriched record — extends VaultRecord with derived fields */
export interface EnrichedRecord extends VaultRecord {
  derivedStatus: DerivedStatus;
  isoStandards: string[];
}

/** Compute derived status from VaultRecord fields (priority order) */
export function computeDerivedStatus(r: VaultRecord): DerivedStatus {
  if (r.legalHold) return 'legal_hold';
  if (r.retentionExpiresAt && new Date(r.retentionExpiresAt) <= new Date()) return 'due_disposal';
  if (r.integrityVerifiedAt !== null && r.integrityVerifiedAt !== undefined) return 'verified';
  return 'active';
}

/** Enrich a VaultRecord with derived status + ISO standards */
export function enrichRecord(r: VaultRecord): EnrichedRecord {
  return {
    ...r,
    derivedStatus: computeDerivedStatus(r),
    isoStandards: CATEGORY_ISO_MAP[r.category] ?? [],
  };
}

/** KPI stats computed from enriched records */
export interface KpiStats {
  total: number;
  verified: number;
  legalHold: number;
  dueDisposal: number;
}

export function computeKPIs(records: EnrichedRecord[]): KpiStats {
  return {
    total: records.length,
    verified: records.filter((r) => r.derivedStatus === 'verified').length,
    legalHold: records.filter((r) => r.derivedStatus === 'legal_hold').length,
    dueDisposal: records.filter((r) => r.derivedStatus === 'due_disposal').length,
  };
}

/** Category breakdown for navigator panel */
export interface CategoryBreakdown {
  category: RecordCategory;
  count: number;
}

export function computeCategoryBreakdown(records: EnrichedRecord[]): CategoryBreakdown[] {
  const counts = new Map<RecordCategory, number>();
  for (const r of records) {
    counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}
