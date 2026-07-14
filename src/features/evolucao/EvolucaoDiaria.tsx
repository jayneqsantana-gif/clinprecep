import { useEffect, useState } from 'react';
import { Stethoscope, Sparkles, Save, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useSession } from '@/store/session';
import {
  getAnamnesis,
  saveAnamnesis,
  savePatient,
  listEvolutions,
  createEvolution,
  deleteEvolution,
  addLabResult,
  listTasks,
  createTask,
} from '@/lib/remoteRepo';
import {
  buildPatientContext,
  parseOrganizerOutput,
  extractOrganizerJson,
  extractPendencias,
  extractLabs,
} from '@/lib/context';
import { useAiStream } from '@/hooks/useAiStream';
import { useAttachments } from '@/hooks/useAttachments';
import { useDraft } from '@/hooks/useDraft';
import { AiOutput } from '@/components/AiOutput';
import { AttachButton, AttachmentList, AttachmentNotice } from '@/components/Attachments';
import { CaseAnalysisBlocks } from '@/features/anamnese/CaseAnalysisBlocks';
import { ClinicalText, stripBold } from '@/components/ClinicalText';
import { CopyButton, Disclaimer } from '@/components/ui';
import { imagesFromPaste, type ContentBlock } from '@/lib/attachments';
import { todayISO, fmtBR, diaInternacao } from '@/lib/dates';
import type { Patient, Anamnesis, Evolution, Problem } from '@/lib/types';

const PLACEHOLDER =
  'Escreva aqui como está seu paciente hoje, anexe a prescrição do dia, descreva alterações no exame físico e os sinais vitais das últimas 24h…';

