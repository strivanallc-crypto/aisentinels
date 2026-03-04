'use client';

import { Grid3X3 } from 'lucide-react';

export default function ComplianceMatrixPage() {
  return (
    <div className="p-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
          <Grid3X3 className="h-5 w-5 text-slate-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Compliance Matrix</h1>
          <p className="text-sm text-slate-500">Annex SL clause coverage across ISO 9001, 14001, 45001</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <Grid3X3 className="mx-auto mb-4 h-12 w-12 text-slate-300" />
        <h2 className="mb-2 text-lg font-semibold text-slate-700">Coming in Phase 6</h2>
        <p className="text-sm text-slate-500">
          Auto-populated matrix showing clause coverage from Document Studio, Audit Room, and CAPA Engine.
        </p>
      </div>
    </div>
  );
}
