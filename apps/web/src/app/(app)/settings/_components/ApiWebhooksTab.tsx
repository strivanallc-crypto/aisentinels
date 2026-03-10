'use client';

import { useState, useEffect, useCallback } from 'react';
import { Key, Webhook, Plus, Trash2, Copy, Eye, EyeOff, Send, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { apiKeysApi, webhooksApi } from '@/lib/api';

// ── Styles ───────────────────────────────────────────────────────────────────
const cardStyle = {
  background: '#1E293B',
  borderColor: 'rgba(255,255,255,0.07)',
};

const inputClass =
  'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';
const inputStyle = {
  background: '#1E293B',
  borderColor: 'rgba(255,255,255,0.07)',
  color: '#F9FAFB',
};

// ── Types ────────────────────────────────────────────────────────────────────
interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  last4: string;
  scopes: string[];
  expiresAt: string | null;
  revoked: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

interface WebhookRow {
  id: string;
  url: string;
  description: string | null;
  eventTypes: string[];
  status: string;
  failureCount: number;
  lastDeliveredAt: string | null;
  createdAt: string;
}

const WEBHOOK_EVENT_TYPES = [
  { value: 'document.created', label: 'Document Created' },
  { value: 'document.approved', label: 'Document Approved' },
  { value: 'document.rejected', label: 'Document Rejected' },
  { value: 'audit.created', label: 'Audit Created' },
  { value: 'audit.completed', label: 'Audit Completed' },
  { value: 'capa.created', label: 'CAPA Created' },
  { value: 'capa.closed', label: 'CAPA Closed' },
  { value: 'finding.created', label: 'Finding Created' },
  { value: 'record.created', label: 'Record Created' },
  { value: 'record.verified', label: 'Record Verified' },
  { value: 'compliance.check_completed', label: 'Compliance Check Completed' },
];

// ── API Keys Section ─────────────────────────────────────────────────────────
function ApiKeysSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const loadKeys = useCallback(async () => {
    try {
      const { data } = await apiKeysApi.list();
      setKeys((data as { apiKeys: ApiKeyRow[] }).apiKeys);
    } catch {
      toast({ title: 'Failed to load API keys', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void loadKeys(); }, [loadKeys]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const { data } = await apiKeysApi.create({ name: newKeyName.trim() });
      const result = data as { apiKey: ApiKeyRow & { key: string } };
      setNewKeySecret(result.apiKey.key);
      setNewKeyName('');
      void loadKeys();
      toast({ title: 'API key created', variant: 'success' });
    } catch {
      toast({ title: 'Failed to create API key', variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    try {
      await apiKeysApi.revoke(keyId);
      void loadKeys();
      toast({ title: 'API key revoked', variant: 'success' });
    } catch {
      toast({ title: 'Failed to revoke API key', variant: 'error' });
    }
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard', variant: 'success' });
  };

  if (loading) return <Skeleton className="h-32 w-full rounded-lg" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-white">API Keys</h2>
        </div>
        <Button
          size="sm"
          onClick={() => { setShowCreate(true); setNewKeySecret(null); }}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Key
        </Button>
      </div>

      {/* New key secret banner */}
      {newKeySecret && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-400 mb-2">
            Save this API key now — it will not be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-black/30 px-3 py-1.5 text-xs font-mono text-amber-300 break-all">
              {showSecret ? newKeySecret : newKeySecret.slice(0, 12) + '...' + newKeySecret.slice(-4)}
            </code>
            <button onClick={() => setShowSecret(!showSecret)} className="text-gray-400 hover:text-white">
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button onClick={() => copyToClipboard(newKeySecret)} className="text-gray-400 hover:text-white">
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      {showCreate && !newKeySecret && (
        <div className="rounded-lg border p-4" style={cardStyle}>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Key Name</label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. Production ERP Integration"
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <Button size="sm" onClick={handleCreate} disabled={creating || !newKeyName.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Keys list */}
      {keys.length === 0 ? (
        <p className="text-sm text-gray-500">No API keys yet. Create one to enable API access.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.id} className="rounded-lg border p-3 flex items-center gap-4" style={cardStyle}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{k.name}</span>
                  {k.revoked && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Revoked</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <code className="text-xs text-gray-500 font-mono">{k.prefix}...{k.last4}</code>
                  <span className="text-xs text-gray-600">
                    Created {new Date(k.createdAt).toLocaleDateString()}
                  </span>
                  {k.lastUsedAt && (
                    <span className="text-xs text-gray-600">
                      Last used {new Date(k.lastUsedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              {!k.revoked && (
                <button
                  onClick={() => handleRevoke(k.id)}
                  className="text-gray-500 hover:text-red-400 transition-colors"
                  title="Revoke key"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Webhooks Section ─────────────────────────────────────────────────────────
function WebhooksSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [form, setForm] = useState({ url: '', description: '', eventTypes: [] as string[] });

  const loadWebhooks = useCallback(async () => {
    try {
      const { data } = await webhooksApi.list();
      setWebhooks((data as { webhooks: WebhookRow[] }).webhooks);
    } catch {
      toast({ title: 'Failed to load webhooks', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void loadWebhooks(); }, [loadWebhooks]);

  const toggleEventType = (et: string) => {
    setForm((prev) => ({
      ...prev,
      eventTypes: prev.eventTypes.includes(et)
        ? prev.eventTypes.filter((e) => e !== et)
        : [...prev.eventTypes, et],
    }));
  };

  const handleCreate = async () => {
    if (!form.url.trim() || form.eventTypes.length === 0) return;
    setCreating(true);
    try {
      await webhooksApi.create({
        url: form.url.trim(),
        description: form.description.trim() || undefined,
        eventTypes: form.eventTypes,
      });
      setForm({ url: '', description: '', eventTypes: [] });
      setShowCreate(false);
      void loadWebhooks();
      toast({ title: 'Webhook created', variant: 'success' });
    } catch {
      toast({ title: 'Failed to create webhook', variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await webhooksApi.remove(id);
      void loadWebhooks();
      toast({ title: 'Webhook deleted', variant: 'success' });
    } catch {
      toast({ title: 'Failed to delete webhook', variant: 'error' });
    }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const { data } = await webhooksApi.test(id);
      const result = data as { success: boolean; responseStatus: number | null; durationMs: number };
      if (result.success) {
        toast({ title: `Test delivery succeeded (${result.responseStatus}, ${result.durationMs}ms)`, variant: 'success' });
      } else {
        toast({ title: `Test delivery failed (${result.responseStatus ?? 'network error'})`, variant: 'error' });
      }
    } catch {
      toast({ title: 'Failed to send test', variant: 'error' });
    } finally {
      setTesting(null);
    }
  };

  if (loading) return <Skeleton className="h-32 w-full rounded-lg" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-indigo-400" />
          <h2 className="text-lg font-semibold text-white">Webhook Endpoints</h2>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Endpoint
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-lg border p-4 space-y-3" style={cardStyle}>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Endpoint URL</label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
              placeholder="https://your-server.com/webhooks"
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Description (optional)</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Production webhook for ERP sync"
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-2">Event Types</label>
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENT_TYPES.map((et) => (
                <button
                  key={et.value}
                  onClick={() => toggleEventType(et.value)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors border ${
                    form.eventTypes.includes(et.value)
                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                      : 'border-gray-700 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {et.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleCreate} disabled={creating || !form.url.trim() || form.eventTypes.length === 0}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Webhook'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Webhooks list */}
      {webhooks.length === 0 ? (
        <p className="text-sm text-gray-500">No webhooks configured. Add one to receive event notifications.</p>
      ) : (
        <div className="space-y-2">
          {webhooks.map((wh) => (
            <div key={wh.id} className="rounded-lg border p-3" style={cardStyle}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono text-white truncate">{wh.url}</code>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      wh.status === 'active' ? 'bg-green-500/20 text-green-400'
                        : wh.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {wh.status}
                    </span>
                    {wh.failureCount > 0 && (
                      <span className="text-xs text-red-400">{wh.failureCount} failures</span>
                    )}
                  </div>
                  {wh.description && <p className="text-xs text-gray-500 mt-0.5">{wh.description}</p>}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {wh.eventTypes.map((et) => (
                      <span key={et} className="px-1.5 py-0.5 rounded text-[10px] bg-gray-800 text-gray-400">
                        {et}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleTest(wh.id)}
                    disabled={testing === wh.id}
                    className="p-1.5 rounded text-gray-500 hover:text-indigo-400 transition-colors"
                    title="Send test"
                  >
                    {testing === wh.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(wh.id)}
                    className="p-1.5 rounded text-gray-500 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {wh.lastDeliveredAt && (
                <p className="text-[10px] text-gray-600 mt-1.5">
                  Last delivered: {new Date(wh.lastDeliveredAt).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Tab Component ───────────────────────────────────────────────────────
export function ApiWebhooksTab() {
  return (
    <div className="space-y-8 max-w-3xl">
      <ApiKeysSection />
      <div className="h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
      <WebhooksSection />
    </div>
  );
}
