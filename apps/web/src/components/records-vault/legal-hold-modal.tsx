'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { recordsApi } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

interface LegalHoldModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string | null;
  onApplied: () => void;
}

export function LegalHoldModal({ open, onOpenChange, recordId, onApplied }: LegalHoldModalProps) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleClose = (o: boolean) => {
    onOpenChange(o);
    if (!o) setReason('');
  };

  const handleApply = async () => {
    if (!recordId || !reason.trim()) return;
    setSaving(true);
    try {
      await recordsApi.legalHold(recordId, reason.trim());
      handleClose(false);
      onApplied();
    } catch {
      /* silent */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={handleClose} title="Apply Legal Hold">
      <div className="flex flex-col gap-4">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          A legal hold prevents this record from being modified or deleted until released.
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Reason</label>
          <textarea
            rows={2} value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for legal hold..."
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--input-bg)', color: 'var(--text)' }}
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => handleClose(false)}>Cancel</Button>
          <Button onClick={handleApply} disabled={!reason.trim() || saving}>
            <Lock className="mr-1.5 h-4 w-4" />
            {saving ? 'Applying...' : 'Apply Hold'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
