import { useEffect, useState } from 'react';
import { FlaskConical, Wand2 } from 'lucide-react';
import { Modal } from '@/components/ui';
import { AiOutput } from '@/components/AiOutput';
import { SavedList } from '@/components/SavedList';
import { AttachButton, AttachmentList } from '@/components/Attachments';
import { useSession } from '@/store/session';
import { useAiStream } from '@/hooks/useAiStream';
import { useAttachments } from '@/hooks/useAttachments';
import { useDraft } from '@/hooks/useDraft';
import { imagesFromPaste, type ContentBlock } from '@/lib/attachments';
import { listChatMessages, saveChatMessage } from '@/lib/remoteRepo';
import { fmtBR, todayISO } from '@/lib/dates';
import type { ChatMessage } from '@/lib/types';

/**
 * Transcrição de laboratório "bagunçado" (texto ou imagem/PDF) → formato canônico
 * do app (LAB / EAS compacto com ⚠️). Independente de paciente; as transcrições ficam salvas.
 */
export function TranscreverLabModal({ onClose }: { onClose: () => void }) {
  const key = useSession((s) => s.key);
  const ai = useAiStream();
  const att = useAttachments();
  const [raw, setRaw, clearRaw] = useDraft('draft.lab');
  const [saved, setSaved] = useState<ChatMessage[]>([]);

  async function refresh() {
    if (!key) return;
    setSaved((await listChatMessages(key, null, 'laboratorio')).reverse());
  }
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  async function transcrever() {
    if (!raw.trim() && att.items.length === 0) return;
    const content = att.items.length
      ? ([
          { type: 'text', text: raw.trim() || 'Transcreva o laboratório da imagem/PDF no formato do app.' },
          ...att.items.map((a) => a.block),
        ] as ContentBlock[])
      : raw;
    const result = await ai.run({ agent: 'laboratorio', messages: [{ role: 'user', content }] });
    if (result && key) {
      await saveChatMessage(key, {
        patientId: null,
        role: 'assistant',
        content: result,
        channel: 'laboratorio',
        topic: `LAB ${fmtBR(todayISO())}`,
      });
      clearRaw();
      att.clear();
      await refresh();
    }
  }

  return (
    <Modal title="Transcrever laboratório" onClose={onClose}>
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm text-muted">
          <FlaskConical className="h-4 w-4 text-brand" /> Cole ou anexe o laboratório — devolvo no formato
          padronizado, com ⚠️ nos alterados. Fica salvo abaixo.
        </p>
        <textarea
          className="input min-h-[120px] font-mono text-xs"
          placeholder="Cole aqui o laboratório (ou anexe/cole uma foto/PDF)…"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
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
        <button
          className="btn-primary"
          disabled={(!raw.trim() && att.items.length === 0) || ai.loading || att.busy}
          onClick={transcrever}
        >
          <Wand2 className="h-4 w-4" /> {ai.loading ? 'Transcrevendo…' : 'Transcrever'}
        </button>
        <AiOutput text={ai.text} loading={ai.loading} error={ai.error} />

        <SavedList items={saved} title="Transcrições salvas" onDeleted={refresh} />
      </div>
    </Modal>
  );
}
