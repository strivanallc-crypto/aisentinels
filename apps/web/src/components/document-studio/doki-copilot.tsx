'use client';

/**
 * DokiCoPilot — Left-panel AI assistant for Document Studio editor.
 * Wires to aiApi.documentGenerate() via existing api.ts.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { Sparkles, Loader2, ArrowDownToLine } from 'lucide-react';
import { aiApi } from '@/lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface DokiCoPilotProps {
  editor: Editor | null;
  standards: string[];
  documentType: string;
}

function DokiShield({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size}>
      <path
        d="M16 2 L28 7 L28 18 C28 24 22 29 16 31 C10 29 4 24 4 18 L4 7 Z"
        fill="#6366F1"
        fillOpacity={0.15}
        stroke="#6366F1"
        strokeWidth={1.5}
      />
      <text x="16" y="21" textAnchor="middle" fill="#6366F1" fontSize="13" fontFamily="Syne" fontWeight="700">
        D
      </text>
    </svg>
  );
}

export function DokiCoPilot({ editor, standards, documentType }: DokiCoPilotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, loading]);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || loading) return;
    const prompt = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: prompt }]);
    setLoading(true);

    try {
      const context = editor ? editor.getText().slice(0, 500) : '';
      const res = await aiApi.documentGenerate({
        documentType: documentType || 'procedure',
        standards: standards.length > 0 ? standards : ['iso_9001'],
        orgContext: `${prompt}\n\nDocument context:\n${context}`,
        sections: ['response'],
      });
      const data = res.data as Record<string, unknown>;
      const responseText =
        (data.content as string) ??
        (data.text as string) ??
        JSON.stringify(data, null, 2);
      setMessages((prev) => [...prev, { role: 'assistant', content: responseText }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Doki is processing... this may take up to 40 seconds. Please try again.' },
      ]);
    }
    setLoading(false);
  }, [input, loading, editor, standards, documentType]);

  const handleInsertAtCursor = useCallback(
    (text: string) => {
      if (!editor) return;
      editor.chain().focus().insertContent(text).run();
    },
    [editor],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const activeStandard = standards[0];
  const standardColor: Record<string, string> = {
    iso_9001: '#3B82F6',
    iso_14001: '#22C55E',
    iso_45001: '#F59E0B',
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--bg-surface, #0f1729)', borderRight: '1px solid var(--border, #1e2d4a)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border, #1e2d4a)' }}
      >
        <DokiShield size={28} />
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary, #f0f4ff)', fontFamily: 'Syne, sans-serif' }}>
          Doki AI
        </span>
        {activeStandard && (
          <div className="ml-auto h-2 w-2 rounded-full" style={{ background: standardColor[activeStandard] ?? '#6366F1' }} />
        )}
      </div>

      {/* Chat area */}
      <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && !loading && (
          <div className="text-center py-8">
            <DokiShield size={48} />
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary, #8899bb)' }}>
              Ask Doki anything about your document.
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted, #4a5a78)' }}>
              Generate content, improve text, or get ISO guidance.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'user' ? (
              <div
                className="max-w-[85%] rounded-lg px-3 py-2 text-sm"
                style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--text-primary, #f0f4ff)' }}
              >
                {msg.content}
              </div>
            ) : (
              <div className="max-w-[95%] space-y-1.5">
                <div
                  className="rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap"
                  style={{
                    background: 'var(--bg-elevated, #151f35)',
                    color: 'var(--text-secondary, #8899bb)',
                    border: '1px solid var(--border, #1e2d4a)',
                  }}
                >
                  {msg.content}
                </div>
                <button
                  onClick={() => handleInsertAtCursor(msg.content)}
                  className="flex items-center gap-1 text-xs underline cursor-pointer transition-opacity hover:opacity-80"
                  style={{ color: '#c2fa69' }}
                >
                  <ArrowDownToLine className="h-3 w-3" />
                  Insert at cursor
                </button>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted, #4a5a78)' }}>
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#6366F1' }} />
            <span>Doki is processing... this may take up to 40 seconds</span>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-4 py-3 space-y-2" style={{ borderTop: '1px solid var(--border, #1e2d4a)' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Doki anything..."
          rows={3}
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none"
          style={{ borderColor: 'var(--border, #1e2d4a)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary, #f0f4ff)' }}
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !input.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-all disabled:opacity-50"
          style={{ background: '#c2fa69', color: '#0a0f1a' }}
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Thinking&hellip;</>
          ) : (
            <><Sparkles className="h-4 w-4" /> Ask Doki</>
          )}
        </button>
      </div>
    </div>
  );
}
