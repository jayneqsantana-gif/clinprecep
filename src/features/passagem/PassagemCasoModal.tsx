import { useEffect, useState } from 'react';
import { ClipboardList, Sparkles, Printer } from 'lucide-react';
import { Modal, CopyButton } from '@/components/ui';
import { AiOutput } from '@/components/AiOutput';
import { useSession } from '@/store/session';
import { useAiStream } from '@/hooks/useAiStream';
import { getAnamnesis, listEvolutions, listTasks } from '@/lib/remoteRepo';
import { buildPatientContext } from '@/lib/context';
import { diaInternacao } from '@/lib/dates';
import { printA4, simpleMarkdownToHtml } from '@/lib/print';
import { SETTING_LABEL, type Patient } from '@/lib/types';

/** Passagem de caso rápida de UM paciente, para apresentar ao preceptor. */
export function PassagemCasoModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const key = useSession((s) => s.key);
  const ai = useAiStream();
  const [ready, setReady] = useState(false);
  const [ctx, setCtx] = useState('');

  useEffect(() => {
    if (!key) return;
    void (async () => {
      const [a, evos, tasks] = await Promise.all([
        getAnamnesis(key, patient.id),
        listEvolutions(key, patient.id),
        listTasks(key, patient.id),
      ]);
      const pend = tasks.filter((t) => !t.done).map((t) => `- ${t.description}`);
      const extra =
        buildPatientContext(patient, a, evos[0] ?? null) +
        (pend.length ? `\n\nPendências abertas:\n${pend.join('\n')}` : '') +
        `\nLeito: ${patient.bed ?? '[não informado]'} · Cenário: ${SETTING_LABEL[patient.setting]}`;
      setCtx(extra);
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, patient.id]);

  async function gerar() {
    await ai.run({
      agent: 'passagem',
      systemExtra: ctx,
      messages: [{ role: 'user', content: 'Gere a passagem de caso deste paciente para o preceptor.' }],
    });
  }

  const di = diaInternacao(patient.admissionDate);

  function imprimir() {
    const header = `<h1>Passagem de caso — ${patient.label}</h1><div class="meta">Leito ${
      patient.bed ?? '—'
    } · ${patient.age ?? '—'} anos · ${SETTING_LABEL[patient.setting]}${di != null ? ` · D.I. ${di}` : ''}</div>`;
    printA4(`Passagem de caso — ${patient.label}`, header + simpleMarkdownToHtml(ai.text));
  }

  return (
    <Modal title={`Passe o caso — ${patient.label}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm text-muted">
          <ClipboardList className="h-4 w-4 text-brand" /> Resumo denso do paciente para levar à visita.
        </p>
        <button className="btn-primary" disabled={!ready || ai.loading} onClick={gerar}>
          <Sparkles className="h-4 w-4" /> {ai.loading ? 'Gerando…' : ready ? 'Gerar passagem' : 'Carregando…'}
        </button>
        <AiOutput text={ai.text} loading={ai.loading} error={ai.error} />
        {ai.text && !ai.loading && (
          <div className="flex gap-2">
            <CopyButton text={ai.text} label="Copiar" />
            <button className="btn-ghost border border-border" onClick={imprimir}>
              <Printer className="h-4 w-4" /> Imprimir / PDF
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
