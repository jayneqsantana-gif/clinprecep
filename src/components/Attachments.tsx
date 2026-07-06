import { useRef } from 'react';
import { Paperclip, FileText, X, Loader2 } from 'lucide-react';
import type { Attachment } from '@/lib/attachments';

/** Botão de anexar foto/PDF. */
export function AttachButton({
  onFiles,
  accept = 'image/*,application/pdf',
  label = 'Anexar foto/PDF',
  busy,
}: {
  onFiles: (files: FileList | null) => void;
  accept?: string;
  label?: string;
  busy?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />} {label}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );
}

/** Prévias dos anexos, com remover. */
export function AttachmentList({ items, onRemove }: { items: Attachment[]; onRemove: (i: number) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((a, i) => (
        <div key={i} className="relative">
          {a.kind === 'image' ? (
            <img src={a.previewUrl} alt={a.name} className="h-16 w-16 rounded-lg border border-border object-cover" />
          ) : (
            <div className="flex h-16 w-16 flex-col items-center justify-center rounded-lg border border-border bg-surface-2 text-[10px] text-muted">
              <FileText className="h-5 w-5" /> PDF
            </div>
          )}
          <button
            className="absolute -right-1.5 -top-1.5 rounded-full bg-danger p-0.5 text-white"
            onClick={() => onRemove(i)}
            aria-label="Remover anexo"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Aviso de privacidade dos anexos. */
export function AttachmentNotice() {
  return (
    <p className="text-xs text-muted">
      A imagem/PDF é enviada à IA só para leitura e <strong className="text-text">não é armazenada</strong>. Evite
      incluir nome ou nº de prontuário — cubra se possível.
    </p>
  );
}
