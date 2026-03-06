import type { LucideIcon } from 'lucide-react';
import type { PlanType } from '@/lib/types';
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
  /** Sentinel shield color (CSS hex). */
  sentinelColor?: string;
  /** Sentinel initial letter shown inside shield. */
  sentinelInitial?: string;
  /** Minimum plan required. Lower plans see this item locked. */
  requiredPlan?: PlanType;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',         label: 'Dashboard',         icon: LayoutDashboard },
  { href: '/document-studio',   label: 'Document Studio',   icon: FileText,        sentinelColor: '#6366F1', sentinelInitial: 'D' },
  { href: '/audit',             label: 'Audit Room',        icon: Search,          sentinelColor: '#F43F5E', sentinelInitial: 'A' },
  { href: '/capa',              label: 'CAPA Engine',       icon: AlertTriangle,   sentinelColor: '#8B5CF6', sentinelInitial: 'N' },
  { href: '/risk',              label: 'Risk Navigator',    icon: Compass,         requiredPlan: 'professional' },
  { href: '/compliance-matrix', label: 'Compliance Matrix', icon: Grid3X3 },
  { href: '/management-review', label: 'Mgmt Review',       icon: BookOpen,        requiredPlan: 'professional' },
  { href: '/records-vault',     label: 'Records Vault',     icon: Archive },
  { href: '/billing',           label: 'Billing',           icon: CreditCard },
  { href: '/settings',          label: 'Settings',          icon: Settings },
];
