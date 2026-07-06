import { useEffect, useMemo, useState } from 'react';
import { Activity, Plus, X } from 'lucide-react';
import { useSession } from '@/store/session';
import { listLabResults, addLabResult } from '@/lib/remoteRepo';
import { ANALYTES, flagFor, parseNum, type Flag } from '@/lib/labs';
import { parseLabText } from '@/lib/labParser';
import { fileToAttachment } from '@/lib/attachments';
import { useAiStream } from '@/hooks/useAiStream';
import { AttachButton, AttachmentNotice } from '@/components/Attachments';
import { todayISO } from '@/lib/dates';
import { Sparkline } from '@/components/Sparkline';
import type { Patient, LabResult, LabValue } from '@/lib/types';

/** Curvas de tendência dos laboratoriais (seção 7.4). Entrada manual + gráficos. */
export function LabsCard({ patient }: { patient: Patient }) {
  const key = useSession((s) => s.key);
  const [labs, setLabs] = useState<LabResult[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [paste, setPaste] = useState('');
  const [extraiu, setExtraiu] = useState<number | null>(null);
  const trans = useAiStream();
  const [imgErr, setImgErr] = useState<string | null>(null);

  function extrair() {
    const parsed = parseLabText(paste);
    const n = Object.keys(parsed).length;
    setExtraiu(n);
    if (n > 0) setFields((f) => ({ ...f, ...parsed }));
  }

  async function fromImage(files: FileList | null) {
    if (!files || files.length === 0) return;
    setImgErr(null);
    setExtraiu(null);
    try {
      const attach = await fileToAttachment(files[0]);
      const text = await trans.run({
        agent: 'transcritor',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Transcreva os exames laboratoriais desta imagem/PDF em texto puro.' },
              attach.block,
            ],
          },
        ],
      });
      if (text) {
        const parsed = parseLabText(text);
        const n = Object.keys(parsed).length;
        setExtraiu(n);
        if (n > 0) setFields((f) => ({ ...f, ...parsed }));
      }
    } catch (e) {
      setImgErr((e as Error).message);
    }
  }

  async function refresh() {
    if (!key) return;
    setLabs(await listLabResults(key, patient.id));
    setLoaded(true);
  }
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, patient.id]);

  // Séries por analito (ordenadas por data).
  const series = useMemo(() => {
    const map: Record<string, { date: string; value: number }[]> = {};
    for (const lab of labs) {
      for (const v of lab.values) {
        const n = Number(v.value);
        if (!Number.isFinite(n)) continue;
        (map[v.name] ||= []).push({ date: lab.date, value: n });
      }
    }
    return map;
  }, [labs]);

  async function salvar() {
    if (!key) return;
    const values: LabValue[] = [];
    for (const a of ANALYTES) {
      const n = parseNum(fields[a.key] ?? '');
      if (n == null) continue;
      const flag: Flag = flagFor(a, n);
      values.push({ name: a.key, value: String(n), unit: a.unit, flag });
    }
    if (values.length === 0) return;
    setSaving(true);
    try {
      await addLabResult(key, { patientId: patient.id, date, values });
      setFields({});
      setAdding(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  const analitosComDados = ANALYTES.filter((a) => (series[a.key]?.length ?? 0) > 0);

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <Activity className="h-4 w-4 text-brand" /> Curvas dos laboratoriais
        </h2>
        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setAdding((v) => !v)}>
          {adding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {adding ? 'Fechar' : 'Adicionar exames'}
        </button>
      </div>

      {adding && (
        <div className="space-y-3 rounded-lg border border-border bg-surface-2 p-3">
          <div>
            <label className="label">Colar laudo (opcional)</label>
            <textarea
              className="input min-h-[70px] font-mono text-xs"
              placeholder="Cole o texto dos exames (ex.: Hb 9,2 Na 132 K 5,1 Ureia 80 Cr 2,1 PCR 120 Leuco 15.400 Plaq 90.000)…"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
            />
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <button type="button" className="btn-ghost text-xs" disabled={!paste.trim()} onClick={extrair}>
                Extrair do texto
              </button>
              <span className="text-xs text-muted">ou</span>
              <AttachButton onFiles={fromImage} label="Foto/PDF do exame" busy={trans.loading} />
              {trans.loading && <span className="text-xs text-muted">Lendo a imagem…</span>}
              {extraiu != null && !trans.loading && (
                <span className="text-xs text-muted">
                  {extraiu > 0 ? `${extraiu} valor(es) reconhecido(s) — confira abaixo.` : 'Nada reconhecido; preencha manualmente.'}
                </span>
              )}
              {(imgErr || trans.error) && <span className="text-xs text-danger">{imgErr || trans.error}</span>}
            </div>
            <AttachmentNotice />
          </div>
          <div>
            <label className="label">Data da coleta</label>
            <input className="input w-40" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ANALYTES.map((a) => (
              <div key={a.key}>
                <label className="label text-xs">{a.label} <span className="text-muted">({a.unit})</span></label>
                <input
                  className="input"
                  inputMode="decimal"
                  placeholder="—"
                  value={fields[a.key] ?? ''}
                  onChange={(e) => setFields((f) => ({ ...f, [a.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">Preencha só os que tiver. Use vírgula decimal (ex.: Cr 1,4).</p>
          <button className="btn-primary" disabled={saving} onClick={salvar}>
            Salvar coleta
          </button>
        </div>
      )}

      {!loaded ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : analitosComDados.length === 0 ? (
        <p className="text-sm text-muted">
          Sem exames registrados. Use "Adicionar exames" para montar as curvas (Hb, Na, Cr, PCR…).
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {analitosComDados.map((a) => (
            <Sparkline key={a.key} analyte={a} points={series[a.key]} />
          ))}
        </div>
      )}
    </div>
  );
}
