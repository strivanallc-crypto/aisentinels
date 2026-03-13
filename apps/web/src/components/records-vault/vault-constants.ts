import type { RecordCategory } from '@/lib/types';

/* ═══════════════════════════════════════════════════════════════════════════ */
/* RV-1 — Records Vault Shared Constants                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

/** Derived record status — computed client-side (VaultRecord has no `status` field) */
export type DerivedStatus = 'legal_hold' | 'due_disposal' | 'verified' | 'active';

/** Category → ISO standard mapping */
export const CATEGORY_ISO_MAP: Record<RecordCategory, string[]> = {
  quality:       ['ISO 9001'],
  training:      ['ISO 9001'],
  calibration:   ['ISO 9001'],
  safety:        ['ISO 45001'],
  incident:      ['ISO 45001'],
  environmental: ['ISO 14001'],
  audit:         ['ISO 19011'],
};

/** Status display configuration */
export const STATUS_CONFIG: Record<DerivedStatus, {
  label: string;
  color: string;
  bgColor: string;
  iconName: 'lock' | 'alert-triangle' | 'check-circle-2' | 'circle';
}> = {
  legal_hold: {
    label: 'Legal Hold',
    color: '#EF4444',
    bgColor: '#EF44441a',
    iconName: 'lock',
  },
  due_disposal: {
    label: 'Due for Disposal',
    color: '#F59E0B',
    bgColor: '#F59E0B1a',
    iconName: 'alert-triangle',
  },
  verified: {
    label: 'Verified',
    color: '#22C55E',
    bgColor: '#22C55E1a',
    iconName: 'check-circle-2',
  },
  active: {
    label: 'Active',
    color: '#9CA3AF',
    bgColor: 'rgba(156, 163, 175, 0.1)',
    iconName: 'circle',
  },
};

/** ISO category group labels for Evidence Mode */
export const ISO_GROUP_LABELS: Record<string, string> = {
  'ISO 9001':  'ISO 9001 — Quality',
  'ISO 14001': 'ISO 14001 — Environmental',
  'ISO 45001': 'ISO 45001 — Safety',
  'ISO 19011': 'ISO 19011 — Audit',
};
