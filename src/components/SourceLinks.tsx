import { ExternalLink, BookMarked } from 'lucide-react';
import { buildSourceLinks } from '@/lib/sourceLinker';

/** Botões de busca em fontes legais/abertas para um tópico (SourceLinker). */
export function SourceLinks({ topic }: { topic: string }) {
  if (!topic.trim()) return null;
  const links = buildSourceLinks(topic);
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <BookMarked className="h-3.5 w-3.5" /> Buscar "{topic}" em:
      </p>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <a
            key={l.name}
            href={l.url}
            target="_blank"
            rel="noreferrer"
            title={l.hint}
            className={`chip cursor-pointer hover:border-brand ${l.openAccess ? 'border-ok/50 text-ok' : ''}`}
          >
            <ExternalLink className="h-3 w-3" /> {l.name}
          </a>
        ))}
      </div>
    </div>
  );
}
