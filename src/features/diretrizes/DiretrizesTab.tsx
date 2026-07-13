import { useEffect, useState } from 'react';
import { BookOpen, Sparkles, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { useSession } from '@/store/session';
import { useAiStream } from '@/hooks/useAiStream';
import { usePatientAiContext } from '@/hooks/usePatientAiContext';
import { AiOutput } from '@/components/AiOutput';
import { SourceLinks } from '@/components/SourceLinks';
import { Markdown } from '@/components/Markdown';
import { CopyButton } from '@/components/ui';
import { ProblemTargetPicker } from '@/features/anamnese/ProblemTargetPicker';
import { listChatMessages, saveChatMessage, deleteChatMessage } from '@/lib/remoteRepo';
import { fmtBR } from '@/lib/dates';
import type { Patient, ChatMessage } from '@/lib/types';

/** Revisão da diretriz vigente por problema (seção 7.6), agente Diretrizes + web search.
 *  As revisões geradas ficam salvas (channel 'diretriz') para não sumirem. */
export function DiretrizesTab({ patient, initialTopic = '' }: { patient: Patient; initialTopic?: string }) {
  const key = useSession((s) => s.key);
  const ai = useAiStream();
  const { context } = usePatientAiContext(patient);
  const ativos = patient.problemList.filter((p) => p.status === 'ativo');
  const [problem, setProblem] = useState(initialTopic || ativos[0]?.title || '');
  const [saved, setSaved] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (initialTopic) setProblem(initialTopic);
  }, [initialTopic]);

  async function refresh() {
    if (!key) return;
    const rows = await listChatMessages(key, patient.id, 'diretriz');
    setSaved(rows.reverse()); // mais recentes primeiro
  }
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, patient.id]);

  async function gerar() {
    const alvo = problem.trim();
    if (!alvo) return;
    const result = await ai.run({
      agent: 'diretrizes',
      systemExtra: context(),
      messages: [
        {
          role: 'user',
          content: `Para o problema "${alvo}": identifique a diretriz oficial vigente (sociedade e ano), sintetize e parafraseie os pontos-chave de conduta e forneça o link oficial direto. Confirme a vigência via busca.`,
        },
      ],
    });
    if (result && key) {
      await saveChatMessage(key, {
        patientId: patient.id,
        role: 'assistant',
        content: result,
        citations: ai.citationsRef.current,
        channel: 'diretriz',
        topic: alvo,
      });
      await refresh();
    }
  }

  return (
    <div className="space-y-3">
      <div className="card space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <BookOpen className="h-4 w-4 text-brand" /> Diretrizes por problema
        </div>

        <ProblemTargetPicker problems={patient.problemList} value={problem} onChange={setProblem} />

        <button className="btn-primary" disabled={ai.loading || !problem.trim()} onClick={gerar}>
          <Sparkles className="h-4 w-4" />{' '}
          {ai.loading ? 'Buscando…' : ai.text ? 'Gerar novamente' : 'Gerar revisão da diretriz'}
        </button>

        <AiOutput text={ai.text} loading={ai.loading} error={ai.error} citations={ai.citations} />

        {problem.trim() && <SourceLinks topic={problem} />}
      </div>

      {saved.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold">Revisões salvas</h2>
          {saved.map((r) => (
            <SavedReview key={r.id} review={r} onDeleted={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function SavedReview({ review, onDeleted }: { review: ChatMessage; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card">
      <div className="flex items-center gap-2">
        <button className="flex flex-1 items-center gap-2 text-left" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-medium">{review.topic || 'Revisão'}</span>
          <span className="chip text-[10px]">{fmtBR(review.createdAt.slice(0, 10))}</span>
        </button>
        <CopyButton text={review.content} />
        <button
          className="btn-ghost px-2 py-1 text-danger"
          onClick={async () => {
            await deleteChatMessage(review.id);
            onDeleted();
          }}
          aria-label="Excluir"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <Markdown>{review.content}</Markdown>
          {(review.citations?.length ?? 0) > 0 && (
            <div className="border-t border-border pt-2">
              <p className="mb-1 text-xs font-semibold text-muted">Fontes</p>
              <ul className="space-y-1">
                {review.citations.map((c, i) => (
                  <li key={i}>
                    <a href={c.url} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">
                      {c.sourceName}
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
