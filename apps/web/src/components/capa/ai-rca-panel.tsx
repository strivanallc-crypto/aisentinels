'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, CheckCircle2, AlertTriangle, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SentinelAvatar } from '@/components/SentinelAvatar';
import { aiApi } from '@/lib/api';

interface Props {
  findingDescription: string;
  clauseRef: string;
  standard: string;
  method: '5why' | 'fishbone' | '8d';
  onComplete?: (rootCause: string, actions: { type: string; description: string; priority: string }[]) => void;
}

interface Message {
  role: 'nexus' | 'user';
  content: string;
}

interface RcaResponse {
  response: string;
  rootCause: string | null;
  actions: { type: string; description: string; priority: string }[] | null;
  isComplete: boolean;
}

const METHOD_LABELS: Record<string, string> = {
  '5why': '5-Why Analysis',
  'fishbone': 'Fishbone (Ishikawa)',
  '8d': '8D Problem Solving',
};

export function AiRcaPanel({ findingDescription, clauseRef, standard, method, onComplete }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [rootCause, setRootCause] = useState<string | null>(null);
  const [actions, setActions] = useState<{ type: string; description: string; priority: string }[]>([]);
  const [started, setStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (userMessage?: string) => {
    setLoading(true);
    setError(null);

    const history = userMessage
      ? [...messages, { role: 'user' as const, content: userMessage }]
      : messages;

    if (userMessage) {
      setMessages(history);
      setInput('');
    }

    try {
      const res = await aiApi.rootCause({
        findingDescription,
        clauseRef,
        standard,
        method,
        history: history.map((m) => ({ role: m.role, content: m.content })),
      });
      const data = res.data as RcaResponse;

      setMessages((prev) => [
        ...prev,
        { role: 'nexus', content: data.response },
      ]);

      if (data.isComplete && data.rootCause) {
        setComplete(true);
        setRootCause(data.rootCause);
        setActions(data.actions ?? []);
        if (onComplete) {
          onComplete(data.rootCause, data.actions ?? []);
        }
      }
    } catch {
      setError('Nexus could not respond. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = () => {
    setStarted(true);
    sendMessage();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    sendMessage(input.trim());
  };

  if (!started) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-8">
        <SentinelAvatar sentinelId="nexus" size={48} />
        <div className="text-center">
          <p className="font-semibold" style={{ color: 'var(--content-text)' }}>
            {METHOD_LABELS[method]} with Nexus
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--content-text-dim)' }}>
            Nexus will guide you through root cause analysis one question at a time
          </p>
        </div>
        <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 px-4 py-2 text-sm max-w-md" style={{ color: 'var(--content-text)' }}>
          <p className="font-medium text-purple-400 text-xs mb-1">Finding:</p>
          <p className="text-xs">{findingDescription}</p>
        </div>
        <Button onClick={handleStart}>
          <MessageSquare className="mr-1.5 h-4 w-4" />
          Begin Analysis
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-xl border border-white/10" style={{ background: 'var(--content-surface)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <SentinelAvatar sentinelId="nexus" size={24} />
        <div className="flex-1">
          <span className="text-sm font-medium" style={{ color: 'var(--content-text)' }}>
            {METHOD_LABELS[method]}
          </span>
          <span className="ml-2 text-xs" style={{ color: 'var(--content-text-dim)' }}>
            {standard.replace('_', ' ').toUpperCase()} {clauseRef}
          </span>
        </div>
        {complete && (
          <Badge variant="success">Root Cause Identified</Badge>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 max-h-80 min-h-[200px]">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'nexus' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'nexus'
                  ? 'bg-purple-500/10 border border-purple-500/20'
                  : 'bg-blue-500/10 border border-blue-500/20'
              }`}
              style={{ color: 'var(--content-text)' }}
            >
              {msg.role === 'nexus' && (
                <span className="block text-[10px] font-semibold text-purple-400 mb-0.5">Nexus</span>
              )}
              {msg.role === 'user' && (
                <span className="block text-[10px] font-semibold text-blue-400 mb-0.5">You</span>
              )}
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--content-text-dim)' }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            Nexus is analysing…
          </div>
        )}
      </div>

      {/* Root cause result */}
      {complete && rootCause && (
        <div className="mx-4 mb-2 rounded-lg border border-green-500/20 bg-green-500/10 p-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <span className="text-sm font-semibold text-green-300">Root Cause</span>
          </div>
          <p className="text-sm text-green-200">{rootCause}</p>

          {actions.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-xs font-semibold text-green-400 uppercase">Recommended Actions</p>
              {actions.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Badge
                    variant={a.priority === 'high' ? 'destructive' : a.priority === 'medium' ? 'warning' : 'secondary'}
                    className="text-[10px] flex-shrink-0 mt-0.5"
                  >
                    {a.priority}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] flex-shrink-0 mt-0.5">{a.type}</Badge>
                  <span style={{ color: 'var(--content-text)' }}>{a.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-red-400" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }}>
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {/* Input */}
      {!complete && (
        <form onSubmit={handleSubmit} className="flex gap-2 border-t border-white/10 p-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Answer Nexus's question…"
            disabled={loading}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/20 disabled:opacity-50"
            style={{ color: 'var(--content-text)' }}
          />
          <Button type="submit" disabled={loading || !input.trim()} size="sm">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      )}
    </div>
  );
}
