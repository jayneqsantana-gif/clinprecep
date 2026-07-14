import { useEffect, useState } from 'react';
import { Split, Sparkles } from 'lucide-react';
import { useSession } from '@/store/session';
import { useAiStream } from '@/hooks/useAiStream';
import { usePatientAiContext } from '@/hooks/usePatientAiContext';
import { AiOutput } from '@/components/AiOutput';
import { Disclaimer } from '@/components/ui';
import { SavedList } from '@/components/SavedList';
import { ProblemTargetPicker } from '@/features/anamnese/ProblemTargetPicker';
import { listChatMessages, saveChatMessage } from '@/lib/remoteRepo';
import type { Patient, ChatMessage } from '@/lib/types';

/** Diagnóstico diferencial por síndrome/achado (seção 7.5). Os DDs gerados ficam salvos. */
export function DiferencialTab({ patient }: { patient: Patient }) {
  const key = useSession((s) => s.key);
  const ai = useAiStream();
  const { context } = usePatientAiContext(patient);
  const ativos = patient.problemList.filter((p) => p.status === 'ativo');
  const [problem, setProblem] = useState<string>(ativos[0]?.title ?? '');
  const [saved, setSaved] = useState<ChatMessage[]>([]);

  async function refresh() {
    if (!key) return;
    setSaved((await listChatMessages(key, patient.id, 'diferencial')).reverse());
  }
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, patient.id]);

  async function gerar() {
    const alvo = problem.trim() || ativos[0]?.title || 'problema principal';
    const result = await ai.run({
      agent: 'diferencial',
      systemExtra: context(),
      messages: [
        {
          role: 'user',
          content: `Faça o diagnóstico diferencial NÃO do rótulo "${alvo}", mas da GRANDE SÍNDROME / do sintoma / da alteração de imagem ou laboratório que levou a ele (ex.: "SCA com supra de ST" → DD de "dor torácica com supra de ST"; "pielonefrite à direita" → DD de "dor lombar direita"). Use as 3 camadas (mais provável / não posso perder / plausível), com raciocínio bayesiano, como diferenciar e como diagnosticar cada hipótese, citando fontes. Consciente dos recursos do SUS.`,
        },
      ],
    });
    if (result && key) {
      await saveChatMessage(key, {
        patientId: patient.id,
        role: 'assistant',
        content: result,
        citations: ai.citationsRef.current,
        channel: 'diferencial',
        topic: alvo,
      });
      await refresh();
    }
  }

  return (
    <div className="space-y-3">
      <Disclaimer text="Apoio ao raciocínio. Hipóteses e critérios não substituem a avaliação clínica nem a preceptoria." />

      <div className="card space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <Split className="h-4 w-4 text-brand" /> Diagnóstico diferencial
        </div>

        <ProblemTargetPicker
          problems={patient.problemList}
          value={problem}
          onChange={setProblem}
          label="Problema / síndrome a analisar"
          placeholder="Ex.: dor torácica com supra de ST"
        />

        <button className="btn-primary" disabled={ai.loading || !problem.trim()} onClick={gerar}>
          <Sparkles className="h-4 w-4" />{' '}
          {ai.loading ? 'Gerando…' : ai.text ? 'Gerar novamente' : 'Gerar diferencial'}
        </button>

        <AiOutput text={ai.text} loading={ai.loading} error={ai.error} citations={ai.citations} />
      </div>

      <SavedList items={saved} title="Diferenciais salvos" onDeleted={refresh} />
    </div>
  );
}
