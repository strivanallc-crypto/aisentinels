/**
 * POST /api/v1/omni/orchestrate
 *
 * Omni entry point — think → plan → act → observe.
 * NOT yet wired to API Gateway (Phase 2). Handler logic only.
 */
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { callClaude, type ClaudeMessage } from '../../lib/claude.ts';
import { buildOmniOrchestrationPrompt } from '../../lib/omni-prompt.ts';
import { extractClaims } from '../../middleware/auth-context.ts';
import { parseBody } from '../../lib/validate.ts';
import { logAuditEvent } from '../../lib/audit-logger.ts';
import { sendWorkflowUpdate, sendFindingNotification } from '../../lib/omni-mailer.ts';
import { sendEmailWithRetry, FROM_OMNI } from '../../lib/mailer.ts';
import { approvalRequestTemplate } from '../../lib/email-templates.ts';
import { generateApprovalToken } from '../../lib/approval-token.ts';

// ── Sentinel handler imports (direct function calls, not HTTP) ──────────────
import { documentGenerate } from '../ai/document-generate.ts';
import { clauseClassify } from '../ai/clause-classify.ts';
import { auditPlan } from '../ai/audit-plan.ts';
import { auditExamine } from '../ai/audit-examine.ts';
import { auditReport } from '../ai/audit-report.ts';
import { rootCause } from '../ai/root-cause.ts';
import { gapDetect } from '../ai/gap-detect.ts';
import { managementReview } from '../ai/management-review.ts';

// ── Types ───────────────────────────────────────────────────────────────────

interface PlanStep {
  sentinel: string;
  action: string;
  input: Record<string, unknown>;
  dependsOn?: number[];
}

interface ExecutionPlan {
  classification: 'single-sentinel' | 'multi-sentinel-workflow';
  steps: PlanStep[];
  summary: string;
}

interface StepResult {
  stepIndex: number;
  sentinel: string;
  action: string;
  status: 'completed' | 'failed';
  output?: unknown;
  error?: string;
}

// ── Input schema ────────────────────────────────────────────────────────────

const OrchestrateSchema = z.object({
  task: z.string().min(1).max(5000),
  context: z.string().max(10000).optional(),
  involvedSentinels: z.array(z.string()).max(10).optional(),
  workflowId: z.string().uuid().optional(),
});

// ── Sentinel action registry ────────────────────────────────────────────────

type SentinelHandler = (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
) => Promise<{ statusCode: number; headers: Record<string, string>; body: string }>;

const SENTINEL_ACTIONS: Record<string, SentinelHandler> = {
  'document-generate': documentGenerate as SentinelHandler,
  'clause-classify': clauseClassify as SentinelHandler,
  'audit-plan': auditPlan as SentinelHandler,
  'audit-examine': auditExamine as SentinelHandler,
  'audit-report': auditReport as SentinelHandler,
  'root-cause': rootCause as SentinelHandler,
  'gap-detect': gapDetect as SentinelHandler,
  'management-review': managementReview as SentinelHandler,
};

// ── Helpers ─────────────────────────────────────────────────────────────────

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const AVAILABLE_ACTIONS = `Available sentinel actions:
- document-generate: Doki writes complete ISO documents
  Input: { "documentType": string, "standards": string[], "orgContext": string, "sections": string[] }
- clause-classify: Doki classifies documents by ISO clause
  Input: { "content": string, "fileName": string, "standards": string[] }
- audit-plan: Audie generates ISO 19011:6.3 audit plan
  Input: { "title": string, "auditType": "internal"|"supplier"|"certification"|"surveillance", "scope": string, "standards": string[], "clauseRefs": string[] }
- audit-examine: Audie examines a clause with evidence
  Input: { "clauseRef": string, "standard": string, "evidence": string, "conversationHistory": {"role":string,"content":string}[] }
- audit-report: Audie generates formal audit report
  Input: { "auditId": string, "findings": object[], "scope": string }
- root-cause: Nexus guides RCA one question at a time
  Input: { "findingDescription": string, "clauseRef": string, "standard": string, "method": "5why"|"fishbone"|"8d" }
- gap-detect: Platform gap analysis
  Input: { "standard": string, "scope": string, "existingDocs": string[] }
- management-review: Platform management review
  Input: { "standard": string, "period": string, "metrics": object }`;

// ── Handler ─────────────────────────────────────────────────────────────────

