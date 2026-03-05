'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  title: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (opts: { title: string; variant?: ToastVariant }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(({ title, variant = 'info' }: { title: string; variant?: ToastVariant }) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, title, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container — fixed bottom-right */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-2.5 rounded-lg border px-4 py-3 shadow-lg animate-in slide-in-from-right-5 fade-in duration-200"
            style={{
              background: t.variant === 'success' ? '#052e16'
                : t.variant === 'error' ? '#450a0a'
                : '#0c1a3d',
              borderColor: t.variant === 'success' ? 'rgba(34,197,94,0.3)'
                : t.variant === 'error' ? 'rgba(239,68,68,0.3)'
                : 'rgba(99,102,241,0.3)',
              color: '#f9fafb',
            }}
          >
            {t.variant === 'success' && <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-400" />}
            {t.variant === 'error' && <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-400" />}
            {t.variant === 'info' && <Info className="h-4 w-4 flex-shrink-0 text-indigo-400" />}
            <span className="text-sm font-medium">{t.title}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="ml-2 flex-shrink-0 rounded p-0.5 hover:bg-white/10 transition-colors"
            >
              <X className="h-3.5 w-3.5 text-gray-400" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
