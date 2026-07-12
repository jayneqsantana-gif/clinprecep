import { useState } from 'react';
import { FlaskConical, Wand2 } from 'lucide-react';
import { Modal } from '@/components/ui';
import { AiOutput } from '@/components/AiOutput';
import { AttachButton, AttachmentList } from '@/components/Attachments';
import { useAiStream } from '@/hooks/useAiStream';
import { useAttachments } from '@/hooks/useAttachments';
import { imagesFromPaste, type ContentBlock } from '@/lib/attachments';

/**
 * Transcrição de laboratório "bagunçado" (texto ou imagem/PDF) → formato canônico
 * do app (LAB / EAS compacto com ⚠️). Independente de paciente.
 */
export function TranscreverLabModal({ onClose }: { onClose: () => void }) {
  const ai = useAiStream();
  const att = useAttachments();
  const [raw, setRaw] = useState('');

  async function transcrever() {
    if (!raw.trim() && att.items.length === 0) return;
    const content = att.items.length
      ? ([
          { type: 'text', text: raw.trim() || 'Transcreva o laboratório da imagem/PDF no formato do app.' },
          ...att.items.map((a) => a.block),
        ] as ContentBlock[])
      : raw;
    await ai.run({ agent: 'laboratorio', messages: [{ role: 'user', content }] });
  }

  return (
    <Modal title="Transcrever laboratório" onClose={onClose}>
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm text-muted">
          <FlaskConical className="h-4 w-4 text-brand" /> Cole ou anexe o laboratório — devolvo no formato
          padronizado, com ⚠️ nos alterados.
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
      </div>
    </Modal>
  );
}
