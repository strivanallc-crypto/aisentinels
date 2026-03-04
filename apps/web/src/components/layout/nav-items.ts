import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  FileText,
  Search,
  AlertTriangle,
  Grid3X3,
  Archive,
  Settings,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Sentinel dot color (CSS hex). Null = no sentinel dot. */
  sentinelColor?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',         label: 'Dashboard',         icon: LayoutDashboard },
  { href: '/document-studio',   label: 'Document Studio',   icon: FileText,        sentinelColor: '#6366F1' },   // Doki indigo
  { href: '/audit',             label: 'Audit Room',        icon: Search,          sentinelColor: '#F43F5E' },   // Audie rose
  { href: '/capa',              label: 'CAPA Engine',       icon: AlertTriangle,   sentinelColor: '#8B5CF6' },   // Nexus purple
  { href: '/compliance-matrix', label: 'Compliance Matrix', icon: Grid3X3 },
  { href: '/records-vault',     label: 'Records Vault',     icon: Archive },
  { href: '/settings',          label: 'Settings',          icon: Settings },
];
