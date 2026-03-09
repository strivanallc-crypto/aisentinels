/**
 * Bulk Upload types — frontend mirror of packages/api/src/types/bulk-upload.ts.
 * Same shape, no backend imports.
 */

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
  presignedUrl?: string;
  createdAt: string;
  processedAt?: string;
}

export interface BulkInitiateResponse {
  batchId: string;
  items: Array<{
    itemId: string;
    filename: string;
    presignedUrl: string;
    expiresIn: number;
  }>;
}

export interface BulkProcessResponse {
  batchId: string;
  status: 'completed' | 'failed';
  succeeded: number;
  failed: number;
  items: Partial<BulkUploadItem>[];
}

export const BULK_LIMITS = {
  MAX_FILES: 10,
  MAX_FILE_SIZE_BYTES: 25 * 1024 * 1024,
  ALLOWED_EXTENSIONS: ['.pdf', '.docx'] as const,
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ] as const,
} as const;
