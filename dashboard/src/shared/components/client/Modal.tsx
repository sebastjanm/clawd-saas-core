'use client';

import { useEffect, useRef } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="rounded-xl border border-[var(--border)] bg-[var(--dialog-bg)] p-0 text-[var(--foreground)]/90 backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="min-w-[400px]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
          <h3 className="text-sm font-semibold text-[var(--foreground)]/80">{title}</h3>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)]/60 transition-colors text-lg leading-none">
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </dialog>
  );
}
