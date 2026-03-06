'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, onOpenChange, title, children, className }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2',
            'rounded-2xl p-6 shadow-2xl focus:outline-none',
            className,
          )}
          style={{ background: 'var(--content-surface)', border: '1px solid var(--content-border)', color: 'var(--content-text)' }}
        >
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold" style={{ color: 'var(--content-text)' }}>
              {title}
            </Dialog.Title>
            <Dialog.Close className="rounded p-1 text-gray-500 transition-colors hover:text-gray-300">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
