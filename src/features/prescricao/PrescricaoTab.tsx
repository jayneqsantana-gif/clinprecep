import { useState } from 'react';
import { Pill, Sparkles, AlertOctagon } from 'lucide-react';
import { useAiStream } from '@/hooks/useAiStream';
import { usePatientAiContext } from '@/hooks/usePatientAiContext';
import { AiOutput } from '@/components/AiOutput';
import { Disclaimer } from '@/components/ui';
import type { Patient } from '@/lib/types';

/** Prescrição com rede de segurança + checagem de alergia (seção 7.8), agente Prescrição. */
export function PrescricaoTab({ patient }: { patient: Patient }) {
  const ai = useAiStream();
  const { context } = usePatientAiContext(patient);
  const [notes, setNotes] = useState('');

  async function gerar() {
    await ai.run({
      agent: 'prescricao',
      systemExtra: context(),
      messages: [
        {
          role: 'user',
          content:
            'Monte a sugestão de prescrição estruturada por itens, percorrendo a rede de segurança (profilaxia de TEV, ajuste por função renal, desescalonamento de ATB, conciliação medicamentosa, retirada de dispositivos), cruzando as alergias e fechando com "⚠️ Não pode passar".' +
            (notes.trim() ? `\n\nObservações do residente / prescrição atual:\n${notes}` : ''),
        },
      ],
    });
  }

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
          <Pill className="h-4 w-4 text-brand" /> Sugestão de prescrição
        </div>
        <textarea
          className="input min-h-[90px] text-sm"
          placeholder="Opcional: cole a prescrição atual ou observações (função renal, ATB em uso, dispositivos…)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button className="btn-primary" disabled={ai.loading} onClick={gerar}>
          <Sparkles className="h-4 w-4" /> {ai.loading ? 'Gerando…' : 'Gerar sugestão'}
        </button>
        <AiOutput text={ai.text} loading={ai.loading} error={ai.error} citations={ai.citations} />
      </div>
    </div>
  );
}
