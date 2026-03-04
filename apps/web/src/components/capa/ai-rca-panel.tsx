'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, CheckCircle2, AlertTriangle, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Nexus } from '@/components/sentinels/nexus';
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
      <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-8">
        <Nexus size={48} />
        <div className="text-center">
          <p className="font-semibold text-gray-800">
            {METHOD_LABELS[method]} with Nexus
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Nexus will guide you through root cause analysis one question at a time
          </p>
        </div>
        <div className="rounded-lg bg-purple-50 border border-purple-100 px-4 py-2 text-sm text-gray-700 max-w-md">
          <p className="font-medium text-purple-700 text-xs mb-1">Finding:</p>
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
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
        <Nexus size={24} />
        <div className="flex-1">
          <span className="text-sm font-medium text-gray-800">
            {METHOD_LABELS[method]}
          </span>
          <span className="ml-2 text-xs text-gray-400">
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
                  ? 'bg-purple-50 text-gray-800 border border-purple-100'
                  : 'bg-blue-50 text-gray-800 border border-blue-100'
              }`}
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
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Nexus is analysing…
          </div>
        )}
      </div>

      {/* Root cause result */}
      {complete && rootCause && (
        <div className="mx-4 mb-2 rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-sm font-semibold text-green-800">Root Cause</span>
          </div>
          <p className="text-sm text-green-900">{rootCause}</p>

          {actions.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-xs font-semibold text-green-700 uppercase">Recommended Actions</p>
              {actions.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Badge
                    variant={a.priority === 'high' ? 'destructive' : a.priority === 'medium' ? 'warning' : 'secondary'}
                    className="text-[10px] flex-shrink-0 mt-0.5"
                  >
                    {a.priority}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] flex-shrink-0 mt-0.5">{a.type}</Badge>
                  <span className="text-gray-700">{a.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {/* Input */}
      {!complete && (
        <form onSubmit={handleSubmit} className="flex gap-2 border-t border-gray-200 p-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Answer Nexus's question…"
            disabled={loading}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 disabled:opacity-50"
          />
          <Button type="submit" disabled={loading || !input.trim()} size="sm">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      )}
    </div>
  );
}
