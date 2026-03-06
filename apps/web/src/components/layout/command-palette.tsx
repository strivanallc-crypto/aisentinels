'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { NAV_ITEMS } from './nav-items';

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelect = (href: string) => {
    router.push(href);
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-[18%] z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-xl shadow-2xl"
          style={{ background: 'var(--content-surface)', border: '1px solid var(--content-border)' }}
        >
          <Dialog.Title className="sr-only">Command Palette</Dialog.Title>
          <Command>
            {/* Search input */}
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: '1px solid var(--content-border)' }}
            >
              <Search className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--content-text-dim)' }} />
              <Command.Input
                placeholder="Go to page…"
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: 'var(--content-text)' }}
              />
              <kbd
                className="hidden sm:flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-mono"
                style={{ borderColor: 'var(--content-border)', color: 'var(--content-text-dim)' }}
              >
                ESC
              </kbd>
            </div>

            {/* Results */}
            <Command.List className="max-h-72 overflow-y-auto p-2">
              <Command.Empty
                className="py-8 text-center text-sm"
                style={{ color: 'var(--content-text-dim)' }}
              >
                No results found.
              </Command.Empty>

              <Command.Group>
                <div
                  className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--content-text-dim)' }}
                >
                  Navigation
                </div>
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                  <Command.Item
                    key={href}
                    value={label}
                    onSelect={() => handleSelect(href)}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
                    style={{ color: 'var(--content-text)' }}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--content-text-dim)' }} />
                    {label}
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>

            {/* Footer hint */}
            <div
              className="flex items-center gap-4 px-4 py-2.5"
              style={{ borderTop: '1px solid var(--content-border)', background: 'var(--content-surface)' }}
            >
              <span className="text-[11px]" style={{ color: 'var(--content-text-dim)' }}>
                <kbd className="font-mono">↑↓</kbd> navigate &nbsp;·&nbsp; <kbd className="font-mono">↵</kbd> select &nbsp;·&nbsp; <kbd className="font-mono">esc</kbd> close
              </span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
