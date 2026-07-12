import { useEffect, useState } from 'react';
import { Pill, Sparkles, AlertOctagon, ChevronDown, ChevronRight, Trash2, ClipboardCheck } from 'lucide-react';
import { useSession } from '@/store/session';
import { useAiStream } from '@/hooks/useAiStream';
import { useAttachments } from '@/hooks/useAttachments';
import { usePatientAiContext } from '@/hooks/usePatientAiContext';
import { AiOutput } from '@/components/AiOutput';
import { AttachButton, AttachmentList, AttachmentNotice } from '@/components/Attachments';
import { Disclaimer, CopyButton } from '@/components/ui';
import { Markdown } from '@/components/Markdown';
import { imagesFromPaste, type ContentBlock } from '@/lib/attachments';
import { listChatMessages, saveChatMessage, deleteChatMessage } from '@/lib/remoteRepo';
import { fmtBR } from '@/lib/dates';
import type { Patient, ChatMessage } from '@/lib/types';

/** Separa a saída em prescrição transcrita (A) e crítica (B), pelo marcador ===CRITICA===. */
function splitPrescricao(text: string): { prescricao: string; critica: string } {
  const idx = text.search(/={2,}\s*CR[ÍI]TICA\s*={2,}/i);
  if (idx === -1) return { prescricao: text.trim(), critica: '' };
  return {
    prescricao: text.slice(0, idx).trim(),
    critica: text.slice(idx).replace(/={2,}\s*CR[ÍI]TICA\s*={2,}/i, '').trim(),
  };
}

/** Prescrição: transcreve o print/arquivo, salva, e critica (rede de segurança). */
export function PrescricaoTab({ patient }: { patient: Patient }) {
  const key = useSession((s) => s.key);
  const ai = useAiStream();
  const att = useAttachments();
  const { context } = usePatientAiContext(patient);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState<ChatMessage[]>([]);

  async function refresh() {
    if (!key) return;
    const rows = await listChatMessages(key, patient.id, 'prescricao');
    setSaved(rows.reverse());
  }
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, patient.id]);

  async function gerar() {
    const temPrescricao = notes.trim() || att.items.length > 0;
    const instrucao = temPrescricao
      ? 'Transcreva e organize a prescrição enviada (texto/print), depois critique-a (o que falta, ajustes, rede de segurança).'
      : 'Monte uma sugestão de prescrição do zero, percorrendo a rede de segurança e fechando com "⚠️ Não pode passar".';
    const texto =
      instrucao + (notes.trim() ? `\n\nPrescrição atual / observações:\n${notes}` : '');
    const content: string | ContentBlock[] = att.items.length
      ? [{ type: 'text', text: texto }, ...att.items.map((a) => a.block)]
      : texto;
    const result = await ai.run({
      agent: 'prescricao',
      systemExtra: context(),
      messages: [{ role: 'user', content }],
    });
    // Salva a prescrição transcrita automaticamente (se veio uma prescrição).
    if (result && key && (notes.trim() || att.items.length > 0)) {
      const { prescricao } = splitPrescricao(result);
      if (prescricao) {
        await saveChatMessage(key, {
          patientId: patient.id,
          role: 'assistant',
          content: prescricao,
          channel: 'prescricao',
          topic: fmtBR(new Date().toISOString().slice(0, 10)),
        });
        await refresh();
      }
    }
    att.clear();
  }

  const parsed = ai.text ? splitPrescricao(ai.text) : { prescricao: '', critica: '' };

  return (
    <div className="space-y-3">
      <Disclaimer text="Sugestão para conferência. A decisão e a responsabilidade da prescrição são do médico assistente." />

      {patient.allergies.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
          <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <span>
            <strong className="text-text">Alergias registradas:</strong> {patient.allergies.join(', ')}
          </span>
        </div>
      )}

      <div className="card space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <Pill className="h-4 w-4 text-brand" /> Prescrição
        </div>
        <textarea
          className="input min-h-[90px] text-sm"
          placeholder="Cole a prescrição atual (ou anexe/cole o print). Deixe vazio para gerar do zero."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onPaste={(e) => {
            const imgs = imagesFromPaste(e.nativeEvent);
            if (imgs.length) void att.add(imgs);
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <AttachButton onFiles={(f) => void att.add(f)} busy={att.busy} />
          {att.error && <span className="text-xs text-danger">{att.error}</span>}
        </div>
        <AttachmentList items={att.items} onRemove={att.remove} />
        {att.items.length > 0 && <AttachmentNotice />}
        <button className="btn-primary" disabled={ai.loading || att.busy} onClick={gerar}>
          <Sparkles className="h-4 w-4" /> {ai.loading ? 'Gerando…' : 'Transcrever e criticar'}
        </button>

        {ai.loading || ai.error ? (
          <AiOutput text={ai.text} loading={ai.loading} error={ai.error} />
        ) : (
          ai.text && (
            <div className="space-y-3">
              {parsed.prescricao && (
                <div className="space-y-2 rounded-lg border border-border bg-surface-2 p-3">
                  <p className="text-xs font-semibold text-muted">Prescrição transcrita (salva)</p>
                  <Markdown>{parsed.prescricao}</Markdown>
                  <CopyButton text={parsed.prescricao} label="Copiar prescrição" />
                </div>
              )}
              {parsed.critica && (
                <div className="space-y-2 rounded-lg border border-warn/40 bg-warn/5 p-3">
                  <p className="flex items-center gap-2 text-xs font-semibold text-warn">
                    <ClipboardCheck className="h-4 w-4" /> Crítica / o que falta
                  </p>
                  <Markdown>{parsed.critica}</Markdown>
                  <CopyButton text={parsed.critica} />
                </div>
              )}
            </div>
          )
        )}
      </div>

      {saved.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold">Prescrições salvas</h2>
          {saved.map((r) => (
            <SavedPrescricao key={r.id} rx={r} onDeleted={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function SavedPrescricao({ rx, onDeleted }: { rx: ChatMessage; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card">
      <div className="flex items-center gap-2">
        <button className="flex flex-1 items-center gap-2 text-left" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-medium">Prescrição</span>
          <span className="chip text-[10px]">{rx.topic || fmtBR(rx.createdAt.slice(0, 10))}</span>
        </button>
        <CopyButton text={rx.content} />
        <button
          className="btn-ghost px-2 py-1 text-danger"
          onClick={async () => {
            await deleteChatMessage(rx.id);
            onDeleted();
          }}
          aria-label="Excluir"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div className="mt-3 border-t border-border pt-3">
          <Markdown>{rx.content}</Markdown>
        </div>
      )}
    </div>
  );
}
