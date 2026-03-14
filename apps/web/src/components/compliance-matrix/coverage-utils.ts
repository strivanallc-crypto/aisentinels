import type { Document } from '@/lib/types';
import { ANNEX_SL_CLAUSES } from './annex-sl-clauses';

// Keywords for best-effort clause matching from document titles
const CLAUSE_KEYWORDS: Record<string, string[]> = {
  '4.1': ['context', 'organization', 'organisational context', 'organizational context'],
  '4.2': ['interested parties', 'stakeholder', 'stakeholders'],
  '4.3': ['scope', 'system scope'],
  '4.4': ['management system', 'ims', 'integrated management'],
  '5.1': ['leadership', 'commitment', 'top management'],
  '5.2': ['policy', 'quality policy', 'environmental policy', 'oh&s policy', 'ohs policy'],
  '5.3': ['roles', 'responsibilities', 'authorities', 'organizational roles'],
  '6.1': ['risk', 'risks', 'opportunities', 'risk assessment'],
  '6.2': ['objectives', 'quality objectives', 'environmental objectives'],
  '7.1': ['resources', 'infrastructure', 'monitoring resources'],
  '7.2': ['competence', 'competency', 'training'],
  '7.3': ['awareness'],
  '7.4': ['communication', 'internal communication', 'external communication'],
  '7.5': ['document', 'documented', 'procedure', 'manual', 'record', 'documented information'],
  '8.1': ['operational', 'operations', 'operational planning', 'operational control'],
  '9.1': ['monitoring', 'measurement', 'analysis', 'evaluation', 'performance evaluation'],
  '9.2': ['audit', 'internal audit'],
  '9.3': ['management review'],
  '10.2': ['capa', 'corrective', 'nonconformity', 'nonconformance', 'nc', 'corrective action'],
};

function matchesStandard(doc: Document, standard: string): boolean {
  return doc.standards.some((s) => s === standard);
}

function matchesClause(doc: Document, clauseId: string): boolean {
  // Primary: check clauseRefs array for exact match
  if (doc.clauseRefs && doc.clauseRefs.length > 0) {
    if (doc.clauseRefs.some((ref) => ref === clauseId || ref.startsWith(clauseId + '.'))) {
      return true;
    }
  }

  // Fallback: keyword matching from document title
  const keywords = CLAUSE_KEYWORDS[clauseId];
  if (!keywords) return false;

  const title = doc.title.toLowerCase();
  return keywords.some((kw) => title.includes(kw));
}

export function getDocsForCell(
  documents: Document[],
  clauseId: string,
  standard: string,
): { approved: Document[]; draft: Document[] } {
  const approved: Document[] = [];
  const draft: Document[] = [];

  for (const doc of documents) {
    if (!matchesStandard(doc, standard)) continue;
    if (!matchesClause(doc, clauseId)) continue;

    if (doc.status === 'approved' || doc.status === 'published') {
      approved.push(doc);
    } else if (doc.status === 'draft' || doc.status === 'review') {
      draft.push(doc);
    }
  }

  return { approved, draft };
}

export function computeCellScore(
  documents: Document[],
  clauseId: string,
  standard: string,
): number {
  const { approved, draft } = getDocsForCell(documents, clauseId, standard);
  if (approved.length > 0) return 100;
  if (draft.length > 0) return 50;
  return 0;
}

export function computeCoverage(documents: Document[], standard: string): number {
  const totalClauses = ANNEX_SL_CLAUSES.length; // 19
  let coveredClauses = 0;

  for (const clause of ANNEX_SL_CLAUSES) {
    const { approved } = getDocsForCell(documents, clause.id, standard);
    if (approved.length > 0) {
      coveredClauses++;
    }
  }

  return Math.round((coveredClauses / totalClauses) * 100);
}
