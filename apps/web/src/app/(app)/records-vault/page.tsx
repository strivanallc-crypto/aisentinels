'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { recordsApi } from '@/lib/api';
import type { VaultRecord, RecordCategory } from '@/lib/types';
import type { DerivedStatus } from '@/components/records-vault/vault-constants';
import {
  enrichRecord,
  computeKPIs,
  computeCategoryBreakdown,
} from '@/components/records-vault/vault-utils';
import type { EnrichedRecord } from '@/components/records-vault/vault-utils';
import { KpiHeroRow } from '@/components/records-vault/kpi-hero-row';
import { NavigatorPanel } from '@/components/records-vault/navigator-panel';
import { RecordsTable } from '@/components/records-vault/records-table';
import { RecordDetailPanel } from '@/components/records-vault/record-detail-panel';
import { CreateRecordModal } from '@/components/records-vault/create-record-modal';
import { LegalHoldModal } from '@/components/records-vault/legal-hold-modal';
import { EvidencePresenter } from '@/components/records-vault/evidence-presenter';

/* ═══════════════════════════════════════════════════════════════════════════ */
/* RV-1 — Records Vault Orchestrator                                         */
/* Three-zone layout: Navigator (L) | Records Table (C) | Detail Panel (R)   */
/* ═══════════════════════════════════════════════════════════════════════════ */

export default function RecordsVaultPage() {
  /* ── Data ──────────────────────────────────────────────────── */
  const [records, setRecords] = useState<VaultRecord[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── Selection / panels ────────────────────────────────────── */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [navigatorOpen, setNavigatorOpen] = useState(true);
  const [evidenceMode, setEvidenceMode] = useState(false);
  const [presentingRecord, setPresentingRecord] = useState<EnrichedRecord | null>(null);

  /* ── Filters ───────────────────────────────────────────────── */
  const [categoryFilter, setCategoryFilter] = useState<RecordCategory | null>(null);
  const [statusFilter, setStatusFilter] = useState<DerivedStatus | null>(null);
  const [search, setSearch] = useState('');
  const [clauseSearch, setClauseSearch] = useState('');

  /* ── Modals ────────────────────────────────────────────────── */
  const [showCreate, setShowCreate] = useState(false);
  const [showHold, setShowHold] = useState(false);
  const [holdingId, setHoldingId] = useState<string | null>(null);

  /* ── Action state ──────────────────────────────────────────── */
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  /* ── Fetch ─────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await recordsApi.list();
      const data = res?.data;
      setRecords(Array.isArray(data) ? (data as VaultRecord[]) : []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ── Derived / memoised ────────────────────────────────────── */
  const enrichedRecords = useMemo(() => records.map(enrichRecord), [records]);

  const kpiStats = useMemo(() => computeKPIs(enrichedRecords), [enrichedRecords]);

  const categoryBreakdown = useMemo(
    () => computeCategoryBreakdown(enrichedRecords),
    [enrichedRecords],
  );

  const filteredRecords = useMemo(() => {
    let result = enrichedRecords;
    if (categoryFilter) {
      result = result.filter((r) => r.category === categoryFilter);
    }
    if (statusFilter) {
      result = result.filter((r) => r.derivedStatus === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) => r.title.toLowerCase().includes(q));
    }
    if (clauseSearch.trim()) {
      const q = clauseSearch.toLowerCase();
      result = result.filter((r) => r.title.toLowerCase().includes(q));
    }
    return result;
  }, [enrichedRecords, categoryFilter, statusFilter, search, clauseSearch]);

  const selectedRecord = useMemo(
    () => (selectedId ? enrichedRecords.find((r) => r.id === selectedId) ?? null : null),
    [enrichedRecords, selectedId],
  );

  /* ── Actions ───────────────────────────────────────────────── */
  const handleVerify = async (id: string) => {
    setVerifyingId(id);
    try {
      await recordsApi.verifyIntegrity(id);
      await load();
    } catch {
      /* toast would go here */
    } finally {
      setVerifyingId(null);
    }
  };

  const handleHold = (id: string) => {
    setHoldingId(id);
    setShowHold(true);
  };

  const handleReleaseHold = async (id: string) => {
    try {
      await recordsApi.releaseLegalHold(id);
      await load();
    } catch {
      /* toast would go here */
    }
  };

  const handleSelect = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  /* ── Layout ────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* D1 — KPI Hero Row */}
      <KpiHeroRow stats={kpiStats} loading={loading} />

      {/* Three-zone container */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* D2 + D5 — Navigator Panel (left) */}
        {navigatorOpen && (
          <NavigatorPanel
            categoryBreakdown={categoryBreakdown}
            kpiStats={kpiStats}
            categoryFilter={categoryFilter}
            statusFilter={statusFilter}
            clauseSearch={clauseSearch}
            onCategoryFilter={setCategoryFilter}
            onStatusFilter={setStatusFilter}
            onClauseSearch={setClauseSearch}
            onClose={() => setNavigatorOpen(false)}
          />
        )}

        {/* D3 + D6 — Records Table (center) */}
        <RecordsTable
          records={filteredRecords}
          loading={loading}
          selectedId={selectedId}
          verifyingId={verifyingId}
          evidenceMode={evidenceMode}
          navigatorOpen={navigatorOpen}
          search={search}
          onSearchChange={setSearch}
          onToggleNavigator={() => setNavigatorOpen((p) => !p)}
          onToggleEvidence={() => setEvidenceMode((p) => !p)}
          onSelect={handleSelect}
          onVerify={handleVerify}
          onHold={handleHold}
          onReleaseHold={handleReleaseHold}
          onPresent={setPresentingRecord}
          onCreateNew={() => setShowCreate(true)}
        />

        {/* D4 — Record Detail Panel (right overlay) */}
        {selectedRecord && (
          <RecordDetailPanel
            record={selectedRecord}
            verifying={verifyingId === selectedRecord.id}
            onClose={() => setSelectedId(null)}
            onVerify={() => handleVerify(selectedRecord.id)}
            onHold={() => handleHold(selectedRecord.id)}
            onReleaseHold={() => handleReleaseHold(selectedRecord.id)}
          />
        )}
      </div>

      {/* Modals */}
      <CreateRecordModal
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={load}
      />
      <LegalHoldModal
        open={showHold}
        onOpenChange={(o) => {
          setShowHold(o);
          if (!o) setHoldingId(null);
        }}
        recordId={holdingId}
        onApplied={load}
      />

      {/* D6 — Evidence Presenter (full-screen overlay) */}
      {presentingRecord && (
        <EvidencePresenter
          record={presentingRecord}
          open
          onClose={() => setPresentingRecord(null)}
        />
      )}
    </div>
  );
}
