/**
 * Board Report Executive Summary Generator — Phase 9-A
 *
 * Uses callClaude() (Claude Sonnet) to generate a concise 3-paragraph
 * executive summary for a board-level ISO compliance report.
 * Omni persona — professional, data-driven, flowing prose.
 *
 * On Claude failure: returns a fallback generic summary. NEVER throws.
 */
import { callClaude } from './claude.ts';
import type { BoardReportData } from '../types/board-report.ts';

const SYSTEM_PROMPT = `You are Omni, AI Sentinels Virtual Quality Manager.
Write a concise 3-paragraph executive summary for a board-level ISO compliance report. Tone: professional, board-appropriate, data-driven. Never use bullet points. Write in flowing prose.

Paragraph 1: Overall compliance posture this period. Reference specific scores and standards.

Paragraph 2: Key risks — overdue CAPAs, open findings, gaps. Be direct. Board members need to know what needs attention.

Paragraph 3: Positive trajectory and forward outlook. Reference improvements, closed items, upcoming milestones.

Do not mention AI Sentinels as a tool. Write as if you are the Quality Manager presenting to the board. Keep total length under 250 words.`;

export async function generateExecutiveSummary(
  data: Omit<BoardReportData, 'executiveSummary'>,
): Promise<string> {
  try {
    const response = await callClaude({
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(data, null, 2) }],
      maxTokens: 1024,
      tenantId: data.tenantId,
    });

    return response.content.trim();
  } catch (err) {
    console.error('Executive summary generation failed:', err);
    return buildFallbackSummary(data);
  }
}

function buildFallbackSummary(
  data: Omit<BoardReportData, 'executiveSummary'>,
): string {
  const { complianceScores, capasSummary, documentCompletion, reportPeriod } = data;

  return `For the period of ${reportPeriod.label}, the organization's overall compliance score stands at ${complianceScores.overall}%. ${complianceScores.byStandard.length} management system standards are actively monitored with varying levels of maturity across the portfolio.

${capasSummary.overdue > 0 ? `There are ${capasSummary.overdue} overdue corrective actions requiring immediate management attention. ` : ''}The CAPA program currently tracks ${capasSummary.total} items, of which ${capasSummary.closedThisPeriod} were closed this period. Document control shows ${documentCompletion.completionRate}% completion with ${documentCompletion.pendingApproval} items awaiting approval.

The management team is advised to review this report in conjunction with the detailed findings below and prioritize resources towards the areas identified for improvement.`;
}
