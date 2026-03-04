'use client';

import { useState } from 'react';
import {
  Settings,
  Building2,
  Shield,
  Bot,
  CreditCard,
  Users,
  Globe,
  Clock,
  CheckCircle2,
  Save,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const ISO_STANDARDS = [
  { id: 'iso_9001', label: 'ISO 9001:2015', subtitle: 'Quality Management', color: '#3B82F6', sentinel: 'Qualy' },
  { id: 'iso_14001', label: 'ISO 14001:2015', subtitle: 'Environmental Management', color: '#22C55E', sentinel: 'Envi' },
  { id: 'iso_45001', label: 'ISO 45001:2018', subtitle: 'OH&S Management', color: '#F59E0B', sentinel: 'Saffy' },
];

const SENTINELS = [
  { id: 'doki', label: 'Doki', role: 'Document Studio', color: '#6366F1', description: 'AI document generation, clause classification, and template management' },
  { id: 'audie', label: 'Audie', role: 'Audit Room', color: '#F43F5E', description: 'AI audit planning, clause examination, and report generation per ISO 19011' },
  { id: 'nexus', label: 'Nexus', role: 'CAPA Engine', color: '#8B5CF6', description: 'AI root cause analysis (5-Why, Fishbone, 8D) and corrective action tracking' },
];

const TEAM_ROLES = [
  { role: 'owner', label: 'Owner', description: 'Full access, billing, org settings' },
  { role: 'admin', label: 'Admin', description: 'Manage users, standards, all modules' },
  { role: 'manager', label: 'Manager', description: 'Create & approve documents, audits, CAPAs' },
  { role: 'auditor', label: 'Auditor', description: 'Conduct audits, raise findings' },
  { role: 'viewer', label: 'Viewer', description: 'Read-only access to all modules' },
];

export default function SettingsPage() {
  const [activeStandards, setActiveStandards] = useState<string[]>(['iso_9001']);
  const [activeSentinels, setActiveSentinels] = useState<string[]>(['doki', 'audie', 'nexus']);
  const [orgForm, setOrgForm] = useState({
    name: 'My Organisation',
    timezone: 'Europe/London',
    locale: 'en-GB',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggleStandard = (id: string) => {
    setActiveStandards((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSentinel = (id: string) => {
    setActiveSentinels((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    // Simulated save — backend route not yet available
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6 p-6" style={{ color: 'var(--content-text)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
            ISO Platform › Settings
          </p>
          <h1 className="mt-1 text-2xl font-bold">Settings</h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--content-text-muted)' }}>
            Organisation, standards, sentinels, and billing
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
          ) : (
            <Save className="mr-1.5 h-4 w-4" />
          )}
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Organisation */}
          <div
            className="rounded-xl border p-5"
            style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-4 w-4" style={{ color: 'var(--content-text-muted)' }} />
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
                Organisation
              </h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Organisation Name</label>
                <input
                  type="text"
                  value={orgForm.name}
                  onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                  style={{ borderColor: 'var(--content-border)', background: 'var(--content-bg)' }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-sm font-medium">
                    <Globe className="h-3.5 w-3.5" style={{ color: 'var(--content-text-muted)' }} />
                    Timezone
                  </label>
                  <select
                    value={orgForm.timezone}
                    onChange={(e) => setOrgForm((f) => ({ ...f, timezone: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--content-border)', background: 'var(--content-bg)' }}
                  >
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="America/Chicago">America/Chicago (CST)</option>
                    <option value="America/Denver">America/Denver (MST)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                    <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-sm font-medium">
                    <Clock className="h-3.5 w-3.5" style={{ color: 'var(--content-text-muted)' }} />
                    Locale
                  </label>
                  <select
                    value={orgForm.locale}
                    onChange={(e) => setOrgForm((f) => ({ ...f, locale: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--content-border)', background: 'var(--content-bg)' }}
                  >
                    <option value="en-GB">English (UK)</option>
                    <option value="en-US">English (US)</option>
                    <option value="es-ES">Español</option>
                    <option value="fr-FR">Français</option>
                    <option value="de-DE">Deutsch</option>
                    <option value="ja-JP">日本語</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* ISO Standards */}
          <div
            className="rounded-xl border p-5"
            style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-4 w-4" style={{ color: 'var(--content-text-muted)' }} />
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
                ISO Standards
              </h2>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--content-text-muted)' }}>
              Activate the ISO standards your organisation is certified against or working towards.
            </p>
            <div className="space-y-3">
              {ISO_STANDARDS.map((s) => {
                const active = activeStandards.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleStandard(s.id)}
                    className="flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition-colors"
                    style={{
                      borderColor: active ? s.color : 'var(--content-border)',
                      background: active ? `${s.color}08` : 'var(--content-bg)',
                    }}
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-white text-xs font-bold"
                      style={{ backgroundColor: s.color }}
                    >
                      {active ? '✓' : ''}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{s.label}</span>
                        <span className="text-xs" style={{ color: 'var(--content-text-muted)' }}>
                          {s.subtitle}
                        </span>
                      </div>
                      <span className="text-xs" style={{ color: 'var(--content-text-dim)' }}>
                        Domain Sentinel: {s.sentinel}
                      </span>
                    </div>
                    <Badge variant={active ? 'success' : 'secondary'}>
                      {active ? 'Active' : 'Inactive'}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Sentinels */}
          <div
            className="rounded-xl border p-5"
            style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Bot className="h-4 w-4" style={{ color: 'var(--content-text-muted)' }} />
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
                AI Sentinels
              </h2>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--content-text-muted)' }}>
              Enable or disable module sentinels. Powered by Gemini 2.5 Pro.
            </p>
            <div className="space-y-3">
              {SENTINELS.map((s) => {
                const active = activeSentinels.includes(s.id);
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-4 rounded-xl border px-4 py-3"
                    style={{
                      borderColor: active ? s.color : 'var(--content-border)',
                      background: active ? `${s.color}08` : 'var(--content-bg)',
                    }}
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-white text-xs font-bold"
                      style={{ backgroundColor: s.color }}
                    >
                      {s.label[0]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{s.label}</span>
                        <span className="text-xs" style={{ color: 'var(--content-text-muted)' }}>
                          {s.role}
                        </span>
                      </div>
                      <p className="text-xs truncate" style={{ color: 'var(--content-text-dim)' }}>
                        {s.description}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleSentinel(s.id)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        active ? '' : 'bg-gray-300'
                      }`}
                      style={{ backgroundColor: active ? s.color : undefined }}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          active ? 'translate-x-[22px]' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Subscription */}
          <div
            className="rounded-xl border p-5"
            style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="h-4 w-4" style={{ color: 'var(--content-text-muted)' }} />
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
                Subscription
              </h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Trial</span>
                <Badge variant="warning">Trial</Badge>
              </div>
              <div className="text-xs space-y-1.5" style={{ color: 'var(--content-text-muted)' }}>
                <div className="flex justify-between">
                  <span>AI Credits Used</span>
                  <span>0 / 50</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100">
                  <div className="h-1.5 rounded-full bg-blue-500" style={{ width: '0%' }} />
                </div>
                <div className="flex justify-between">
                  <span>Documents</span>
                  <span>0 / 25</span>
                </div>
                <div className="flex justify-between">
                  <span>Users</span>
                  <span>1 / 3</span>
                </div>
              </div>
              <div className="pt-2">
                <Button variant="outline" size="sm" className="w-full" disabled>
                  Upgrade Plan
                </Button>
              </div>
            </div>
          </div>

          {/* Team Roles */}
          <div
            className="rounded-xl border p-5"
            style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-4 w-4" style={{ color: 'var(--content-text-muted)' }} />
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
                Team Roles
              </h2>
            </div>
            <div className="space-y-2">
              {TEAM_ROLES.map((r) => (
                <div key={r.role} className="flex items-start gap-2">
                  <Badge variant="outline" className="text-[10px] flex-shrink-0 mt-0.5">
                    {r.label}
                  </Badge>
                  <span className="text-xs" style={{ color: 'var(--content-text-muted)' }}>
                    {r.description}
                  </span>
                </div>
              ))}
            </div>
            <div className="pt-3">
              <Button variant="outline" size="sm" className="w-full" disabled>
                Invite Team Member
              </Button>
            </div>
          </div>

          {/* Platform Info */}
          <div
            className="rounded-xl border p-5"
            style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
          >
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--content-text-muted)' }}>
              Platform
            </h2>
            <div className="space-y-1.5 text-xs" style={{ color: 'var(--content-text-muted)' }}>
              <div className="flex justify-between">
                <span>Version</span>
                <span>0.1.0</span>
              </div>
              <div className="flex justify-between">
                <span>AI Engine</span>
                <span>Gemini 2.5 Pro</span>
              </div>
              <div className="flex justify-between">
                <span>Region</span>
                <span>us-east-1</span>
              </div>
              <div className="flex justify-between">
                <span>Standards</span>
                <span>{activeStandards.length} active</span>
              </div>
              <div className="flex justify-between">
                <span>Sentinels</span>
                <span>{activeSentinels.length} / 3 enabled</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
