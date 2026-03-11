/**
 * local-store.ts — localStorage CRUD for Document Studio documents.
 * Used as a fallback when the backend API is unavailable (e.g., ECS
 * services not yet deployed). Provides seamless offline-capable
 * document management that syncs to the real backend when available.
 */

const STORE_KEY = 'aisentinels_documents';

export interface LocalDocument {
  id: string;
  tenantId: string;
  siteId?: string | null;
  title: string;
  docType: string;
  standards: string[];
  clauseRefs: string[];
  bodyJsonb: Record<string, unknown> | null;
  status: string;
  version: number;
  approvedBy?: string | null;
  approvedAt?: string | null;
  effectiveDate?: string | null;
  reviewDate?: string | null;
  sha256Hash?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  content?: string;
  isLocal?: boolean;
}

function getAll(): LocalDocument[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(docs: LocalDocument[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(docs));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function listLocalDocuments(): LocalDocument[] {
  return getAll().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function getLocalDocument(id: string): LocalDocument | null {
  return getAll().find((d) => d.id === id) ?? null;
}

export function createLocalDocument(data: {
  title: string;
  docType: string;
  standards?: string[];
  clauseRefs?: string[];
  content?: string;
  bodyJsonb?: Record<string, unknown> | null;
}): LocalDocument {
  const docs = getAll();
  const now = new Date().toISOString();
  const doc: LocalDocument = {
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tenantId: 'local',
    title: data.title || 'Untitled Document',
    docType: data.docType || 'procedure',
    standards: data.standards ?? [],
    clauseRefs: data.clauseRefs ?? [],
    bodyJsonb: data.bodyJsonb ?? null,
    status: 'draft',
    version: 1,
    createdBy: 'current-user',
    createdAt: now,
    updatedAt: now,
    content: data.content,
    isLocal: true,
  };
  docs.push(doc);
  saveAll(docs);
  return doc;
}

export function updateLocalDocument(
  id: string,
  data: Partial<LocalDocument>,
): LocalDocument | null {
  const docs = getAll();
  const idx = docs.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  docs[idx] = { ...docs[idx], ...data, updatedAt: new Date().toISOString() };
  saveAll(docs);
  return docs[idx];
}

export function deleteLocalDocument(id: string): boolean {
  const docs = getAll();
  const filtered = docs.filter((d) => d.id !== id);
  if (filtered.length === docs.length) return false;
  saveAll(filtered);
  return true;
}
