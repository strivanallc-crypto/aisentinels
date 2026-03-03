import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  FileText,
  Archive,
  Bot,
  Wrench,
  AlertTriangle,
  ClipboardCheck,
  BookOpen,
  CreditCard,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',         label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/document-studio',   label: 'Document Studio', icon: FileText },
  { href: '/records-vault',     label: 'Records Vault',   icon: Archive },
  { href: '/ai-dashboard',      label: 'AI Sentinels',    icon: Bot },
  { href: '/capa',              label: 'CAPA Hub',        icon: Wrench },
  { href: '/risk',              label: 'Risk Navigator',  icon: AlertTriangle },
  { href: '/audit',             label: 'Audit Command',   icon: ClipboardCheck },
  { href: '/management-review', label: 'Mgmt Review',     icon: BookOpen },
  { href: '/billing',           label: 'Billing',         icon: CreditCard },
];
