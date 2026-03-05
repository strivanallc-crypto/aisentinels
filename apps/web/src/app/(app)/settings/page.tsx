'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Building2, Shield, Users, Brain, Settings } from 'lucide-react';
import { OrgTab } from './_components/OrgTab';
import { StandardsTab } from './_components/StandardsTab';
import { UsersTab } from './_components/UsersTab';
import { BrainTab } from './_components/BrainTab';

const TABS = [
  { key: 'organization', label: 'Organization', icon: Building2 },
  { key: 'standards',    label: 'Standards',    icon: Shield },
  { key: 'users',        label: 'Users',        icon: Users },
  { key: 'brain',        label: 'Brain',        icon: Brain },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = (searchParams.get('tab') as TabKey) || 'organization';

  const setTab = (tab: TabKey) => {
    router.replace(`/settings?tab=${tab}`);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: '#0A0F1E', color: '#F9FAFB' }}>
      {/* Header */}
      <div className="px-6 pt-6 pb-0">
        <div className="flex items-center gap-2 mb-1">
          <Settings className="h-4 w-4 text-gray-500" />
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            ISO Platform
          </p>
        </div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-0.5 text-sm text-gray-400">
          Manage your organisation, standards, team, and knowledge base
        </p>
      </div>

      {/* Tab bar */}
      <div className="px-6 mt-5">
        <div className="flex gap-1 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  isActive
                    ? 'border-indigo-500 text-white'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {activeTab === 'organization' && <OrgTab />}
        {activeTab === 'standards' && <StandardsTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'brain' && <BrainTab />}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center" style={{ background: '#0A0F1E' }}>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
