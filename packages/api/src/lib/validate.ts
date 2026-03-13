import { z } from 'zod';

// ── DB enum constants (must match schema/migrations exactly) ──────────────────

const CAPA_SOURCE_TYPES = [
  'audit_finding', 'customer_complaint', 'nonconformity',
  'incident', 'management_review', 'risk_assessment', 'employee_suggestion',
] as const;
const ISO_STANDARDS      = ['iso_9001', 'iso_14001', 'iso_45001'] as const;
const FINDING_SEVERITIES = ['major_nc', 'minor_nc', 'observation', 'opportunity'] as const;
const ROOT_CAUSE_METHODS = ['five_why', 'fishbone', 'fault_tree', 'eight_d', 'pareto'] as const;
const CAPA_STATUSES      = ['open', 'in_progress', 'pending_verification', 'closed', 'cancelled'] as const;
const AUDIT_TYPES        = ['internal', 'supplier', 'certification', 'surveillance'] as const;
const PLAN_TYPES         = ['starter', 'professional', 'enterprise'] as const;
const DOC_TYPES          = [
  'policy', 'procedure', 'work_instruction', 'form', 'record',
  'manual', 'plan', 'specification', 'external',
] as const;
const RECORD_CATEGORIES  = [
  'quality', 'safety', 'training', 'calibration', 'audit', 'incident', 'environmental',
] as const;

// ── Reusable refinements ──────────────────────────────────────────────────────

const futureDate = (label: string) =>
  z.string().refine(
    (s) => {
      const d = new Date(s);
      if (isNaN(d.getTime())) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return d >= today;
    },
    `${label} must be a valid date today or in the future`,
  );

const anyDate = (label: string) =>
  z.string().refine(
    (s) => !isNaN(new Date(s).getTime()),
    `${label} must be a valid ISO date string`,
  );

// ── Request schemas ───────────────────────────────────────────────────────────

export const CreateCapaSchema = z.object({
  sourceType:         z.enum(CAPA_SOURCE_TYPES),
  standard:           z.enum(ISO_STANDARDS),
  severity:           z.enum(FINDING_SEVERITIES),
  problemDescription: z.string().min(1).max(2000).transform((s) => s.trim()),
  dueDate:            futureDate('dueDate'),
  clauseRef:          z.string().max(100).optional().transform((s) => s?.trim() ?? ''),
  rootCauseMethod:    z.enum(ROOT_CAUSE_METHODS).optional().default('five_why'),
  rootCauseAnalysis:  z.string().max(5000).optional().transform((s) => s?.trim() || null),
});

export const UpdateCapaStatusSchema = z.object({
  status: z.enum(CAPA_STATUSES),
});

const ACTION_TYPES = ['corrective', 'preventive'] as const;

export const AddCapaActionSchema = z.object({
  description: z.string().min(1).max(2000).transform((s) => s.trim()),
  actionType:  z.enum(ACTION_TYPES).optional().default('corrective'),
  owner:       z.string().max(200).optional().transform((s) => s?.trim() || undefined),
  dueDate:     anyDate('dueDate').optional(),
});

export const CreateAuditSchema = z.object({
  title:      z.string().min(1).max(500).transform((s) => s.trim()),
  auditType:  z.enum(AUDIT_TYPES),
  scope:      z.string().min(1).max(2000).transform((s) => s.trim()),
  auditDate:  anyDate('auditDate'),
  clauseRefs: z.array(z.string().max(100)).max(50).optional().default([]),
  standards:  z.array(z.enum(ISO_STANDARDS)).max(10).optional().default([]),
});

export const AddFindingSchema = z.object({
  clauseRef:   z.string().min(1).max(100).transform((s) => s.trim()),
  standard:    z.enum(ISO_STANDARDS),
  severity:    z.enum(FINDING_SEVERITIES),
  description: z.string().min(1).max(5000).transform((s) => s.trim()),
});

