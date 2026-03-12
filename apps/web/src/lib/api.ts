import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import { getSession, signOut } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const api = axios.create({ baseURL: API_URL });

// Attach Cognito JWT to every request.
// Prefers access_token (Cognito), falls back to id_token (also Cognito JWT).
// Google-only sessions won't have a Cognito token — API calls will be unauthenticated.
api.interceptors.request.use(async (config) => {
  const session = await getSession();
  const s = session as { accessToken?: string; idToken?: string } | null;
  const token = s?.accessToken ?? s?.idToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Force re-login when API returns 401 (expired token that refresh couldn't fix).
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await signOut({ callbackUrl: '/login' });
    }
    return Promise.reject(error);
  },
);

// ==================== Document Studio ====================
export const documentsApi = {
  list:   (params?: object) => api.get('/api/v1/document-studio/documents', { params }),
  get:    (id: string)      => api.get(`/api/v1/document-studio/documents/${id}`),
  create: (data: object, config?: AxiosRequestConfig) => api.post('/api/v1/document-studio/documents', data, config),
  update: (id: string, data: object) => api.patch(`/api/v1/document-studio/documents/${id}`, data),
  submit: (id: string, approverIds: string[]) =>
    api.post(`/api/v1/document-studio/documents/${id}/submit-for-approval`, { approverIds }),
  decide: (approvalId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) =>
    api.post(`/api/v1/document-studio/approvals/${approvalId}/decide`, { decision, comments }),
};

// ==================== Records Vault ====================
export const recordsApi = {
  list:             (params?: object)   => api.get('/api/v1/records-vault/records', { params }),
  create:           (data: object)      => api.post('/api/v1/records-vault/records', data),
  verifyIntegrity:  (id: string)        => api.post(`/api/v1/records-vault/records/${id}/verify-integrity`),
  legalHold:        (id: string, reason: string) => api.post(`/api/v1/records-vault/records/${id}/legal-hold`, { reason }),
  releaseLegalHold: (id: string)        => api.delete(`/api/v1/records-vault/records/${id}/legal-hold`),
};

// ==================== AI Sentinels ====================
export const aiApi = {
  /** Doki generates ISO documents channeling domain sentinels */
  documentGenerate: (
    data: { documentType: string; standards: string[]; orgContext: string; sections: string[] },
    config?: AxiosRequestConfig,
  ) => api.post('/api/v1/ai/document-generate', data, config),

  /** Doki classifies uploaded document text by ISO clause */
  clauseClassify: (data: { documentText: string; fileName: string }) =>
    api.post('/api/v1/ai/clause-classify', data),

  /** Audie generates audit plan per ISO 19011:6.3 */
  auditPlan: (data: {
    standards: string[]; scope: string; auditType: string; orgContext: string;
  }) => api.post('/api/v1/ai/audit-plan', data),

  /** Audie clause examination per ISO 19011:6.4 */
  auditExamine: (data: {
    clause: string; standard: string; auditContext: string;
    evidence?: string[]; conversationHistory?: { role: string; content: string }[];
  }) => api.post('/api/v1/ai/audit-examine', data),

  /** Audie formal audit report per ISO 19011:6.5 */
  auditReport: (data: {
    sessionId: string; findings: object[]; scope: string; standards: string[]; auditDate: string;
  }) => api.post('/api/v1/ai/audit-report', data),

  /** Nexus guides root cause analysis */
  rootCause: (data: {
    findingDescription: string; clauseRef: string; standard: string;
    method: '5why' | 'fishbone' | '8d'; history?: { role: string; content: string }[];
  }) => api.post('/api/v1/ai/root-cause', data),

  /** Platform gap detection across compliance matrix */
  gapDetect: (data: {
    standards: string[]; existingControls?: object[]; auditResults?: object[];
  }) => api.post('/api/v1/ai/gap-detect', data),

  /** Platform management review input report */
  managementReview: (data: {
    auditResults?: object; capaStatus?: object; complianceScores?: object;
  }) => api.post('/api/v1/ai/management-review', data),
};

/** @deprecated — use aiApi instead */
export const sentinelsApi = {
  analyzeDocument: (content: string, standard?: string) =>
    aiApi.documentGenerate({ documentType: 'analysis', standards: [standard ?? 'iso_9001'], orgContext: content, sections: ['analysis'] }),
  identifyHazards: (_activityDescription: string, _location?: string) =>
    Promise.resolve({ data: { activities: [] } }),
  activities: () => Promise.resolve({ data: { activities: [] } }),
  stats:      () => Promise.resolve({ data: { totalAnalyses: 0, documentsGenerated: 0, totalActivities: 0 } }),
};

// ==================== CAPA ====================
export const capaApi = {
  list:      (params?: object)             => api.get('/api/v1/capa', { params }),
  get:       (id: string)                  => api.get(`/api/v1/capa/${id}`),
  create:    (data: object)               => api.post('/api/v1/capa', data),
  setStatus: (id: string, status: string) => api.patch(`/api/v1/capa/${id}/status`, { status }),
  addAction: (id: string, data: object)   => api.post(`/api/v1/capa/${id}/actions`, data),
  dashboard: ()                            => api.get('/api/v1/capa/stats/dashboard'),
};

// ==================== Risk ====================
export const riskApi = {
  list:   ()             => api.get('/api/v1/risks'),
  create: (data: object) => api.post('/api/v1/risks', data),
  matrix: ()             => api.get('/api/v1/risks/matrix'),
};

