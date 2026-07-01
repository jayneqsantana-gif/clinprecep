import { useEffect, useState } from 'react';
import { Stethoscope, Sparkles, Save, Trash2, ChevronDown, ChevronRight, ClipboardList } from 'lucide-react';
import { useSession } from '@/store/session';
import { getAnamnesis, listEvolutions, createEvolution, deleteEvolution } from '@/lib/remoteRepo';
import { buildPatientContext } from '@/lib/context';
import { useAiStream } from '@/hooks/useAiStream';
import { AiOutput } from '@/components/AiOutput';
import { Markdown } from '@/components/Markdown';
import { CopyButton, Disclaimer } from '@/components/ui';
import { todayISO, fmtBR, diaInternacao } from '@/lib/dates';
import type { Patient, Anamnesis, Evolution } from '@/lib/types';

const CLEAN_PROMPT =
  'Gere agora a "versão limpa" da evolução acima: apenas a evolução padronizada (bloco 1), em prosa corrida, sem títulos com "#", sem marcadores e sem comentários — pronta para colar no prontuário.';

export function EvolucaoDiaria({ patient }: { patient: Patient }) {
  const key = useSession((s) => s.key);
  const gen = useAiStream();
  const clean = useAiStream();

  const [anamnesis, setAnamnesis] = useState<Anamnesis | null>(null);
  const [history, setHistory] = useState<Evolution[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dailyInput, setDailyInput] = useState('');
  const [cleanText, setCleanText] = useState('');
  const [saving, setSaving] = useState(false);

  async function refresh() {
    if (!key) return;
    const [a, evos] = await Promise.all([
      getAnamnesis(key, patient.id),
      listEvolutions(key, patient.id),
    ]);
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
    if (!key || !dailyInput.trim()) return;
    setCleanText('');
    clean.reset();
    await gen.run({
      agent: 'preceptor',
      systemExtra: context(),
      messages: [{ role: 'user', content: dailyInput }],
    });
  }

  async function gerarLimpa() {
    if (!gen.text) return;
    const result = await clean.run({
      agent: 'preceptor',
      systemExtra: context(),
      messages: [
        { role: 'user', content: dailyInput },
        { role: 'assistant', content: gen.text },
        { role: 'user', content: CLEAN_PROMPT },
      ],
    });
    if (result) setCleanText(result);
  }

  async function salvar() {
    if (!key || !gen.text) return;
    setSaving(true);
    try {
      await createEvolution(key, {
        patientId: patient.id,
        date: todayISO(),
        dailyInput,
        structuredOutput: { text: gen.text },
        cleanVersion: cleanText,
      });
      // Limpa o formulário e recarrega o histórico.
      setDailyInput('');
      setCleanText('');
      gen.reset();
      clean.reset();
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  const di = diaInternacao(patient.admissionDate);

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
          placeholder="Escreva a atualização do dia + novos exames/SSVV…"
          value={dailyInput}
          onChange={(e) => setDailyInput(e.target.value)}
        />
        <button className="btn-primary" disabled={!dailyInput.trim() || gen.loading || saving} onClick={gerar}>
          <Sparkles className="h-4 w-4" /> {gen.loading ? 'Gerando…' : 'Gerar evolução'}
        </button>

        <AiOutput text={gen.text} loading={gen.loading} error={gen.error} />

        {gen.text && !gen.loading && (
          <div className="space-y-3 border-t border-border pt-3">
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost" disabled={clean.loading} onClick={gerarLimpa}>
                <ClipboardList className="h-4 w-4" /> {clean.loading ? 'Gerando…' : 'Gerar versão limpa'}
              </button>
              <button className="btn-primary" disabled={saving} onClick={salvar}>
                <Save className="h-4 w-4" /> Salvar no histórico
              </button>
            </div>

            {(clean.text || cleanText) && (
              <div className="space-y-2 rounded-lg border border-ok/40 bg-ok/5 p-3">
                <p className="text-xs font-semibold text-ok">Versão limpa (para o prontuário)</p>
                <Markdown>{cleanText || clean.text}</Markdown>
                {!clean.loading && <CopyButton text={cleanText || clean.text} label="Copiar versão limpa" />}
              </div>
            )}
            {clean.error && <AiOutput text="" loading={false} error={clean.error} />}
          </div>
        )}
      </div>

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
  const full = (evo.structuredOutput as { text?: string } | undefined)?.text ?? '';
  const copyText = evo.cleanVersion || full;
  return (
    <div className="card">
      <div className="flex items-center gap-2">
        <button className="flex flex-1 items-center gap-2 text-left" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-medium">{fmtBR(evo.date)}</span>
          {evo.cleanVersion && <span className="chip text-[10px]">versão limpa</span>}
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
          {evo.cleanVersion && (
            <div className="rounded-lg border border-ok/40 bg-ok/5 p-3">
              <p className="mb-1 text-xs font-semibold text-ok">Versão limpa</p>
              <Markdown>{evo.cleanVersion}</Markdown>
            </div>
          )}
          {full && (
            <div>
              <p className="mb-1 text-xs font-semibold text-muted">Completa (4 blocos)</p>
              <Markdown>{full}</Markdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
