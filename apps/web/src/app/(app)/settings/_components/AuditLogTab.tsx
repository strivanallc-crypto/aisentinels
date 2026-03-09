'use client';

import { AuditEventViewer } from '@/components/audit-trail/event-viewer';

export function AuditLogTab() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Audit Log</h2>
        <p className="mt-0.5 text-sm text-gray-400">
          View all system events across your organisation — document changes, CAPA actions, AI operations, and more.
        </p>
      </div>
      <AuditEventViewer />
    </div>
  );
}