export async function orchestrate(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
) {
  const { sub, tenantId, role } = extractClaims(event);
  const parsed = parseBody(OrchestrateSchema, event.body);
  if ('statusCode' in parsed) return parsed;
  const { task, context, involvedSentinels, workflowId } = parsed.data;

  const currentWorkflowId = workflowId ?? randomUUID();

  // ── THINK + PLAN ────────────────────────────────────────────────────────

  const omniPrompt = buildOmniOrchestrationPrompt({
    tenantId,
    orgName: 'Organisation',    // resolved from DB in Phase 2
    activeStandards: [],         // resolved from DB in Phase 2
    userRole: role,
    taskDescription: task,
  });

  const planMessages: ClaudeMessage[] = [
    {
      role: 'user',
      content: `Task: ${task}${context ? `\n\nAdditional Context: ${context}` : ''}${involvedSentinels?.length ? `\n\nSuggested Sentinels: ${involvedSentinels.join(', ')}` : ''}

${AVAILABLE_ACTIONS}

Generate a structured execution plan as JSON:
{
  "classification": "single-sentinel" or "multi-sentinel-workflow",
  "steps": [
    { "sentinel": "sentinel-name", "action": "action-name", "input": { ... }, "dependsOn": [] }
  ],
  "summary": "brief description of the plan"
}

Rules:
- Each step's "action" MUST be one of the available sentinel actions listed above
- "dependsOn" is an array of step indices (e.g., [0] means depends on step at index 0)
- Order steps logically based on dependencies
- Include only the steps needed to accomplish the task
- Return ONLY valid JSON, no markdown fences or extra text`,
    },
  ];

  const planResult = await callClaude({
    systemPrompt: omniPrompt,
    messages: planMessages,
    tenantId,
    maxTokens: 2048,
  });

  let plan: ExecutionPlan;
  try {
    plan = JSON.parse(planResult.content) as ExecutionPlan;
  } catch {
    return json(500, {
      error: 'Omni failed to generate a valid execution plan',
      workflowId: currentWorkflowId,
    });
  }

  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    return json(400, {
      error: 'Omni generated an empty execution plan',
      workflowId: currentWorkflowId,
      plan,
    });
  }

  // ── ACT ─────────────────────────────────────────────────────────────────

  const results: StepResult[] = [];
  const completedSteps = new Set<number>();

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    if (!step) continue;

    // Check dependencies
    const deps = step.dependsOn ?? [];
    const depsUnmet = deps.some((d) => !completedSteps.has(d));

    if (depsUnmet) {
      results.push({
        stepIndex: i,
        sentinel: step.sentinel,
        action: step.action,
        status: 'failed',
        error: 'Skipped: upstream dependency failed or was not completed',
      });
      continue;
    }

    const handler = SENTINEL_ACTIONS[step.action];
    if (!handler) {
      results.push({
        stepIndex: i,
        sentinel: step.sentinel,
        action: step.action,
        status: 'failed',
        error: `Unknown sentinel action: ${step.action}`,
      });
      continue;
    }

    try {
      // Build synthetic event preserving JWT claims from original request
      const syntheticEvent = {
        ...event,
        body: JSON.stringify(step.input),
      };

      const response = await handler(syntheticEvent);
      const output = JSON.parse(response.body) as Record<string, unknown>;

      if (response.statusCode >= 400) {
        results.push({
          stepIndex: i,
          sentinel: step.sentinel,
          action: step.action,
          status: 'failed',
          error: String(output['error'] ?? `HTTP ${response.statusCode}`),
        });
      } else {
        results.push({
          stepIndex: i,
          sentinel: step.sentinel,
          action: step.action,
          status: 'completed',
          output,
        });
        completedSteps.add(i);
      }
    } catch (err) {
      results.push({
        stepIndex: i,
        sentinel: step.sentinel,
        action: step.action,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── OBSERVE ─────────────────────────────────────────────────────────────

  const synthesisMessages: ClaudeMessage[] = [
    {
      role: 'user',
      content: `Original task: ${task}

Execution plan:
${JSON.stringify(plan, null, 2)}

Step results:
${JSON.stringify(results, null, 2)}

Synthesize the results into a structured JSON response with this exact schema:
{
  "summary": "Management-level synthesis: what was accomplished, key outputs, failed steps and impact, actionable next steps, ISO clause citations. Be concise and authoritative.",
  "requiresApproval": false,
  "approvalTarget": null,
  "findings": []
}

If any step produced a document needing approval, set requiresApproval=true and populate approvalTarget.
If any step produced audit findings or nonconformities, populate the findings array.
Return ONLY valid JSON.`,
    },
  ];

  const synthesisResult = await callClaude({
    systemPrompt: omniPrompt,
    messages: synthesisMessages,
    tenantId,
    maxTokens: 4096,
  });

  // ── AUDIT ───────────────────────────────────────────────────────────────

  logAuditEvent({
    eventType:  'omni.orchestrated',
    entityType: 'sentinel',
    entityId:   currentWorkflowId,
    actorId:    sub,
    tenantId,
    action:     'ORCHESTRATE',
    detail:     {
      task: task.slice(0, 200),
      classification: plan.classification,
      stepsTotal:     plan.steps.length,
      stepsCompleted: completedSteps.size,
    },
    severity: 'info',
  });

  // ── PARSE SYNTHESIS ────────────────────────────────────────────────────

  interface SynthesisOutput {
    summary: string;
    requiresApproval?: boolean;
    approvalTarget?: {
      email: string;
      name: string;
      documentId: string;
      documentTitle: string;
    } | null;
    findings?: {
      type: string;
      description: string;
      clauseRef: string;
      standard: string;
    }[];
  }

  let synthesis: SynthesisOutput;
  try {
    synthesis = JSON.parse(synthesisResult.content) as SynthesisOutput;
  } catch {
    // Fallback: treat raw text as summary if JSON parsing fails
    synthesis = {
      summary: synthesisResult.content,
      requiresApproval: false,
      approvalTarget: null,
      findings: [],
    };
  }

  // ── COMMUNICATE (Phase 5 + Phase 10) ────────────────────────────────

  // Send approval request email — FIRE-AND-FORGET if workflow requires approval
  if (synthesis.requiresApproval && synthesis.approvalTarget) {
    const target = synthesis.approvalTarget;
    (async () => {
      try {
        const approvalToken = await generateApprovalToken({
          documentId: target.documentId,
          approverId: sub,
          tenantId,
          action: 'approve',
        });
        const emailData = approvalRequestTemplate({
          documentTitle: target.documentTitle,
          submitterName: target.name ?? 'Team Member',
          isoStandard: 'ISO 9001', // TODO: resolve from workflow context
          submittedAt: new Date().toISOString(),
          documentId: target.documentId,
          approvalToken,
        });
        sendEmailWithRetry({ ...emailData, to: target.email, from: FROM_OMNI });
      } catch (err) {
        console.error(JSON.stringify({
          event: 'ApprovalEmailError',
          workflowId: currentWorkflowId,
          error: String(err),
        }));
      }
    })();
  }

  // Send finding notifications — FIRE-AND-FORGET per finding
  if (synthesis.findings && synthesis.findings.length > 0) {
    for (const finding of synthesis.findings) {
      const findingType = finding.type === 'Major NC' ? 'Major NC'
        : finding.type === 'Minor NC' ? 'Minor NC'
        : 'Observation' as const;
      sendFindingNotification({
        toEmail: '', // TODO: resolve org admin email from DB
        toName: 'Quality Manager',
        findingType,
        findingDescription: finding.description,
        auditId: currentWorkflowId,
        clauseRef: finding.clauseRef,
        standard: finding.standard,
        tenantId,
      }).catch(() => { /* fire-and-forget — error logged in mailer */ });
    }
  }

  // Send workflow summary to the requesting user — FIRE-AND-FORGET
  const sentinelsInvolved = [...new Set(plan.steps.map((s) => s.sentinel))];
  sendWorkflowUpdate({
    toEmail: '', // TODO: resolve requesting user email from Cognito/DB
    toName: 'Team',
    workflowSummary: synthesis.summary,
    workflowId: currentWorkflowId,
    involvedSentinels: sentinelsInvolved,
    tenantId,
  }).catch(() => { /* fire-and-forget — error logged in mailer */ });

  // ── RETURN ──────────────────────────────────────────────────────────────

  return json(200, {
    workflowId: currentWorkflowId,
    plan,
    results,
    synthesis,
    tokenUsage: {
      plan: { inputTokens: planResult.inputTokens, outputTokens: planResult.outputTokens },
      synthesis: { inputTokens: synthesisResult.inputTokens, outputTokens: synthesisResult.outputTokens },
    },
  });
}
