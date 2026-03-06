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

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',         label: 'Dashboard',         icon: LayoutDashboard },
  { href: '/document-studio',   label: 'Document Studio',   icon: FileText,        sentinelId: 'doki' },
  { href: '/audit',             label: 'Audit Room',        icon: Search,          sentinelId: 'audie' },
  { href: '/capa',              label: 'CAPA Engine',       icon: AlertTriangle,   sentinelId: 'nexus' },
  { href: '/risk',              label: 'Risk Navigator',    icon: Compass,         sentinelId: 'saffy',  requiredPlan: 'professional' },
  { href: '/compliance-matrix', label: 'Compliance Matrix', icon: Grid3X3,         sentinelId: 'qualy' },
  { href: '/management-review', label: 'Mgmt Review',       icon: BookOpen,        sentinelId: 'qualy',  requiredPlan: 'professional' },
  { href: '/records-vault',     label: 'Records Vault',     icon: Archive,         sentinelId: 'doki' },
  { href: '/billing',           label: 'Billing',           icon: CreditCard },
  { href: '/settings',          label: 'Settings',          icon: Settings },
];
