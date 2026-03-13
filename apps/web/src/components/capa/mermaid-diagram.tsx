'use client';

import { useState, useEffect, useCallback, useId } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';

interface MermaidDiagramProps {
  /** Raw Mermaid diagram definition string */
  definition: string;
}

export function MermaidDiagram({ definition }: MermaidDiagramProps) {
  const reactId = useId();
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const render = useCallback(async () => {
    if (!definition) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSvgContent(null);

    try {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        fontFamily: 'Inter, system-ui, sans-serif',
      });

      // Produce a DOM-safe id from the React useId value
      const safeId = `mermaid-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`;
      const { svg } = await mermaid.render(safeId, definition);
      setSvgContent(svg);
    } catch (err) {
      console.error('Mermaid render failed:', err);
      setError(err instanceof Error ? err.message : 'Diagram rendering failed');
    } finally {
      setLoading(false);
    }
  }, [definition, reactId]);

  useEffect(() => {
    render();
  }, [render]);

  return (
    <div
      className="rounded-lg border overflow-auto"
      style={{
        borderColor: '#8B5CF6',
        background: '#0a0a0a',
      }}
    >
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-full max-w-md mx-4 animate-pulse rounded bg-white/5" />
        </div>
      )}

      {svgContent && !loading && (
        <div
          className="overflow-x-auto p-4 [&_svg]:mx-auto [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      )}

      {error && !loading && (
        <div className="flex items-center gap-2 px-4 py-3 text-xs text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          Diagram rendering failed: {error}
        </div>
      )}
    </div>
  );
}