export function EvolucaoDiaria({
  patient,
  onPatientUpdated,
}: {
  patient: Patient;
  onPatientUpdated?: (p: Patient) => void;
}) {
  const key = useSession((s) => s.key);
  const gen = useAiStream();
  const att = useAttachments();

  const [anamnesis, setAnamnesis] = useState<Anamnesis | null>(null);
  const [history, setHistory] = useState<Evolution[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dailyInput, setDailyInput, clearDailyInput] = useDraft(`draft.evo.${patient.id}`);
  const [saving, setSaving] = useState(false);
  const [savedAnalysis, setSavedAnalysis] = useState('');

  async function refresh() {
    if (!key) return;
    const [a, evos] = await Promise.all([getAnamnesis(key, patient.id), listEvolutions(key, patient.id)]);
    setAnamnesis(a);
    setHistory(evos);
    setLoaded(true);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, patient.id]);

  const context = () => buildPatientContext(patient, anamnesis, history[0] ?? null);

  async function gerar() {
    if (!key || (!dailyInput.trim() && att.items.length === 0)) return;
    setSavedAnalysis('');
    const texto =
      `Cenário: ${patient.setting}. Atualização de hoje (${fmtBR(todayISO())}):\n` +
      (dailyInput.trim() || 'Atualize a evolução a partir dos exames/prescrição anexados.');
    const content: string | ContentBlock[] = att.items.length
      ? [{ type: 'text', text: texto }, ...att.items.map((a) => a.block)]
      : texto;
    await gen.run({
      agent: 'preceptor',
      systemExtra: context(),
      messages: [{ role: 'user', content }],
    });
  }

  /** Atualiza a lista de problemas do paciente a partir do <json> do preceptor. */
  async function aplicarProblemas(aiText: string): Promise<Patient> {
    const parsed = extractOrganizerJson(aiText);
    if (!key || !parsed?.problemList?.length) return patient;
    const norm = (s: string) => s.trim().toLowerCase();
    const atuais = [...patient.problemList];
    for (const p of parsed.problemList) {
      if (!p.title) continue;
      const idx = atuais.findIndex((x) => norm(x.title) === norm(p.title));
      const status = p.status === 'resolvido' ? 'resolvido' : 'ativo';
      if (idx >= 0) {
        atuais[idx] = { ...atuais[idx], status };
      } else {
        const novo: Problem = {
          id: crypto.randomUUID(),
          order: atuais.length,
          title: p.title,
          status,
          linkedGuidelineTopic: null,
        };
        atuais.push(novo);
      }
    }
    const updated = await savePatient(key, { ...patient, problemList: atuais });
    onPatientUpdated?.(updated);
    return updated;
  }

  /** Salva os laboratórios do dia (<labs>) na curva. */
  async function aplicarLabs(aiText: string) {
    if (!key) return;
    for (const lab of extractLabs(aiText)) {
      if (!lab.date || !lab.values?.length) continue;
      await addLabResult(key, {
        patientId: patient.id,
        date: lab.date,
        values: lab.values.map((v) => ({ name: v.name, value: v.value, unit: v.unit ?? '', flag: v.flag ?? null })),
      });
    }
  }

  /** Cria pendências novas do dia (<pendencias>), sem duplicar. */
  async function aplicarPendencias(aiText: string) {
    if (!key) return;
    const itens = extractPendencias(aiText);
    if (!itens.length) return;
    const existentes = await listTasks(key, patient.id);
    const norm = (s: string) => s.trim().toLowerCase();
    const jaTem = new Set(existentes.map((t) => norm(t.description)));
    for (const d of itens.filter((x) => !jaTem.has(norm(x)))) {
      await createTask(key, { patientId: patient.id, description: d, urgent: false, dueDate: null });
    }
  }

  async function salvar() {
    if (!key || !gen.text) return;
    setSaving(true);
    try {
      const { anamnese, analysis } = parseOrganizerOutput(gen.text);
      // 1) salva a evolução no histórico
      await createEvolution(key, {
        patientId: patient.id,
        date: todayISO(),
        dailyInput,
        structuredOutput: { text: anamnese, analysis },
        cleanVersion: '',
      });
      // 2) atualiza a anamnese "viva" do paciente (mantém tudo em sincronia)
      await saveAnamnesis(key, {
        patientId: patient.id,
        rawText: anamnesis?.rawText ?? '',
        structured: { text: anamnese, analysis },
        createdAt: anamnesis?.createdAt ?? new Date().toISOString(),
      });
      // 3) reflete problemas, labs e pendências automaticamente
      await aplicarProblemas(gen.text);
      await aplicarLabs(gen.text);
      await aplicarPendencias(gen.text);

      setSavedAnalysis(analysis);
      clearDailyInput();
      att.clear();
      gen.reset();
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  const di = diaInternacao(patient.admissionDate);
  const live = gen.text ? parseOrganizerOutput(gen.text) : { anamnese: '', analysis: '' };

  return (
    <div className="space-y-4">
      <Disclaimer text="Apoio à decisão. Confira tudo à beira do leito e com a preceptoria — a responsabilidade é do médico assistente." />

      <div className="card space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <Stethoscope className="h-4 w-4 text-brand" /> Como está o paciente hoje?
          {di != null && <span className="chip ml-auto">D.I. {di} · {fmtBR(todayISO())}</span>}
        </div>
        <textarea
          className="input min-h-[120px] text-sm"
          placeholder={PLACEHOLDER}
          value={dailyInput}
          onChange={(e) => setDailyInput(e.target.value)}
          onPaste={(e) => {
            const imgs = imagesFromPaste(e.nativeEvent);
            if (imgs.length) void att.add(imgs);
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <AttachButton onFiles={(f) => void att.add(f)} label="+ novos exames" busy={att.busy} />
          {att.error && <span className="text-xs text-danger">{att.error}</span>}
        </div>
        <AttachmentList items={att.items} onRemove={att.remove} />
        {att.items.length > 0 && <AttachmentNotice />}

        <button
          className="btn-primary"
          disabled={(!dailyInput.trim() && att.items.length === 0) || gen.loading || saving || att.busy}
          onClick={gerar}
        >
          <Sparkles className="h-4 w-4" />{' '}
          {gen.loading ? 'Gerando…' : gen.text ? 'Gerar novamente' : 'Gerar evolução'}
        </button>

        {/* Anamnese/evolução atualizada, pronta para copiar */}
        {gen.error ? (
          <AiOutput text="" loading={false} error={gen.error} />
        ) : gen.loading && !live.anamnese ? (
          <AiOutput text="" loading={true} error={null} />
        ) : (
          live.anamnese && (
            <div className="space-y-2">
              <div className="rounded-lg border border-border bg-surface-2 p-3">
                <ClinicalText text={live.anamnese} />
                {gen.loading && <p className="mt-2 text-xs text-muted">gerando…</p>}
              </div>
              {!gen.loading && (
                <div className="sticky bottom-[4.75rem] z-10 flex flex-wrap gap-2 rounded-lg border border-border bg-surface/95 p-1.5 backdrop-blur">
                  <button className="btn-primary flex-1 justify-center" disabled={saving} onClick={salvar}>
                    <Save className="h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar e gerar análise'}
                  </button>
                  <CopyButton text={stripBold(live.anamnese)} label="Copiar" />
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* Análise do caso (blocos 2/3/4) — ao vivo durante a geração, ou salva */}
      <CaseAnalysisBlocks analysis={savedAnalysis || live.analysis} />

      <div className="space-y-2">
        <h2 className="font-semibold">Histórico de evoluções</h2>
        {!loaded ? (
          <p className="text-sm text-muted">Carregando…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma evolução salva ainda.</p>
        ) : (
          history.map((e) => <EvolutionItem key={e.id} evo={e} onDeleted={refresh} />)
        )}
      </div>
    </div>
  );
}

function EvolutionItem({ evo, onDeleted }: { evo: Evolution; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const out = evo.structuredOutput as { text?: string; analysis?: string } | undefined;
  const full = out?.text ?? '';
  const analysis = out?.analysis ?? '';
  const copyText = stripBold(evo.cleanVersion || full);
  return (
    <div className="card">
      <div className="flex items-center gap-2">
        <button className="flex flex-1 items-center gap-2 text-left" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-medium">{fmtBR(evo.date)}</span>
        </button>
        <CopyButton text={copyText} label="Copiar" />
        <button
          className="btn-ghost px-2 py-1 text-danger"
          onClick={async () => {
            if (confirm('Excluir esta evolução?')) {
              await deleteEvolution(evo.id);
              onDeleted();
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {full && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted">Anamnese/evolução</p>
              <div className="rounded-lg border border-border bg-surface-2 p-3">
                <ClinicalText text={full} />
              </div>
              <CopyButton text={stripBold(full)} label="Copiar" />
            </div>
          )}
          {analysis && <CaseAnalysisBlocks analysis={analysis} />}
        </div>
      )}
    </div>
  );
}
