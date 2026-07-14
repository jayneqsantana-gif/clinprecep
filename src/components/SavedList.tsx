import { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2, ExternalLink } from 'lucide-react';
import { Markdown } from '@/components/Markdown';
import { CopyButton } from '@/components/ui';
import { deleteChatMessage } from '@/lib/remoteRepo';
import { fmtBR } from '@/lib/dates';
import type { ChatMessage } from '@/lib/types';

/** Lista genérica de itens gerados e salvos (diferencial, atualizações, lab, etc.). */
export function SavedList({
  items,
  title,
  onDeleted,
}: {
  items: ChatMessage[];
  title: string;
  onDeleted: () => void;
}) {
  if (!items.length) return null;
  return (
    <div className="space-y-2">
      <h2 className="font-semibold">{title}</h2>
      {items.map((it) => (
        <SavedItem key={it.id} item={it} onDeleted={onDeleted} />
      ))}
    </div>
  );
}

function SavedItem({ item, onDeleted }: { item: ChatMessage; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const label = item.topic || fmtBR(item.createdAt.slice(0, 10));
  return (
    <div className="card">
      <div className="flex items-center gap-2">
        <button className="flex flex-1 items-center gap-2 text-left" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-medium">{label}</span>
          <span className="chip text-[10px]">{fmtBR(item.createdAt.slice(0, 10))}</span>
        </button>
        <CopyButton text={item.content} />
        <button
          className="btn-ghost px-2 py-1 text-danger"
          onClick={async () => {
            await deleteChatMessage(item.id);
            onDeleted();
          }}
          aria-label="Excluir"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <Markdown>{item.content}</Markdown>
          {item.citations?.length > 0 && (
            <div className="border-t border-border pt-2">
              <p className="mb-1 text-xs font-semibold text-muted">Fontes</p>
              <ul className="space-y-1">
                {item.citations.map((c, i) => (
                  <li key={i}>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> {c.sourceName}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
