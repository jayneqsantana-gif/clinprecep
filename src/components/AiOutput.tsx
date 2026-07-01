import { AlertTriangle, Loader2, ExternalLink } from 'lucide-react';
import { Markdown } from './Markdown';
import { CopyButton } from './ui';
import type { Citation } from '@/lib/ai';

/** Exibe a resposta de um agente: streaming, citações, copiar e erros. */
export function AiOutput({
  text,
  loading,
  error,
  citations,
  copyText,
}: {
  text: string;
  loading: boolean;
  error: string | null;
  citations?: Citation[];
  copyText?: string;
}) {
  if (error) {
    const semChave = /não configurada|not configured|503/i.test(error);
    return (
      <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
        <div>
          <p className="text-text">{error}</p>
          {semChave && (
            <p className="mt-1 text-muted">
              A IA ainda não está ligada — falta a chave da Anthropic no servidor. O restante do app
              (organizar manualmente, salvar) funciona normalmente.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!text && loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 p-4 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> A IA está pensando…
      </div>
    );
  }

  if (!text) return null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-3">
      <Markdown>{text}</Markdown>
      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <Loader2 className="h-3 w-3 animate-spin" /> gerando…
        </div>
      )}
      {citations && citations.length > 0 && (
        <div className="border-t border-border pt-2">
          <p className="mb-1 text-xs font-semibold text-muted">Fontes</p>
          <ul className="space-y-1">
            {citations.map((c, i) => (
              <li key={i} className="text-xs">
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-brand hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> {c.sourceName}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!loading && <CopyButton text={copyText ?? text} label="Copiar" />}
    </div>
  );
}
