import { Brain, Stethoscope, HelpCircle } from 'lucide-react';
import { Markdown } from '@/components/Markdown';
import { CopyButton } from '@/components/ui';
import { splitAnalysisBlocks } from '@/lib/context';

/**
 * Renderiza a análise clínica do caso em 3 caixas: BLOCO 2 — Raciocínio clínico,
 * BLOCO 3 — Sugestão de conduta, BLOCO 4 — O que falta / perguntas.
 * Usado na Visão Geral (a partir da anamnese) e na Evolução (a partir da análise do dia).
 */
export function CaseAnalysisBlocks({ analysis }: { analysis: string }) {
  if (!analysis.trim()) return null;
  const { raciocinio, conduta, oQueFalta } = splitAnalysisBlocks(analysis);

  return (
    <div className="space-y-3">
      {raciocinio && (
        <section className="card space-y-2 border-brand/30">
          <h2 className="flex items-center gap-2 font-semibold text-brand">
            <Brain className="h-4 w-4" /> BLOCO 2 — Raciocínio clínico
          </h2>
          <Markdown>{raciocinio}</Markdown>
          <CopyButton text={raciocinio} />
        </section>
      )}
      {conduta && (
        <section className="card space-y-2 border-brand/30">
          <h2 className="flex items-center gap-2 font-semibold text-brand">
            <Stethoscope className="h-4 w-4" /> BLOCO 3 — Sugestão de conduta
          </h2>
          <Markdown>{conduta}</Markdown>
          <CopyButton text={conduta} />
        </section>
      )}
      {oQueFalta && (
        <section className="card space-y-2 border-brand/30">
          <h2 className="flex items-center gap-2 font-semibold text-brand">
            <HelpCircle className="h-4 w-4" /> BLOCO 4 — O que falta / perguntas
          </h2>
          <Markdown>{oQueFalta}</Markdown>
          <CopyButton text={oQueFalta} />
        </section>
      )}
    </div>
  );
}
