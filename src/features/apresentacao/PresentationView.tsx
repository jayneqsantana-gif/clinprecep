import { useEffect, useState } from 'react';
import { X, Printer, AlertTriangle } from 'lucide-react';
import { useSession } from '@/store/session';
import { getAnamnesis, listEvolutions, listTasks, listLabResults } from '@/lib/remoteRepo';
import { ANALYTES, flagFor, fmtNum } from '@/lib/labs';
import { diaInternacao, fmtBR, todayISO } from '@/lib/dates';
import { Markdown } from '@/components/Markdown';
import type { Patient, Evolution, Task } from '@/lib/types';

interface LatestLab {
  label: string;
  unit: string;
  value: number;
  date: string;
  alterado: boolean;
}

/** Resumo do paciente para passagem de plantão (seção 11 — modo apresentação). */
export function PresentationView({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const key = useSession((s) => s.key);
  const [lastEvo, setLastEvo] = useState<Evolution | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [labs, setLabs] = useState<LatestLab[]>([]);
  const [oneLiner, setOneLiner] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!key) return;
    void (async () => {
      const [anam, evos, tks, labResults] = await Promise.all([
        getAnamnesis(key, patient.id),
        listEvolutions(key, patient.id),
        listTasks(key, patient.id),
        listLabResults(key, patient.id),
      ]);
      setLastEvo(evos[0] ?? null);
      setTasks(tks.filter((t) => !t.done));

      // Último valor de cada analito.
      const latest: LatestLab[] = [];
      for (const a of ANALYTES) {
        let found: { value: number; date: string } | null = null;
        for (const lab of labResults) {
          const v = lab.values.find((x) => x.name === a.key);
          if (v && Number.isFinite(Number(v.value))) found = { value: Number(v.value), date: lab.date };
        }
        if (found) {
          const f = flagFor(a, found.value);
          latest.push({ label: a.label, unit: a.unit, value: found.value, date: found.date, alterado: f === 'alto' || f === 'baixo' });
        }
      }
      setLabs(latest);

      const di = diaInternacao(patient.admissionDate);
      const problems = patient.problemList.filter((p) => p.status === 'ativo').map((p) => p.title);
      setOneLiner(
        [
          patient.age != null ? `${patient.age}a` : null,
          patient.sex,
          di != null ? `D.I. ${di}` : null,
          problems.length ? problems.join(' + ') : anam ? 'ver anamnese' : null,
        ]
          .filter(Boolean)
          .join(', '),
      );
      setLoaded(true);
    })();
  }, [key, patient]);

  const di = diaInternacao(patient.admissionDate);
  const problems = patient.problemList.filter((p) => p.status === 'ativo');

  return (
    <div id="apresentacao" className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      <div className="mx-auto max-w-3xl space-y-4 p-5">
        {/* Barra de ações (some na impressão) */}
        <div className="no-print flex items-center justify-between">
          <span className="text-sm font-semibold text-muted">Modo apresentação</span>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir / PDF
            </button>
            <button className="btn-ghost" onClick={onClose}>
              <X className="h-4 w-4" /> Fechar
            </button>
          </div>
        </div>

        <header className="border-b border-border pb-2">
          <div className="flex items-baseline justify-between">
            <h1 className="text-2xl font-bold">{patient.label}</h1>
            <span className="text-sm text-muted">Passagem — {fmtBR(todayISO())}</span>
          </div>
          <p className="text-sm text-muted">{oneLiner}</p>
          <p className="text-xs text-muted">
            {patient.bed ? `Leito ${patient.bed} · ` : ''}Admissão {fmtBR(patient.admissionDate)}
            {di != null ? ` · D.I. ${di}` : ''}
          </p>
        </header>

        {!loaded ? (
          <p className="text-muted">Carregando…</p>
        ) : (
          <div className="space-y-4">
            {patient.allergies.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-danger/50 bg-danger/10 p-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-danger" />
                <span><strong>Alergias:</strong> {patient.allergies.join(', ')}</span>
              </div>
            )}

            <Section title="Problemas ativos">
              {problems.length ? (
                <ol className="list-decimal space-y-0.5 pl-5 text-sm">
                  {problems.map((p) => <li key={p.id}>{p.title}</li>)}
                </ol>
              ) : (
                <p className="text-sm text-muted">Sem problemas registrados.</p>
              )}
            </Section>

            <Section title="Últimos laboratoriais">
              {labs.length ? (
                <div className="flex flex-wrap gap-2">
                  {labs.map((l) => (
                    <span
                      key={l.label}
                      className={`chip ${l.alterado ? 'border-danger/50 text-danger' : ''}`}
                      title={fmtBR(l.date)}
                    >
                      {l.label} {fmtNum(l.value)} {l.unit}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">Sem exames registrados.</p>
              )}
            </Section>

            <Section title={`Pendências (${tasks.length})`}>
              {tasks.length ? (
                <ul className="space-y-0.5 text-sm">
                  {tasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-2">
                      <span className="text-muted">☐</span>
                      <span>{t.description}</span>
                      {t.urgent && <span className="text-xs font-semibold text-danger">URGENTE</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Nenhuma pendência aberta.</p>
              )}
            </Section>

            <Section title={lastEvo ? `Última evolução (${fmtBR(lastEvo.date)})` : 'Evolução'}>
              {lastEvo ? (
                <Markdown>
                  {lastEvo.cleanVersion ||
                    (lastEvo.structuredOutput as { text?: string } | undefined)?.text ||
                    '—'}
                </Markdown>
              ) : (
                <p className="text-sm text-muted">Nenhuma evolução salva.</p>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-brand">{title}</h2>
      {children}
    </section>
  );
}
