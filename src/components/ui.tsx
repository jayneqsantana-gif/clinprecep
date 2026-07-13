import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, Copy, X } from 'lucide-react';

/** Disclaimer persistente (seções 10.5, 7.8, 7.5). */
export function Disclaimer({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm text-text">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
      <span>{text}</span>
    </div>
  );
}

/** Botão copiar onipresente (seção 11). */
export function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1500);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <button
      className="btn-ghost text-xs"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
      }}
    >
      {done ? <Check className="h-4 w-4 text-ok" /> : <Copy className="h-4 w-4" />}
      {done ? 'Copiado' : label}
    </button>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-10 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <div>
        <p className="font-semibold">{title}</p>
        {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-surface shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="btn-ghost px-2 py-2" onClick={onClose} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

/** Placeholder de aba ainda não construída (fases seguintes). */
export function ComingSoon({ phase, children }: { phase: string; children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border border-dashed border-border p-6 text-sm text-muted">
      <p className="font-semibold text-text">{children}</p>
      <p>Será construído na {phase}.</p>
    </div>
  );
}
