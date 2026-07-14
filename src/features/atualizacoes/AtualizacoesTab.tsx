import { useEffect, useState } from 'react';
import { Newspaper, Sparkles } from 'lucide-react';
import { useSession } from '@/store/session';
import { useAiStream } from '@/hooks/useAiStream';
import { usePatientAiContext } from '@/hooks/usePatientAiContext';
import { AiOutput } from '@/components/AiOutput';
import { SavedList } from '@/components/SavedList';
import { listChatMessages, saveChatMessage } from '@/lib/remoteRepo';
import type { Patient, ChatMessage } from '@/lib/types';

/** Atualizações recentes das sociedades (seção 7.7), web search. As buscas ficam salvas. */
export function AtualizacoesTab({ patient }: { patient: Patient }) {
  const key = useSession((s) => s.key);
  const ai = useAiStream();
  const { context } = usePatientAiContext(patient);
  const ativos = patient.problemList.filter((p) => p.status === 'ativo').map((p) => p.title);
  const [saved, setSaved] = useState<ChatMessage[]>([]);

  async function refresh() {
    if (!key) return;
    setSaved((await listChatMessages(key, patient.id, 'atualizacoes')).reverse());
  }
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, patient.id]);

  async function gerar() {
    const result = await ai.run({
      agent: 'atualizacoes',
      systemExtra: context(),
      messages: [
        {
          role: 'user',
          content:
            'Busque atualizações/consensos recentes das sociedades relevantes aos problemas deste paciente' +
            (ativos.length ? ` (${ativos.join(', ')})` : '') +
            '. Traga cada item com data e link direto, distinguindo novidade de conteúdo consolidado.',
        },
      ],
    });
    if (result && key) {
      await saveChatMessage(key, {
        patientId: patient.id,
        role: 'assistant',
        content: result,
        citations: ai.citationsRef.current,
        channel: 'atualizacoes',
        topic: ativos[0] ? `Atualizações — ${ativos[0]}` : 'Atualizações',
      });
      await refresh();
    }
  }

  return (
    <div className="space-y-3">
      <div className="card space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <Newspaper className="h-4 w-4 text-brand" /> Atualizações das sociedades
        </div>
        <p className="text-sm text-muted">
          {ativos.length
            ? `Baseado nos problemas ativos: ${ativos.join(', ')}.`
            : 'Organize a anamnese para extrair os problemas e direcionar a busca.'}
        </p>
        <button className="btn-primary" disabled={ai.loading} onClick={gerar}>
          <Sparkles className="h-4 w-4" />{' '}
          {ai.loading ? 'Buscando…' : ai.text ? 'Buscar novamente' : 'Buscar atualizações'}
        </button>
        <AiOutput text={ai.text} loading={ai.loading} error={ai.error} citations={ai.citations} />
      </div>

      <SavedList items={saved} title="Atualizações salvas" onDeleted={refresh} />
    </div>
  );
}
