import { useState } from 'react';
import { Split, Sparkles } from 'lucide-react';
import { useAiStream } from '@/hooks/useAiStream';
import { usePatientAiContext } from '@/hooks/usePatientAiContext';
import { AiOutput } from '@/components/AiOutput';
import { Disclaimer } from '@/components/ui';
import type { Patient } from '@/lib/types';

/** Diagnóstico diferencial em 3 camadas (seção 7.5), via agente Diferencial. */
export function DiferencialTab({ patient }: { patient: Patient }) {
  const ai = useAiStream();
  const { context } = usePatientAiContext(patient);
  const ativos = patient.problemList.filter((p) => p.status === 'ativo');
  const [problem, setProblem] = useState<string>(ativos[0]?.title ?? '');

  async function gerar() {
    const alvo = problem.trim() || ativos[0]?.title || 'problema principal';
    await ai.run({
      agent: 'diferencial',
      systemExtra: context(),
      messages: [
        {
          role: 'user',
          content: `Estruture o diagnóstico diferencial para o problema: "${alvo}". Use as 3 camadas (mais provável / não posso perder / plausível), com raciocínio bayesiano, como diferenciar e como diagnosticar cada hipótese, citando fontes. Seja consciente dos recursos do SUS.`,
        },
      ],
    });
  }

  return (
    <div className="space-y-3">
      <Disclaimer text="Apoio ao raciocínio. Hipóteses e critérios não substituem a avaliação clínica nem a preceptoria." />

      <div className="card space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <Split className="h-4 w-4 text-brand" /> Diagnóstico diferencial
        </div>

        {ativos.length > 0 ? (
          <div>
            <label className="label">Problema a analisar</label>
            <select className="input" value={problem} onChange={(e) => setProblem(e.target.value)}>
              {ativos.map((p) => (
                <option key={p.id} value={p.title}>{p.title}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="label">Problema a analisar</label>
            <input
              className="input"
              placeholder="Ex.: dispneia + hipoxemia"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted">
              Dica: organize a anamnese na Visão Geral para extrair a lista de problemas.
            </p>
          </div>
        )}

        <button className="btn-primary" disabled={ai.loading || !problem.trim()} onClick={gerar}>
          <Sparkles className="h-4 w-4" /> {ai.loading ? 'Gerando…' : 'Gerar diferencial'}
        </button>

        <AiOutput text={ai.text} loading={ai.loading} error={ai.error} citations={ai.citations} />
      </div>
    </div>
  );
}
