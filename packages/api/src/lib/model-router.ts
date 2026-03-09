/**
 * Multi-model router — dispatches tasks to Claude or Gemini based on task type.
 *
 * Routing strategy (hardcoded, no external config):
 *   Claude (Omni): orchestration, deep analysis, reasoning
 *   Gemini (Sentinels): high-volume generation, bulk classification
 */
import { callClaude, type ClaudeMessage } from './claude.ts';
import { callGemini } from './gemini.ts';

export type TaskType =
  | 'orchestration'     // → Claude (Omni coordination, workflow decisions)
  | 'audit-analysis'    // → Claude (Audie deep examination, finding classification)
  | 'root-cause'        // → Claude (Nexus 5-Why/Fishbone reasoning)
  | 'document-gen'      // → Gemini (Doki high-volume generation)
  | 'clause-classify'   // → Gemini (bulk classification)
  | 'audit-plan'        // → Gemini (plan generation)
  | 'gap-detect';       // → Gemini (matrix analysis)

const CLAUDE_TASKS = new Set<TaskType>(['orchestration', 'audit-analysis', 'root-cause']);

/**
 * Returns which model handles a given task type.
 */
export function routeToModel(task: TaskType): 'claude' | 'gemini' {
  return CLAUDE_TASKS.has(task) ? 'claude' : 'gemini';
}

/**
 * Single call surface — callers don't need to know which model handles the task.
 * Routes to the appropriate model and returns the response text.
 */
export async function getModelForTask(
  task: TaskType,
  systemPrompt: string,
  messages: ClaudeMessage[],
  tenantId: string,
): Promise<string> {
  if (routeToModel(task) === 'claude') {
    const result = await callClaude({ systemPrompt, messages, tenantId });
    return result.content;
  }

  // Gemini takes a single userPrompt — join all message contents
  const userPrompt = messages
    .map((m) => m.content)
    .join('\n\n');

  const result = await callGemini({ systemPrompt, userPrompt, tenantId });
  return result.text;
}