// ==================== Audit ====================
export const auditApi = {
  list:       ()             => api.get('/api/v1/audits'),
  get:        (id: string)   => api.get(`/api/v1/audits/${id}`),
  create:     (data: object) => api.post('/api/v1/audits', data),
  addFinding: (id: string, data: object) => api.post(`/api/v1/audits/${id}/findings`, data),
};

// ==================== Management Review ====================
export const reviewApi = {
  list:   ()             => api.get('/api/v1/management-reviews'),
  get:    (id: string)   => api.get(`/api/v1/management-reviews/${id}`),
  create: (data: object) => api.post('/api/v1/management-reviews', data),
};

// ==================== Billing ====================
export const billingApi = {
  getSubscription: ()             => api.get('/api/v1/billing/subscription'),
  getUsage:        ()             => api.get('/api/v1/billing/usage'),
  upgrade:         (data: object) => api.post('/api/v1/billing/upgrade', data),
};

// ==================== Settings ====================
export const settingsApi = {
  getOrg:             ()                         => api.get('/api/v1/settings/org'),
  updateOrg:          (data: object)             => api.put('/api/v1/settings/org', data),
  activateStandard:   (code: string)             => api.post('/api/v1/settings/standards/activate', { standardCode: code }),
  deactivateStandard: (code: string)             => api.delete(`/api/v1/settings/standards/${encodeURIComponent(code)}`),
  getRoles:           ()                         => api.get('/api/v1/settings/roles'),
  getUsers:           ()                         => api.get('/api/v1/settings/users'),
  inviteUser:         (data: { email: string; roleId?: string }) =>
    api.post('/api/v1/settings/users/invite', data),
  updateUserRole:     (userId: string, roleId: string) =>
    api.put(`/api/v1/settings/users/${userId}/role`, { roleId }),
};

// ==================== Audit Trail ====================
export const auditTrailApi = {
  query: (params?: {
    entityId?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) => api.get('/api/v1/audit-trail', { params }),
};

// ==================== Brain ====================
export const brainApi = {
  getUploadUrl: (data: {
    fileName: string; fileType: string; docCategory: string; relatedStandard?: string;
  }) => api.post('/api/v1/brain/upload-url', data),
  process:        (orgDocumentId: string) => api.post('/api/v1/brain/process', { orgDocumentId }),
  listDocuments:  ()                      => api.get('/api/v1/brain/documents'),
  deleteDocument: (id: string)            => api.delete(`/api/v1/brain/documents/${id}`),
};

// ==================== Board Report ====================
import type {
  BoardReportListItem,
  GenerateReportResponse,
} from '@/types/board-report';

export const boardReportApi = {
  /** Generate a board report for a given period (or default: last month) */
  generate: async (period?: string): Promise<GenerateReportResponse> => {
    const res = await api.post('/api/v1/board-report/generate', period ? { period } : {});
    return res.data as GenerateReportResponse;
  },

  /** List the last 12 board reports for this tenant */
  list: async (): Promise<BoardReportListItem[]> => {
    const res = await api.get('/api/v1/board-report/list');
    return (res.data as { reports: BoardReportListItem[] }).reports;
  },
};

// ==================== Bulk Upload ====================
import type {
  BulkInitiateResponse,
  BulkProcessResponse,
  BulkUploadBatch,
} from '@/types/bulk-upload';

export const bulkUploadApi = {
  /** Create batch + get presigned S3 PUT URLs per file */
  initiate: async (files: Array<{
    filename: string;
    fileType: 'pdf' | 'docx';
    fileSize: number;
  }>): Promise<BulkInitiateResponse> => {
    const res = await api.post('/api/v1/bulk-upload/initiate', { files });
    return res.data as BulkInitiateResponse;
  },

  /** Upload a file directly to S3 via presigned URL with progress tracking */
  uploadToS3: (
    presignedUrl: string,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', presignedUrl, true);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`S3 upload failed: ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('S3 upload network error'));
      xhr.send(file);
    });
  },

  /** Process uploaded files — triggers Omni triage + document creation */
  process: async (batchId: string, itemIds: string[]): Promise<BulkProcessResponse> => {
    const res = await api.post('/api/v1/bulk-upload/process', { batchId, itemIds });
    return res.data as BulkProcessResponse;
  },

  /** Poll batch status */
  getStatus: async (batchId: string): Promise<BulkUploadBatch> => {
    const res = await api.get(`/api/v1/bulk-upload/batch/${batchId}`);
    return res.data as BulkUploadBatch;
  },
};

// ==================== API Keys (Phase 14) ====================
export const apiKeysApi = {
  list:   () => api.get('/api/v1/settings/api-keys'),
  create: (data: { name: string; scopes?: string[]; expiresAt?: string }) =>
    api.post('/api/v1/settings/api-keys', data),
  revoke: (keyId: string) => api.delete(`/api/v1/settings/api-keys/${keyId}`),
};

// ==================== Webhooks (Phase 14) ====================
export const webhooksApi = {
  list:   () => api.get('/api/v1/settings/webhooks'),
  get:    (id: string) => api.get(`/api/v1/settings/webhooks/${id}`),
  create: (data: { url: string; description?: string; eventTypes: string[] }) =>
    api.post('/api/v1/settings/webhooks', data),
  update: (id: string, data: { url?: string; description?: string; eventTypes?: string[]; status?: string }) =>
    api.put(`/api/v1/settings/webhooks/${id}`, data),
  remove: (id: string) => api.delete(`/api/v1/settings/webhooks/${id}`),
  test:   (id: string) => api.post(`/api/v1/settings/webhooks/${id}/test`),
};
