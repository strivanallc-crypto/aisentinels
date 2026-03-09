'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Loader2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SentinelAvatar } from '@/components/SentinelAvatar';

// ── Types ──────────────────────────────────────────────────────
export interface IshikawaCause {
  category: string; // 'Man' | 'Machine' | 'Method' | 'Material' | 'Measurement' | 'Mother Nature'
  items: string[];
}

export interface IshikawaProps {
  problem: string;
  causes: IshikawaCause[];
  capaId: string;
  standard?: string;
  clauseRef?: string;
}

// ── Category colors (sentinel palette) ──────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  'Man':           '#3B82F6', // blue
  'Machine':       '#22C55E', // green
  'Method':        '#F59E0B', // amber
  'Material':      '#EF4444', // red
  'Measurement':   '#8B5CF6', // purple (Nexus)
  'Mother Nature': '#06B6D4', // cyan
};

const getCategoryColor = (cat: string): string =>
  CATEGORY_COLORS[cat] ?? '#8B5CF6';

// ── Build Mermaid fishbone syntax ────────────────────────────────
function buildFishboneSyntax(problem: string, causes: IshikawaCause[]): string {
  // Escape special characters for Mermaid
  const escape = (s: string) => s.replace(/"/g, "'").replace(/[[\]{}()#&;]/g, ' ').trim();

  const truncated = problem.length > 80 ? problem.slice(0, 77) + '...' : problem;

  let diagram = `%%{init: {"theme": "dark"}}%%\nfishbone\n`;
  diagram += `  title ${escape(truncated)}\n`;

  for (const cause of causes) {
    if (cause.items.length === 0) continue;
    diagram += `  section ${escape(cause.category)}\n`;
    for (const item of cause.items) {
      diagram += `    ${escape(item)}\n`;
    }
  }

  return diagram;
}

// ── Component ────────────────────────────────────────────────────
export function IshikawaDiagram({ problem, causes, capaId, standard, clauseRef }: IshikawaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const renderDiagram = useCallback(async () => {
    if (!causes || causes.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        fontFamily: 'Inter, system-ui, sans-serif',
      });

      const diagramString = buildFishboneSyntax(problem, causes);
      const id = `ishikawa-${capaId.replace(/[^a-zA-Z0-9]/g, '')}`;

      const { svg } = await mermaid.render(id, diagramString);
      setSvgContent(svg);
    } catch (err) {
      console.error('Mermaid render failed:', err);
      setError(err instanceof Error ? err.message : 'Diagram rendering failed');
    } finally {
      setLoading(false);
    }
  }, [problem, causes, capaId]);

  useEffect(() => {
    renderDiagram();
  }, [renderDiagram]);

  const handleDownload = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ishikawa-${capaId}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Empty state ────────────────────────────────────────────────
  if (!causes || causes.length === 0) {
    return (
      <div
        className="rounded-xl border p-6"
        style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <SentinelAvatar sentinelId="nexus" size={28} />
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
            Ishikawa Analysis
          </h3>
          {clauseRef && (
            <Badge variant="outline" className="text-[10px]">
              {standard?.replace('_', ' ').toUpperCase()} {clauseRef}
            </Badge>
          )}
        </div>
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
          <p className="text-sm" style={{ color: 'var(--content-text-dim)' }}>
            Root cause analysis in progress — Nexus is building the diagram
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border"
      style={{ borderColor: 'var(--content-border)', background: 'var(--content-surface)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--content-border)' }}
      >
        <div className="flex items-center gap-3">
          <SentinelAvatar sentinelId="nexus" size={28} />
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--content-text-muted)' }}>
            Ishikawa Analysis
          </h3>
          {clauseRef && (
            <Badge variant="outline" className="text-[10px]">
              {standard?.replace('_', ' ').toUpperCase()} {clauseRef}
            </Badge>
          )}
        </div>
        {svgContent && (
          <Button variant="ghost" size="sm" onClick={handleDownload}>
            <Download className="mr-1 h-3 w-3" />
            SVG
          </Button>
        )}
      </div>

      {/* Diagram */}
      <div className="p-4">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
          </div>
        )}

        {svgContent && !loading && (
          <div
            ref={containerRef}
            className="overflow-x-auto [&_svg]:mx-auto [&_svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        )}

        {error && !loading && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              Diagram render failed — showing text view
            </div>
            {/* Fallback: text list of causes */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {causes.map((cause) => (
                <div
                  key={cause.category}
                  className="rounded-lg border p-3"
                  style={{ borderColor: getCategoryColor(cause.category) + '33' }}
                >
                  <h4
                    className="text-xs font-bold uppercase tracking-wider mb-2"
                    style={{ color: getCategoryColor(cause.category) }}
                  >
                    {cause.category}
                  </h4>
                  <ul className="space-y-1">
                    {cause.items.map((item, i) => (
                      <li key={i} className="text-xs" style={{ color: 'var(--content-text)' }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      {!loading && !error && (
        <div
          className="flex flex-wrap gap-3 px-4 py-2"
          style={{ borderTop: '1px solid var(--content-border)' }}
        >
          {causes.map((cause) => (
            <div key={cause.category} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: getCategoryColor(cause.category) }}
              />
              <span className="text-[10px]" style={{ color: 'var(--content-text-dim)' }}>
                {cause.category} ({cause.items.length})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
