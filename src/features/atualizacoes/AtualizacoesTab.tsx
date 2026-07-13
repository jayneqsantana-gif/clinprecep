import { Newspaper, Sparkles } from 'lucide-react';
import { useAiStream } from '@/hooks/useAiStream';
import { usePatientAiContext } from '@/hooks/usePatientAiContext';
import { AiOutput } from '@/components/AiOutput';
import type { Patient } from '@/lib/types';

/** Atualizações recentes das sociedades relevantes ao caso (seção 7.7), web search. */
export function AtualizacoesTab({ patient }: { patient: Patient }) {
  const ai = useAiStream();
  const { context } = usePatientAiContext(patient);
  const ativos = patient.problemList.filter((p) => p.status === 'ativo').map((p) => p.title);

  async function gerar() {
    await ai.run({
      agent: 'atualizacoes',
      systemExtra: context(),
      messages: [
        {
          role: 'user',
          content:
            'Busque atualizações/consensos recentes das sociedades relevantes aos problemas deste paciente' +
            (ativos.length ? ` (${ativos.join(', ')})` : '') +
            '. Traga cada item com data e link, distinguindo novidade de conteúdo consolidado.',
        },
      ],
    });
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
    </div>
  );
}
