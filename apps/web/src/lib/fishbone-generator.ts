// ── Fishbone (Ishikawa) Mermaid diagram generator ──────────────────
// Pure function — no side effects, no DOM access.

export interface RootCauseCause {
  category: string;
  items: string[];
}

/**
 * Generate a Mermaid fishbone (cause-and-effect) diagram string from
 * structured root-cause data.
 *
 * @param finding  The nonconformity / problem description (effect on the right)
 * @param causes   Array of { category, items } — only categories present in the
 *                 AI response should be passed; empty categories are skipped.
 * @returns        Valid Mermaid `fishbone` diagram string, or empty string if
 *                 there are no causes to render.
 */
export function generateFishboneDiagram(
  finding: string,
  causes: RootCauseCause[],
): string {
  const valid = causes.filter((c) => c.items.length > 0);
  if (valid.length === 0) return '';

  const escape = (s: string): string =>
    s.replace(/"/g, "'").replace(/[[\]{}()#&;]/g, ' ').trim();

  const truncated =
    finding.length > 80 ? finding.slice(0, 77) + '...' : finding;

  let diagram = `%%{init: {"theme": "dark"}}%%\nfishbone\n`;
  diagram += `  title ${escape(truncated)}\n`;

  for (const cause of valid) {
    diagram += `  section ${escape(cause.category)}\n`;
    for (const item of cause.items) {
      diagram += `    ${escape(item)}\n`;
    }
  }

  return diagram;
}
