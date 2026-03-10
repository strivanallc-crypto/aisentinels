import type { LucideIcon } from 'lucide-react';
import type { PlanType } from '@/lib/types';
import type { SentinelId } from '@/lib/sentinels';
import {
  LayoutDashboard,
  FileText,
  Search,
  AlertTriangle,
  Grid3X3,
  Archive,
  Settings,
  Compass,
  BookOpen,
  CreditCard,
  BarChart3,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Sentinel assigned to this module. */
  sentinelId?: SentinelId;
  /** Minimum plan required. Lower plans see this item locked. */
  requiredPlan?: PlanType;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'OVERVIEW',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'COMPLIANCE WORK',
    items: [
      { href: '/document-studio',   label: 'Document Studio',   icon: FileText,      sentinelId: 'doki' },
      { href: '/audit',             label: 'Audit Room',        icon: Search,        sentinelId: 'audie' },
      { href: '/capa',              label: 'CAPA Engine',       icon: AlertTriangle, sentinelId: 'nexus' },
      { href: '/risk',              label: 'Risk Navigator',    icon: Compass,       sentinelId: 'saffy', requiredPlan: 'professional' },
      { href: '/compliance-matrix', label: 'Compliance Matrix', icon: Grid3X3,       sentinelId: 'qualy' },
    ],
  },
  {
    label: 'MANAGEMENT',
    items: [
      { href: '/management-review', label: 'Mgmt Review',   icon: BookOpen,  sentinelId: 'qualy', requiredPlan: 'professional' },
      { href: '/records-vault',     label: 'Records Vault',  icon: Archive,   sentinelId: 'doki' },
      { href: '/board-report',      label: 'Board Report',   icon: BarChart3, sentinelId: 'qualy', requiredPlan: 'professional' },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { href: '/billing',  label: 'Billing',  icon: CreditCard },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

/** Flat list — used by CommandPalette */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
