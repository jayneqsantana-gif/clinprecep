import { useEffect, useState } from 'react';
import { Wand2, Save, Pencil, RefreshCw, FileText, Stethoscope, Loader2 } from 'lucide-react';
import { useSession } from '@/store/session';
import { getAnamnesis, saveAnamnesis, savePatient, listTasks, createTask } from '@/lib/remoteRepo';
import {
  buildPatientContext,
  extractOrganizerJson,
  extractPendencias,
  parseOrganizerOutput,
} from '@/lib/context';
import { SETTING_LABEL } from '@/lib/types';
import { useAiStream } from '@/hooks/useAiStream';
import { useAttachments } from '@/hooks/useAttachments';
import { AiOutput } from '@/components/AiOutput';
import { AttachButton, AttachmentList, AttachmentNotice } from '@/components/Attachments';
import { imagesFromPaste, type ContentBlock } from '@/lib/attachments';
import { Markdown } from '@/components/Markdown';
import { ClinicalText, stripBold } from '@/components/ClinicalText';
import { CopyButton } from '@/components/ui';
import type { Patient, Anamnesis, Problem } from '@/lib/types';

/**
 * Organização da anamnese (seção 7.2): colar texto bruto → "Organizar" (agente
 * Organizador) → versão estruturada editável → salvar. A lista de problemas
 * extraída atualiza o paciente.
 */
