'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { settingsApi } from '@/lib/api';
import type { OrgUser, OrgRole } from '@/lib/types';

const AVATAR_COLORS = [
  '#6366F1', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#06B6D4',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'secondary' | 'destructive'> = {
  active:      'success',
  invited:     'warning',
  deactivated: 'destructive',
};

export function UsersTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [roles, setRoles] = useState<OrgRole[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const loadData = async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        settingsApi.getUsers(),
        settingsApi.getRoles(),
      ]);
      setUsers(usersRes.data as OrgUser[]);
      setRoles(rolesRes.data as OrgRole[]);
    } catch {
      toast({ title: 'Failed to load team data', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRoleChange = async (userId: string, roleId: string) => {
    try {
      await settingsApi.updateUserRole(userId, roleId);
      toast({ title: 'Role updated', variant: 'success' });
      await loadData();
    } catch {
      toast({ title: 'Failed to update role', variant: 'error' });
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      setInviteError('Email is required');
      return;
    }
    setInviting(true);
    setInviteError('');
    try {
      await settingsApi.inviteUser({
        email: inviteEmail.trim(),
        roleId: inviteRoleId || undefined,
      });
      toast({ title: `Invitation sent to ${inviteEmail}`, variant: 'success' });
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRoleId('');
      await loadData();
    } catch {
      setInviteError('Failed to send invitation. The user may already exist.');
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl">
        <TableSkeleton rows={3} cols={5} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-400">
          Manage team members and their roles. {users.length} user{users.length !== 1 && 's'} total.
        </p>
        <Button onClick={() => setInviteOpen(true)} size="sm">
          <UserPlus className="mr-1.5 h-4 w-4" />
          Invite User
        </Button>
      </div>

      {/* Users table */}
      <div
        className="rounded-[10px] border overflow-hidden"
        style={{ background: '#111827', borderColor: 'rgba(255,255,255,0.07)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Joined
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
              const initial = (user.firstName?.[0] ?? user.email[0]).toUpperCase();
              const avatarColor = getAvatarColor(user.email);
              return (
                <tr
                  key={user.id}
                  className="transition-colors hover:bg-white/[0.02]"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  {/* Name + Avatar */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white text-xs font-bold"
                        style={{ backgroundColor: avatarColor }}
                      >
                        {initial}
                      </div>
                      <span className="font-medium text-white">{displayName}</span>
                    </div>
                  </td>
                  {/* Email */}
                  <td className="px-4 py-3 text-gray-400">{user.email}</td>
                  {/* Role */}
                  <td className="px-4 py-3">
                    {roles.length > 0 ? (
                      <select
                        value={user.orgRoles?.[0]?.roleId ?? ''}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="rounded-md border bg-transparent px-2 py-1 text-xs text-gray-300 outline-none"
                        style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                      >
                        <option value="">No role</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.roleName}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-gray-500">
                        {user.role || 'owner'}
                      </span>
                    )}
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[user.status] ?? 'secondary'}>
                      {user.status}
                    </Badge>
                  </td>
                  {/* Joined */}
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatDate(user.createdAt)}
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No team members yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      <Modal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title="Invite Team Member"
        className="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>
              Email Address
            </label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/20"
              style={{ color: 'var(--content-text)' }}
            />
          </div>

          {roles.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--content-text-muted)' }}>
                Role
              </label>
              <select
                value={inviteRoleId}
                onChange={(e) => setInviteRoleId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/20"
                style={{ color: 'var(--content-text)' }}
              >
                <option value="">No role assigned</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.roleName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {inviteError && (
            <p className="text-sm text-red-600">{inviteError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <UserPlus className="mr-1.5 h-4 w-4" />
                  Send Invitation
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
