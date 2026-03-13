'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { documentsApi } from '@/lib/api';

export default function NewDocumentPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function create() {
      try {
        const res = await documentsApi.create({
          title: 'Untitled Document',
          docType: 'procedure',
          standards: [],
        });
        if (cancelled) return;
        const doc = res.data as { id?: string; document?: { id: string } };
        const id = doc.id ?? doc.document?.id;
        if (id) {
          router.replace(`/document-studio/${id}`);
        } else {
          setError('Failed to create document — no ID returned.');
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to create document:', err);
        setError('Failed to create document. Please try again.');
      }
    }

    create();
    return () => { cancelled = true; };
  }, [router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>
        <button
          onClick={() => router.push('/document-studio')}
          className="text-sm underline"
          style={{ color: 'var(--content-text-muted)' }}
        >
          Back to Documents
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[50vh] gap-3">
      <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#6366F1' }} />
      <span className="text-sm" style={{ color: 'var(--content-text-muted)' }}>
        Creating new document...
      </span>
    </div>
  );
}
