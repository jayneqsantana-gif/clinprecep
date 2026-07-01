import { useState } from 'react';
import { BookOpen, Sparkles } from 'lucide-react';
import { useAiStream } from '@/hooks/useAiStream';
import { usePatientAiContext } from '@/hooks/usePatientAiContext';
import { AiOutput } from '@/components/AiOutput';
import { SourceLinks } from '@/components/SourceLinks';
import type { Patient } from '@/lib/types';

/** Revisão da diretriz vigente por problema (seção 7.6), agente Diretrizes + web search. */
export function DiretrizesTab({ patient }: { patient: Patient }) {
  const ai = useAiStream();
  const { context } = usePatientAiContext(patient);
  const ativos = patient.problemList.filter((p) => p.status === 'ativo');
  const [problem, setProblem] = useState(ativos[0]?.title ?? '');

  async function gerar() {
    const alvo = problem.trim();
    if (!alvo) return;
    await ai.run({
      agent: 'diretrizes',
      systemExtra: context(),
      messages: [
        {
          role: 'user',
          content: `Para o problema "${alvo}": identifique a diretriz oficial vigente (sociedade e ano), sintetize e parafraseie os pontos-chave de conduta e forneça o link oficial. Confirme a vigência via busca.`,
        },
      ],
    });
  }

  return (
    <div className="space-y-3">
      <div className="card space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <BookOpen className="h-4 w-4 text-brand" /> Diretrizes por problema
        </div>

        {ativos.length > 0 ? (
          <div>
            <label className="label">Problema</label>
            <select className="input" value={problem} onChange={(e) => setProblem(e.target.value)}>
              {ativos.map((p) => (
                <option key={p.id} value={p.title}>{p.title}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="label">Tópico / problema</label>
            <input
              className="input"
              placeholder="Ex.: insuficiência cardíaca com FE reduzida"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
            />
          </div>
        )}

        <button className="btn-primary" disabled={ai.loading || !problem.trim()} onClick={gerar}>
          <Sparkles className="h-4 w-4" /> {ai.loading ? 'Buscando…' : 'Gerar revisão da diretriz'}
        </button>

        <AiOutput text={ai.text} loading={ai.loading} error={ai.error} citations={ai.citations} />

        {problem.trim() && <SourceLinks topic={problem} />}
      </div>
    </div>
  );
}
