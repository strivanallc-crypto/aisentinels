// ─────────────────────────────────────────────────────────────
// AI Sentinels — shared TypeScript types
// Enum values match DB pgEnum declarations exactly (lowercase_underscore).
// Display maps translate DB values → human-readable labels for UI.
// ─────────────────────────────────────────────────────────────

// ── Document Studio ──────────────────────────────────────────

export type DocType =
  | 'policy'
  | 'procedure'
  | 'work_instruction'
  | 'form'
  | 'record'
  | 'manual'
  | 'plan'
  | 'specification'
  | 'external';

export type DocStatus = 'draft' | 'review' | 'approved' | 'published' | 'archived';

export interface Document {
  id: string;
  tenantId: string;
  siteId?: string | null;
  title: string;
  docType: DocType;
  standards: string[];
  clauseRefs: string[];
  bodyJsonb?: Record<string, unknown> | null;
  status: DocStatus;
  version: number;
  approvedBy?: string | null;
  approvedAt?: string | null;
  effectiveDate?: string | null;
  reviewDate?: string | null;
  sha256Hash?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ── Audit Studio ─────────────────────────────────────────────

export type AuditType = 'internal' | 'supplier' | 'certification' | 'surveillance';

export type AuditSessionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export type FindingSeverity = 'major_nc' | 'minor_nc' | 'observation' | 'opportunity';

export type FindingStatus = 'open' | 'in_capa' | 'closed';

export interface AuditSession {
  id: string;
  tenantId: string;
  programId?: string | null;
  siteId?: string | null;
  title: string;
  auditType: AuditType;
  leadAuditorId?: string | null;
  auditDate: string;        // ISO string
  scope: string;
  clauseRefs: string[];
  status: AuditSessionStatus;
  summary?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditFinding {
  id: string;
  tenantId: string;
  sessionId: string;
  clauseRef: string;
  standard: string;
  severity: FindingSeverity;
  description: string;
  evidenceIds: string[];
  capaId?: string | null;
  status: FindingStatus;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── CAPA ─────────────────────────────────────────────────────

export type CapaStatus =
  | 'open'
  | 'in_progress'
  | 'pending_verification'
  | 'closed'
  | 'cancelled';

export type CapaSourceType =
  | 'audit_finding'
  | 'customer_complaint'
  | 'nonconformity'
  | 'incident'
  | 'management_review'
  | 'risk_assessment'
  | 'employee_suggestion';

export type RootCauseMethod = 'five_why' | 'fishbone' | 'fault_tree' | 'eight_d' | 'pareto';

export type IsoStandard = 'iso_9001' | 'iso_14001' | 'iso_45001';

export interface CapaAction {
  id: string;
  description: string;
  ownerId: string;
  dueDate: string;
  completedAt?: string;
  status: 'open' | 'in_progress' | 'completed';
}

export interface CapaRecord {
  id: string;
  tenantId: string;
  siteId?: string | null;
  sourceType: CapaSourceType;
  sourceId?: string | null;
  standard: IsoStandard;
  clauseRef: string;
  severity: FindingSeverity;          // reuses audit finding severity enum
  problemDescription: string;
  rootCauseMethod: RootCauseMethod;
  rootCauseAnalysis?: string | null;
  actionsJsonb: CapaAction[];
  ownerId: string;
  dueDate: string;                    // ISO string
  status: CapaStatus;
  closedDate?: string | null;
  effectivenessVerified: boolean;
  effectivenessVerifiedBy?: string | null;
  effectivenessVerifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Records Vault ─────────────────────────────────────────────

export type RecordCategory =
  | 'quality'
  | 'safety'
  | 'training'
  | 'calibration'
  | 'audit'
  | 'incident'
  | 'environmental';

export interface VaultRecord {
  id: string;
  tenantId: string;
  siteId?: string | null;
  title: string;
  category: RecordCategory;
  retentionYears: number;
  retentionExpiresAt?: string | null;
  legalHold: boolean;
  legalHoldReason?: string | null;
  legalHoldAt?: string | null;
  contentText?: string | null;
  sha256Hash?: string | null;
  integrityVerifiedAt?: string | null;   // null = pending; non-null = verified
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ── Badge variant type (subset of Badge cva variants) ────────

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning';

// ── Display label maps ────────────────────────────────────────

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  policy:           'Policy',
  procedure:        'Procedure',
  work_instruction: 'Work Instruction',
  form:             'Form',
  record:           'Record',
  manual:           'Manual',
  plan:             'Plan',
  specification:    'Specification',
  external:         'External',
};

export const DOC_STATUS_LABELS: Record<DocStatus, string> = {
  draft:     'Draft',
  review:    'Under Review',
  approved:  'Approved',
  published: 'Published',
  archived:  'Archived',
};

export const AUDIT_TYPE_LABELS: Record<AuditType, string> = {
  internal:      'Internal',
  supplier:      'Supplier',
  certification: 'Certification',
  surveillance:  'Surveillance',
};

export const AUDIT_STATUS_LABELS: Record<AuditSessionStatus, string> = {
  scheduled:   'Scheduled',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
};

export const FINDING_SEVERITY_LABELS: Record<FindingSeverity, string> = {
  major_nc:    'Major NC',
  minor_nc:    'Minor NC',
  observation: 'Observation',
  opportunity: 'Opportunity',
};

export const FINDING_STATUS_LABELS: Record<FindingStatus, string> = {
  open:     'Open',
  in_capa:  'In CAPA',
  closed:   'Closed',
};

// ── Badge variant maps ────────────────────────────────────────

export const DOC_STATUS_VARIANT: Record<DocStatus, BadgeVariant> = {
  draft:     'secondary',
  review:    'warning',
  approved:  'success',
  published: 'default',
  archived:  'outline',
};

export const AUDIT_STATUS_VARIANT: Record<AuditSessionStatus, BadgeVariant> = {
  scheduled:   'default',
  in_progress: 'warning',
  completed:   'success',
  cancelled:   'outline',
};

export const FINDING_SEVERITY_VARIANT: Record<FindingSeverity, BadgeVariant> = {
  major_nc:    'destructive',
  minor_nc:    'warning',
  observation: 'default',
  opportunity: 'secondary',
};

// ── CAPA display maps ─────────────────────────────────────────

export const CAPA_STATUS_LABELS: Record<CapaStatus, string> = {
  open:                 'Open',
  in_progress:          'In Progress',
  pending_verification: 'Pending Verification',
  closed:               'Closed',
  cancelled:            'Cancelled',
};

export const CAPA_SOURCE_TYPE_LABELS: Record<CapaSourceType, string> = {
  audit_finding:       'Audit Finding',
  customer_complaint:  'Customer Complaint',
  nonconformity:       'Nonconformity',
  incident:            'Incident',
  management_review:   'Mgmt Review',
  risk_assessment:     'Risk Assessment',
  employee_suggestion: 'Employee Suggestion',
};

export const ROOT_CAUSE_METHOD_LABELS: Record<RootCauseMethod, string> = {
  five_why:   '5-Why',
  fishbone:   'Fishbone (Ishikawa)',
  fault_tree: 'Fault Tree Analysis',
  eight_d:    '8D Report',
  pareto:     'Pareto Analysis',
};

export const ISO_STANDARD_LABELS: Record<IsoStandard, string> = {
  iso_9001:  'ISO 9001',
  iso_14001: 'ISO 14001',
  iso_45001: 'ISO 45001',
};

export const CAPA_STATUS_VARIANT: Record<CapaStatus, BadgeVariant> = {
  open:                 'secondary',
  in_progress:          'warning',
  pending_verification: 'default',
  closed:               'success',
  cancelled:            'outline',
};

// ── Records Vault display maps ────────────────────────────────

export const RECORD_CATEGORY_LABELS: Record<RecordCategory, string> = {
  quality:       'Quality',
  safety:        'Safety',
  training:      'Training',
  calibration:   'Calibration',
  audit:         'Audit',
  incident:      'Incident',
  environmental: 'Environmental',
};

export const RECORD_CATEGORY_VARIANT: Record<RecordCategory, BadgeVariant> = {
  quality:       'default',
  safety:        'destructive',
  training:      'success',
  calibration:   'warning',
  audit:         'secondary',
  incident:      'destructive',
  environmental: 'success',
};

// ── Billing / Subscription ─────────────────────────────────────────────────

export type PlanType  = 'starter' | 'professional' | 'enterprise';
export type SubStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled';

export interface Subscription {
  id: string;
  tenantId: string;
  plan: PlanType;
  status: SubStatus;
  aiCreditsUsed: number;
  aiCreditsLimit: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt?: string | null;
  cancelledAt?: string | null;
  wiseInvoiceId?: string | null;
  wiseTransferId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillingUsage {
  aiCreditsUsed: number;
  aiCreditsLimit: number;
  creditsRemaining: number;
  usagePercent: number;
  periodStart: string;
  periodEnd: string;
  plan: PlanType;
  status: SubStatus;
}

export const PLAN_LABELS: Record<PlanType, string> = {
  starter:      'Starter',
  professional: 'Professional',
  enterprise:   'Scale',
};

export const SUB_STATUS_LABELS: Record<SubStatus, string> = {
  trial:     'Trial',
  active:    'Active',
  past_due:  'Past Due',
  suspended: 'Suspended',
  cancelled: 'Cancelled',
};

export const SUB_STATUS_VARIANT: Record<SubStatus, BadgeVariant> = {
  trial:     'warning',
  active:    'success',
  past_due:  'destructive',
  suspended: 'destructive',
  cancelled: 'outline',
};

export const PLAN_VARIANT: Record<PlanType, BadgeVariant> = {
  starter:      'secondary',
  professional: 'default',
  enterprise:   'success',
};

// ==================== Settings ====================
export interface OrgContext {
  tenantId: string;
  companyName: string | null;
  industry: string | null;
  country: string | null;
  employeeCount: number | null;
  imsScope: string | null;
  certificationTargets: string[];
  createdAt: string;
  updatedAt: string;
}

export interface OrgRole {
  id: string;
  tenantId: string;
  roleName: string;
  permissions: Record<string, boolean>;
  isSystemRole: boolean;
  createdAt: string;
}

export interface OrgUser {
  id: string;
  tenantId: string;
  cognitoSub: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  status: string;
  createdAt: string;
  orgRoles: { roleId: string; roleName: string; assignedAt: string }[];
}

export interface OrgStandard {
  id: string;
  tenantId: string;
  standardCode: string;
  activatedAt: string;
  activatedBy: string | null;
}

// ==================== Brain ====================
export type BrainProcessingStatus = 'pending' | 'chunking' | 'ready' | 'failed';

export interface BrainDocument {
  id: string;
  tenantId: string;
  fileName: string;
  s3Key: string;
  fileType: string;
  docCategory: string;
  relatedStandard: string | null;
  processingStatus: BrainProcessingStatus;
  chunkCount: number;
  uploadedBy: string | null;
  uploadedAt: string;
}

export const BRAIN_STATUS_LABELS: Record<BrainProcessingStatus, string> = {
  pending:  'Pending',
  chunking: 'Processing',
  ready:    'Ready',
  failed:   'Failed',
};

export const BRAIN_STATUS_VARIANT: Record<BrainProcessingStatus, BadgeVariant> = {
  pending:  'secondary',
  chunking: 'warning',
  ready:    'success',
  failed:   'destructive',
};

export const DOC_CATEGORY_LABELS: Record<string, string> = {
  policy:    'Policy',
  procedure: 'Procedure',
  manual:    'Manual',
  form:      'Form',
  record:    'Record',
  external:  'External',
  other:     'Other',
};
