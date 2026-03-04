'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, AlertTriangle, CheckCircle2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Audie } from '@/components/sentinels/audie';
import { aiApi } from '@/lib/api';
import { FINDING_SEVERITY_LABELS, FINDING_SEVERITY_VARIANT } from '@/lib/types';
import type { FindingSeverity } from '@/lib/types';

interface Props {
  clause: string;
  standard: string;
  auditContext: string;
  onFindingDetected?: (finding: {
    clauseRef: string;
    standard: string;
    severity: FindingSeverity;
    description: string;
  }) => void;
}

interface Message {
  role: 'auditor' | 'auditee';
  content: string;
}

interface ExamineResponse {
  response: string;
  findingType: FindingSeverity | null;
  clauseRef: string;
  evidenceRequested: string[];
}

export function AiExaminePanel({ clause, standard, auditContext, onFindingDetected }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finding, setFinding] = useState<ExamineResponse | null>(null);
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
      ? [...messages, { role: 'auditee' as const, content: userMessage }]
      : messages;

    if (userMessage) {
      setMessages(history);
      setInput('');
    }

    try {
      const res = await aiApi.auditExamine({
        clause,
        standard,
        auditContext,
        conversationHistory: history.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });
      const data = res.data as ExamineResponse;

      setMessages((prev) => [
        ...prev,
        { role: 'auditor', content: data.response },
      ]);

      if (data.findingType) {
        setFinding(data);
        if (onFindingDetected) {
          onFindingDetected({
            clauseRef: data.clauseRef || clause,
            standard,
            severity: data.findingType,
            description: data.response,
          });
        }
      }
    } catch {
      setError('Audie could not respond. Please try again.');
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
        <Audie size={48} />
        <div className="text-center">
          <p className="font-semibold text-gray-800">
            Examine {standard.replace('_', ' ').toUpperCase()} Clause {clause}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Audie will conduct an evidence-based clause examination per ISO 19011:6.4
          </p>
        </div>
        <Button onClick={handleStart}>
          <MessageSquare className="mr-1.5 h-4 w-4" />
          Start Examination
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
        <Audie size={24} />
        <div className="flex-1">
          <span className="text-sm font-medium text-gray-800">
            Clause {clause} Examination
          </span>
          <span className="ml-2 text-xs text-gray-400">
            {standard.replace('_', ' ').toUpperCase()}
          </span>
        </div>
        {finding && (
          <Badge variant={FINDING_SEVERITY_VARIANT[finding.findingType!]}>
            {FINDING_SEVERITY_LABELS[finding.findingType!]}
          </Badge>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 max-h-80 min-h-[200px]">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'auditor' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'auditor'
                  ? 'bg-rose-50 text-gray-800 border border-rose-100'
                  : 'bg-blue-50 text-gray-800 border border-blue-100'
              }`}
            >
              {msg.role === 'auditor' && (
                <span className="block text-[10px] font-semibold text-rose-400 mb-0.5">Audie</span>
              )}
              {msg.role === 'auditee' && (
                <span className="block text-[10px] font-semibold text-blue-400 mb-0.5">You</span>
              )}
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Audie is thinking…
          </div>
        )}
      </div>

      {error && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {/* Finding detected banner */}
      {finding && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Finding detected: {FINDING_SEVERITY_LABELS[finding.findingType!]}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-gray-200 p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Provide evidence or respond to Audie…"
          disabled={loading}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100 disabled:opacity-50"
        />
        <Button type="submit" disabled={loading || !input.trim()} size="sm">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