export function AnamneseCard({
  patient,
  onPatientUpdated,
  onAnalysis,
  onTasksChanged,
}: {
  patient: Patient;
  onPatientUpdated: (p: Patient) => void;
  /** Eleva a análise clínica salva (blocos 2/3/4) para a página renderizar abaixo. */
  onAnalysis?: (analysis: string) => void;
  /** Avisa a página que as pendências mudaram (para recarregar o painel). */
  onTasksChanged?: () => void;
}) {
  const key = useSession((s) => s.key);
  const ai = useAiStream();
  const att = useAttachments();
  const [anamnesis, setAnamnesis] = useState<Anamnesis | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [raw, setRaw] = useState('');
  const [mode, setMode] = useState<'view' | 'input' | 'edit'>('input');
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!key) return;
    void getAnamnesis(key, patient.id).then((a) => {
      setAnamnesis(a);
      setMode(a ? 'view' : 'input');
      setLoaded(true);
      onAnalysis?.((a?.structured as { analysis?: string } | undefined)?.analysis ?? '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, patient.id]);

  const structured = anamnesis?.structured as { text?: string; analysis?: string } | undefined;
  const structuredText = structured?.text ?? '';
  const analysisText = structured?.analysis ?? '';

  /** Cria pendências novas a partir do que a IA inferiu do caso (sem duplicar). */
  async function autoPendencias(aiText: string) {
    if (!key) return;
    const itens = extractPendencias(aiText);
    if (!itens.length) return;
    const existentes = await listTasks(key, patient.id);
    const norm = (s: string) => s.trim().toLowerCase();
    const jaTem = new Set(existentes.map((t) => norm(t.description)));
    const novas = itens.filter((d) => !jaTem.has(norm(d)));
    for (const d of novas) {
      await createTask(key, { patientId: patient.id, description: d, urgent: false, dueDate: null });
    }
    if (novas.length) onTasksChanged?.();
  }

  async function organizar() {
    if (!key || (!raw.trim() && att.items.length === 0)) return;
    const cenario = `Cenário: ${SETTING_LABEL[patient.setting]}. Use o formato de ${SETTING_LABEL[patient.setting]}.`;
    const texto = [cenario, raw.trim() || 'Organize a anamnese/admissão a partir da imagem/PDF anexado.'].join('\n\n');
    const content = att.items.length
      ? ([
          { type: 'text', text: texto },
          ...att.items.map((a) => a.block),
        ] as ContentBlock[])
      : texto;
    const result = await ai.run({
      agent: 'organizador',
      systemExtra: buildPatientContext(patient),
      messages: [{ role: 'user', content }],
    });
    if (!result) return; // erro/abort já tratado pelo AiOutput
    await persistir(result, raw);
    att.clear();
  }

  async function persistir(aiText: string, rawText: string) {
    if (!key) return;
    setSaving(true);
    try {
      const { anamnese, analysis } = parseOrganizerOutput(aiText);
      const parsed = extractOrganizerJson(aiText);

      // Mescla problemas/alergias e preenche a demografia AUTOMATICAMENTE a partir
      // da anamnese (só o que ainda está em branco — não sobrescreve o que o médico digitou).
      let updatedPatient = patient;
      const norm = (s: string) => s.trim().toLowerCase();
      const existentes = patient.problemList;
      const titulos = new Set(existentes.map((p) => norm(p.title)));
      const novos: Problem[] = (parsed?.problemList ?? [])
        .filter((p) => p.title && !titulos.has(norm(p.title)))
        .map((p, i) => ({
          id: crypto.randomUUID(),
          order: existentes.length + i,
          title: p.title,
          status: 'ativo',
          linkedGuidelineTopic: null,
        }));
      const mergedAllergies = Array.from(
        new Set([...patient.allergies, ...(parsed?.allergies ?? [])].map((a) => a.trim()).filter(Boolean)),
      );
      const demografia: Partial<Patient> = {};
      if (patient.age == null && typeof parsed?.age === 'number') demografia.age = parsed.age;
      if (patient.sex == null && parsed?.sex) demografia.sex = parsed.sex;
      if (!patient.bed && parsed?.bed) demografia.bed = parsed.bed;
      if (!patient.admissionDate && parsed?.admissionDate) demografia.admissionDate = parsed.admissionDate;

      const mudou =
        novos.length > 0 ||
        mergedAllergies.length !== patient.allergies.length ||
        Object.keys(demografia).length > 0;
      if (mudou) {
        updatedPatient = await savePatient(key, {
          ...patient,
          ...demografia,
          problemList: [...existentes, ...novos],
          allergies: mergedAllergies,
        });
        onPatientUpdated(updatedPatient);
      }

      const a: Anamnesis = {
        patientId: patient.id,
        rawText,
        structured: { text: anamnese, analysis },
        createdAt: new Date().toISOString(),
      };
      await saveAnamnesis(key, a);
      setAnamnesis(a);
      onAnalysis?.(analysis);
      await autoPendencias(aiText);
      ai.reset();
      setMode('view');
    } finally {
      setSaving(false);
    }
  }

  async function salvarEdicao() {
    if (!key) return;
    setSaving(true);
    try {
      const a: Anamnesis = {
        patientId: patient.id,
        rawText: anamnesis?.rawText ?? '',
        structured: { text: editText, analysis: analysisText },
        createdAt: anamnesis?.createdAt ?? new Date().toISOString(),
      };
      await saveAnamnesis(key, a);
      setAnamnesis(a);
      setMode('view');
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <p className="text-sm text-muted">Carregando anamnese…</p>;

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <FileText className="h-4 w-4 text-brand" /> Anamnese
        </h2>
        {mode === 'view' && (
          <div className="flex gap-1">
            <button className="btn-ghost px-2 py-1 text-xs" onClick={() => { setEditText(structuredText); setMode('edit'); }}>
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
            <button className="btn-ghost px-2 py-1 text-xs" onClick={() => { setRaw(''); ai.reset(); setMode('input'); }}>
              <RefreshCw className="h-3.5 w-3.5" /> Reorganizar
            </button>
          </div>
        )}
      </div>

      {mode === 'input' && (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Cole o texto bruto da admissão/anamnese. Não inclua nome completo, CPF ou nº de prontuário.
          </p>
          <textarea
            className="input min-h-[160px] font-mono text-xs"
            placeholder="Cole aqui a anamnese/admissão (ou anexe/cole uma foto/PDF)…"
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
          {att.items.length > 0 && <AttachmentNotice />}
          <button
            className="btn-primary"
            disabled={(!raw.trim() && att.items.length === 0) || ai.loading || saving || att.busy}
            onClick={organizar}
          >
            <Wand2 className="h-4 w-4" /> {ai.loading ? 'Organizando…' : 'Organizar'}
          </button>
          {(() => {
            const live = ai.text ? parseOrganizerOutput(ai.text) : { anamnese: '', analysis: '' };
            if (ai.error) return <AiOutput text="" loading={false} error={ai.error} />;
            if (!ai.loading && !live.anamnese) return null;
            return (
              <>
                <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
                  {ai.loading && !live.anamnese ? (
                    <span className="flex items-center gap-2 text-sm text-muted">
                      <Loader2 className="h-4 w-4 animate-spin" /> A IA está organizando…
                    </span>
                  ) : (
                    <ClinicalText text={live.anamnese} />
                  )}
                  {ai.loading && live.anamnese && (
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <Loader2 className="h-3 w-3 animate-spin" /> gerando…
                    </div>
                  )}
                  {!ai.loading && live.anamnese && (
                    <CopyButton text={stripBold(live.anamnese)} label="Copiar anamnese" />
                  )}
                </div>
                {live.analysis && (
                  <div className="space-y-2 rounded-lg border border-brand/30 bg-brand/5 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-brand">
                      <Stethoscope className="h-4 w-4" /> Análise clínica (IA)
                    </p>
                    <Markdown>{live.analysis}</Markdown>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {mode === 'edit' && (
        <div className="space-y-2">
          <textarea
            className="input min-h-[240px] font-mono text-xs"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="btn-primary" disabled={saving} onClick={salvarEdicao}>
              <Save className="h-4 w-4" /> Salvar
            </button>
            <button className="btn-ghost" onClick={() => setMode('view')}>Cancelar</button>
          </div>
        </div>
      )}

      {mode === 'view' && structuredText && (
        <div className="space-y-2">
          <div className="rounded-lg border border-border bg-surface-2 p-3">
            <ClinicalText text={structuredText} />
          </div>
          <p className="text-xs text-muted">
            Trechos em <strong className="text-warn">destaque</strong> foram complementados/presumidos pela IA — confirme
            antes de transcrever (o texto copiado sai limpo, sem marcações).
          </p>
          <CopyButton text={stripBold(structuredText)} label="Copiar anamnese" />
        </div>
      )}
    </div>
  );
}