export const UpgradePlanSchema = z.object({
  // Business logic (upgrade-only direction) validated separately in handler
  plan: z.enum(PLAN_TYPES),
});

export const CreateDocumentSchema = z.object({
  title:      z.string().min(1).max(500).transform((s) => s.trim()),
  docType:    z.enum(DOC_TYPES),
  content:    z.string().max(50_000).optional(),
  standards:  z.array(z.enum(ISO_STANDARDS)).max(10).optional().default([]),
  clauseRefs: z.array(z.string().max(100)).max(50).optional().default([]),
});

export const UpdateDocumentSchema = z.object({
  title:      z.string().min(1).max(500).transform((s) => s.trim()).optional(),
  bodyJsonb:  z.record(z.unknown()).optional(),
  standards:  z.array(z.enum(ISO_STANDARDS)).max(10).optional(),
  clauseRefs: z.array(z.string().max(100)).max(50).optional(),
});

export const CreateRecordSchema = z.object({
  title:          z.string().min(1).max(500).transform((s) => s.trim()),
  category:       z.enum(RECORD_CATEGORIES),
  retentionYears: z.number().int().min(1).max(75).optional().default(7),
  contentText:    z.string().max(100_000).optional(),
});

// ── Settings schemas (Phase 3) ───────────────────────────────────────────────

const STANDARD_CODES = ['ISO 9001', 'ISO 14001', 'ISO 45001'] as const;
const INDUSTRIES = ['manufacturing', 'construction', 'food', 'energy', 'other'] as const;
const DOC_CATEGORIES = [
  'qms_manual', 'ems_manual', 'ohs_manual', 'procedure', 'policy', 'other',
] as const;
const FILE_TYPES = ['pdf', 'docx', 'txt'] as const;

export const UpdateOrgSchema = z.object({
  companyName:          z.string().min(1).max(200).transform((s) => s.trim()),
  industry:             z.enum(INDUSTRIES).optional(),
  country:              z.string().max(100).optional(),
  employeeCount:        z.number().int().min(1).max(1_000_000).optional(),
  imsScope:             z.string().max(5000).optional(),
  certificationTargets: z.array(z.enum(STANDARD_CODES)).max(3).optional(),
});

export const ActivateStandardSchema = z.object({
  standardCode: z.enum(STANDARD_CODES),
});

export const InviteUserSchema = z.object({
  email:  z.string().email().max(254),
  roleId: z.string().uuid(),
});

export const UpdateUserRoleSchema = z.object({
  roleId: z.string().uuid(),
});

// ── Brain schemas (Phase 3) ──────────────────────────────────────────────────

export const UploadUrlSchema = z.object({
  fileName:        z.string().min(1).max(500).transform((s) => s.trim()),
  fileType:        z.enum(FILE_TYPES),
  docCategory:     z.enum(DOC_CATEGORIES),
  relatedStandard: z.enum(STANDARD_CODES).optional(),
});

export const ProcessDocumentSchema = z.object({
  orgDocumentId: z.string().uuid(),
});

// ── parseBody helper ──────────────────────────────────────────────────────────

type HttpResponse = { statusCode: number; headers: { 'Content-Type': string }; body: string };

/**
 * Parse and validate the Lambda event body using a Zod schema.
 *
 * Returns `{ data: T }` on success.
 * Returns an HTTP 400 response object on invalid JSON or schema violation —
 * handlers can return it directly with a narrowing check:
 *
 *   const parsed = parseBody(MySchema, event.body);
 *   if ('statusCode' in parsed) return parsed;
 *   const { field } = parsed.data;
 */
export function parseBody<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  rawBody: string | null | undefined,
): { data: T } | HttpResponse {
  let parsed: unknown;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.errors[0]!;
    const path  = first.path.length ? first.path.join('.') : 'body';
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `${path}: ${first.message}` }),
    };
  }
  return { data: result.data };
}
