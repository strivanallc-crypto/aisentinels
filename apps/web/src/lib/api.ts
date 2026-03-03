import axios from 'axios';
import { getSession } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const api = axios.create({ baseURL: API_URL });

// Attach Cognito access token to every request
api.interceptors.request.use(async (config) => {
  const session = await getSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ==================== Document Studio ====================
export const documentsApi = {
  list:   (params?: object) => api.get('/api/v1/document-studio/documents', { params }),
  get:    (id: string)      => api.get(`/api/v1/document-studio/documents/${id}`),
  create: (data: object)    => api.post('/api/v1/document-studio/documents', data),
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
export const sentinelsApi = {
  analyzeDocument: (content: string, standard?: string) =>
    api.post('/api/v1/sentinels/qms/analyze-document', { content, standard }),
  identifyHazards: (activityDescription: string, location?: string) =>
    api.post('/api/v1/sentinels/ohs/identify-hazards', { activityDescription, location }),
  activities:      ()  => api.get('/api/v1/sentinels/activities'),
  stats:           ()  => api.get('/api/v1/sentinels/stats'),
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
