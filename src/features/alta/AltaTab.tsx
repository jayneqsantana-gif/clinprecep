import { useEffect, useState } from 'react';
import { LogOut, Sparkles, Printer, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { useSession } from '@/store/session';
import { useAiStream } from '@/hooks/useAiStream';
import { useAttachments } from '@/hooks/useAttachments';
import { AiOutput } from '@/components/AiOutput';
import { AttachButton, AttachmentList, AttachmentNotice } from '@/components/Attachments';
import { Markdown } from '@/components/Markdown';
import { CopyButton, Disclaimer } from '@/components/ui';
import {
  getAnamnesis,
  listEvolutions,
  listChatMessages,
  saveChatMessage,
  deleteChatMessage,
} from '@/lib/remoteRepo';
import { buildPatientContext } from '@/lib/context';
import { imagesFromPaste, type ContentBlock } from '@/lib/attachments';
import { printA4, simpleMarkdownToHtml } from '@/lib/print';
import { todayISO, fmtBR, diaInternacao } from '@/lib/dates';
import { SETTING_LABEL, type Patient, type ChatMessage, type Anamnesis, type Evolution } from '@/lib/types';

/** Carta de alta hospitalar: reúne admissão + histórico do internamento + dia da alta. */
export function AltaTab({ patient }: { patient: Patient }) {
  const key = useSession((s) => s.key);
  const ai = useAiStream();
  const att = useAttachments();
  const [anamnesis, setAnamnesis] = useState<Anamnesis | null>(null);
  const [evos, setEvos] = useState<Evolution[]>([]);
  const [ready, setReady] = useState(false);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState<ChatMessage[]>([]);

  async function refresh() {
    if (!key) return;
    const rows = await listChatMessages(key, patient.id, 'alta');
    setSaved(rows.reverse());
  }

  useEffect(() => {
    if (!key) return;
    void (async () => {
      const [a, e] = await Promise.all([getAnamnesis(key, patient.id), listEvolutions(key, patient.id)]);
      setAnamnesis(a);
      setEvos(e);
      await refresh();
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, patient.id]);

  /** Contexto rico: admissão + TODAS as evoluções (histórico do internamento). */
  function context(): string {
    const base = buildPatientContext(patient, anamnesis, null);
    // Evoluções em ordem cronológica (a lista vem desc → invertemos).
    const historico = [...evos]
      .reverse()
      .map((ev) => {
        const out = ev.structuredOutput as { text?: string } | undefined;
        return `--- Evolução ${fmtBR(ev.date)} ---\n${(ev.cleanVersion || out?.text || '').slice(0, 3000)}`;
      })
      .join('\n\n');
    return base + (historico ? `\n\nHISTÓRICO DE EVOLUÇÕES (internamento):\n${historico}` : '');
  }

  async function gerar() {
    if (!key) return;
    const texto =
      `Cenário: ${SETTING_LABEL[patient.setting]}. Gere a CARTA DE ALTA HOSPITALAR (alta em ${fmtBR(todayISO())}).` +
      (notes.trim() ? `\n\nDia da alta / observações:\n${notes}` : '');
    const content: string | ContentBlock[] = att.items.length
      ? [{ type: 'text', text: texto }, ...att.items.map((a) => a.block)]
      : texto;
    const result = await ai.run({
      agent: 'alta',
      systemExtra: context(),
      messages: [{ role: 'user', content }],
    });
    if (result && key) {
      await saveChatMessage(key, {
        patientId: patient.id,
        role: 'assistant',
        content: result,
        channel: 'alta',
        topic: fmtBR(todayISO()),
      });
      await refresh();
    }
    att.clear();
  }

  const di = diaInternacao(patient.admissionDate);

  function imprimir(text: string, data: string) {
    const header = `<h1>Alta hospitalar — ${patient.label}</h1><div class="meta">${
      patient.age ?? '—'
    } anos · ${SETTING_LABEL[patient.setting]}${di != null ? ` · D.I. ${di}` : ''} · Alta ${data}</div>`;
    printA4(`Alta — ${patient.label}`, header + simpleMarkdownToHtml(text));
  }

  return (
    <div className="space-y-3">
      <Disclaimer text="Sugestão de alta para conferência. A decisão e a responsabilidade são do médico assistente." />

      <div className="card space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <LogOut className="h-4 w-4 text-brand" /> Alta hospitalar
        </div>
        <p className="text-sm text-muted">
          Reúne a admissão, o histórico do internamento (condutas e medidas instituídas, a partir das evoluções) e o
          dia da alta. Anexe os exames do dia da alta, se houver.
        </p>
        <textarea
          className="input min-h-[90px] text-sm"
          placeholder="Opcional: como está o paciente no dia da alta, exame físico de alta, prescrição de alta, orientações…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onPaste={(e) => {
            const imgs = imagesFromPaste(e.nativeEvent);
            if (imgs.length) void att.add(imgs);
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <AttachButton onFiles={(f) => void att.add(f)} label="+ exames do dia" busy={att.busy} />
          {att.error && <span className="text-xs text-danger">{att.error}</span>}
        </div>
        <AttachmentList items={att.items} onRemove={att.remove} />
        {att.items.length > 0 && <AttachmentNotice />}
        <button className="btn-primary" disabled={!ready || ai.loading || att.busy} onClick={gerar}>
          <Sparkles className="h-4 w-4" /> {ai.loading ? 'Gerando…' : ready ? 'Gerar alta hospitalar' : 'Carregando…'}
        </button>

        {ai.loading || ai.error ? (
          <AiOutput text={ai.text} loading={ai.loading} error={ai.error} />
        ) : (
          ai.text && (
            <div className="space-y-2">
              <div className="rounded-lg border border-border bg-surface-2 p-3">
                <Markdown>{ai.text}</Markdown>
              </div>
              <div className="flex gap-2">
                <CopyButton text={ai.text} label="Copiar alta" />
                <button className="btn-ghost border border-border" onClick={() => imprimir(ai.text, fmtBR(todayISO()))}>
                  <Printer className="h-4 w-4" /> Imprimir / PDF (A4)
                </button>
              </div>
            </div>
          )
        )}
      </div>

      {saved.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold">Altas salvas</h2>
          {saved.map((r) => (
            <SavedAlta key={r.id} alta={r} onPrint={imprimir} onDeleted={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function SavedAlta({
  alta,
  onPrint,
  onDeleted,
}: {
  alta: ChatMessage;
  onPrint: (text: string, data: string) => void;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const data = alta.topic || fmtBR(alta.createdAt.slice(0, 10));
  return (
    <div className="card">
      <div className="flex items-center gap-2">
        <button className="flex flex-1 items-center gap-2 text-left" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-medium">Alta</span>
          <span className="chip text-[10px]">{data}</span>
        </button>
        <CopyButton text={alta.content} />
        <button className="btn-ghost px-2 py-1" onClick={() => onPrint(alta.content, data)} aria-label="Imprimir">
          <Printer className="h-4 w-4" />
        </button>
        <button
          className="btn-ghost px-2 py-1 text-danger"
          onClick={async () => {
            await deleteChatMessage(alta.id);
            onDeleted();
          }}
          aria-label="Excluir"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div className="mt-3 border-t border-border pt-3">
          <Markdown>{alta.content}</Markdown>
        </div>
      )}
    </div>
  );
}
