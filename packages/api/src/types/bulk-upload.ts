/**
 * Bulk Upload types — Phase 8-A.
 *
 * Shared interfaces for the bulk upload pipeline:
 *   POST /bulk-upload/initiate — create batch + presigned URLs
 *   POST /bulk-upload/process  — process uploaded files via Omni triage
 *   GET  /bulk-upload/batch/:batchId — poll batch status
 */

// ── DB record types ─────────────────────────────────────────────────────────

export interface BulkUploadBatch {
  id: string;
  tenantId: string;
  createdBy: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalFiles: number;
  processed: number;
  succeeded: number;
  failed: number;
  createdAt: string;
  completedAt?: string;
  items: BulkUploadItem[];
}

export interface BulkUploadItem {
  id: string;
  batchId: string;
  tenantId: string;
  filename: string;
  fileType: 'pdf' | 'docx';
  fileSize?: number;
  s3Key?: string;
  status: 'pending' | 'uploaded' | 'processing' | 'completed' | 'failed';
  documentId?: string;
  sentinel?: string;
  isoStandard?: string;
  errorMessage?: string;
  presignedUrl?: string; // only in initiate response
  createdAt: string;
  processedAt?: string;
}

// ── Request / Response types ────────────────────────────────────────────────

export interface BulkInitiateRequest {
  files: Array<{
    filename: string;
    fileType: 'pdf' | 'docx';
    fileSize: number;
  }>;
}

export interface BulkInitiateResponse {
  batchId: string;
  items: Array<{
    itemId: string;
    filename: string;
    presignedUrl: string; // S3 presigned PUT URL
    expiresIn: 900;       // 15 minutes
  }>;
}

export interface BulkProcessRequest {
  batchId: string;
  itemIds: string[]; // IDs of items successfully uploaded to S3
}

// ── Constants ───────────────────────────────────────────────────────────────

export const BULK_LIMITS = {
  MAX_FILES: 10,
  MAX_FILE_SIZE_BYTES: 25 * 1024 * 1024, // 25MB
  ALLOWED_TYPES: ['pdf', 'docx'] as const,
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ] as const,
  PRESIGNED_URL_EXPIRY: 900, // 15 minutes
} as const;
