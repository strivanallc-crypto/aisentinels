'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { documentsApi } from '@/lib/api';
import type { Document } from '@/lib/types';
import { TemplateSelectorModal } from '@/components/document-studio/template-selector-modal';
import { generateTiptapJson } from '@/components/document-studio/template-data';
import type { TemplateDefinition } from '@/components/document-studio/template-data';

export default function NewDocumentPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (template: TemplateDefinition | null) => {
    setCreating(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = template
        ? {
            title: template.title,
            docType: template.docType,
            standards: template.standards,
            bodyJsonb: generateTiptapJson(template),
          }
        : {
            title: 'Untitled Document',
            docType: 'procedure',
          };

      const res = await documentsApi.create(payload);
      const doc = res.data as Document;

      // Fallback: if template was selected but bodyJsonb wasn't persisted by the backend,
      // immediately PATCH bodyJsonb before redirect.
      if (template && (!doc.bodyJsonb || Object.keys(doc.bodyJsonb).length === 0)) {
        await documentsApi.update(doc.id, {
          bodyJsonb: generateTiptapJson(template),
        });
      }

      router.replace(`/document-studio/${doc.id}`);
    } catch {
      setCreating(false);
      setError('Failed to create document. Please try again.');
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (creating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#6366F1' }} />
        <p className="text-sm" style={{ color: 'var(--content-text-muted)' }}>
          Creating document...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
        <div
          className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#f87171',
          }}
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
        <button
          onClick={() => setError(null)}
          className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
          style={{ background: '#c2fa69', color: '#0a0f1a' }}
        >
          Try Again
        </button>
      </div>
    );
  }

  return <TemplateSelectorModal open onSelect={handleSelect} onCancel={handleCancel} />;
}
