// ── Sentinel Config — single source of truth ────────────────────────────────
//
// Domain Sentinels (ISO knowledge): Qualy=9001, Envi=14001, Saffy=45001
// Module Sentinels (do the work):   Doki=DocStudio, Audie=AuditRoom, Nexus=CAPA
// Channeling: module sentinel does the work + domain sentinel provides ISO knowledge

export type SentinelId = 'qualy' | 'envi' | 'saffy' | 'doki' | 'audie' | 'nexus';

export interface SentinelConfig {
  id: SentinelId;
  name: string;
  title: string;
  role: string;
  standard?: string;
  color: string;
  avatarPath: string | null;
  initial: string;
}

export const SENTINELS: Record<SentinelId, SentinelConfig> = {
  qualy: {
    id: 'qualy',
    name: 'Qualy',
    title: 'Quality Sentinel',
    role: 'ISO 9001 Quality',
    standard: 'ISO 9001',
    color: '#3B82F6',
    avatarPath: '/sentinels/qualy-avatar.png',
    initial: 'Q',
  },
  envi: {
    id: 'envi',
    name: 'Envi',
    title: 'Environmental Sentinel',
    role: 'ISO 14001 Environment',
    standard: 'ISO 14001',
    color: '#22C55E',
    avatarPath: '/sentinels/envi-avatar.png',
    initial: 'E',
  },
  saffy: {
    id: 'saffy',
    name: 'Saffy',
    title: 'Safety Sentinel',
    role: 'ISO 45001 Safety',
    standard: 'ISO 45001',
    color: '#F59E0B',
    avatarPath: '/sentinels/saffy-avatar.png',
    initial: 'S',
  },
  doki: {
    id: 'doki',
    name: 'Doki',
    title: 'Document Sentinel',
    role: 'Document Studio',
    color: '#6366F1',
    avatarPath: '/sentinels/doki-avatar.png',
    initial: 'D',
  },
  audie: {
    id: 'audie',
    name: 'Audie',
    title: 'Audit Sentinel',
    role: 'Audit Room',
    color: '#F43F5E',
    avatarPath: '/sentinels/audie-avatar.png',
    initial: 'A',
  },
  nexus: {
    id: 'nexus',
    name: 'Nexus',
    title: 'CAPA Sentinel',
    role: 'CAPA Engine',
    color: '#8B5CF6',
    avatarPath: '/sentinels/nexus-avatar.png',
    initial: 'N',
  },
};

/** Ordered list for dashboard / sidebar iteration */
export const SENTINEL_LIST: SentinelConfig[] = [
  SENTINELS.qualy,
  SENTINELS.envi,
  SENTINELS.saffy,
  SENTINELS.doki,
  SENTINELS.audie,
  SENTINELS.nexus,
];

/** Maps module route to primary sentinel */
export const MODULE_SENTINEL: Record<string, SentinelId> = {
  '/document-studio': 'doki',
  '/audit': 'audie',
  '/capa': 'nexus',
  '/risk': 'saffy',
  '/compliance-matrix': 'qualy',
  '/management-review': 'qualy',
  '/records-vault': 'doki',
};
