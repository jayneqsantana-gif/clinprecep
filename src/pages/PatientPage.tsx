import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BedDouble, Presentation } from 'lucide-react';
import { useSession } from '@/store/session';
import { getPatient } from '@/lib/remoteRepo';
import type { Patient } from '@/lib/types';
import { diaInternacao, fmtBR } from '@/lib/dates';
import { EmptyState } from '@/components/ui';
import { AnamneseCard } from '@/features/anamnese/AnamneseCard';
import { EvolucaoDiaria } from '@/features/evolucao/EvolucaoDiaria';
import { DiferencialTab } from '@/features/diferencial/DiferencialTab';
import { PrescricaoTab } from '@/features/prescricao/PrescricaoTab';
import { TasksPanel } from '@/features/tarefas/TasksPanel';
import { LabsCard } from '@/features/labs/LabsCard';
import { TimelineCard } from '@/features/labs/TimelineCard';
import { DiretrizesTab } from '@/features/diretrizes/DiretrizesTab';
import { AtualizacoesTab } from '@/features/atualizacoes/AtualizacoesTab';
import { PatientDuvidas } from '@/features/duvidas/PatientDuvidas';
import { PresentationView } from '@/features/apresentacao/PresentationView';

type TabKey =
  | 'visao'
  | 'evolucao'
  | 'diferencial'
  | 'diretrizes'
  | 'atualizacoes'
  | 'prescricao'
  | 'duvidas';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'visao', label: 'Visão Geral' },
  { key: 'evolucao', label: 'Evolução' },
  { key: 'diferencial', label: 'Diferencial' },
  { key: 'diretrizes', label: 'Diretrizes' },
  { key: 'atualizacoes', label: 'Atualizações' },
  { key: 'prescricao', label: 'Prescrição' },
  { key: 'duvidas', label: 'Tira-dúvidas' },
];

export function PatientPage() {
  const { id } = useParams<{ id: string }>();
  const key = useSession((s) => s.key);
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null | undefined>(undefined);
  const [tab, setTab] = useState<TabKey>('visao');
  const [presenting, setPresenting] = useState(false);

  useEffect(() => {
    if (!key || !id) return;
    void getPatient(key, id).then(setPatient);
  }, [key, id]);

  if (patient === undefined) return <p className="text-muted">Carregando…</p>;
  if (patient === null) {
    return (
      <EmptyState
        title="Paciente não encontrado"
        action={
          <button className="btn-primary" onClick={() => navigate('/pacientes')}>
            Voltar
          </button>
        }
      />
    );
  }

  const di = diaInternacao(patient.admissionDate);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <button className="btn-ghost px-0 text-sm text-muted" onClick={() => navigate('/pacientes')}>
            <ArrowLeft className="h-4 w-4" /> Prontuários
          </button>
          <button className="btn-ghost text-sm" onClick={() => setPresenting(true)}>
            <Presentation className="h-4 w-4" /> Apresentar
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold">{patient.label}</h1>
          {di != null && <span className="chip">D.I. {di}</span>}
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
          {patient.age != null && <span>{patient.age} anos</span>}
          {patient.sex && <span>{patient.sex}</span>}
          {patient.bed && (
            <span className="inline-flex items-center gap-1">
              <BedDouble className="h-3 w-3" /> {patient.bed}
            </span>
          )}
          <span>Admissão: {fmtBR(patient.admissionDate)}</span>
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-1 border-b border-border pb-px">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap rounded-t-lg px-3 py-2 text-sm font-medium transition ${
                tab === t.key ? 'border-b-2 border-brand text-brand' : 'text-muted hover:text-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <TabContent tab={tab} patient={patient} onPatientUpdated={setPatient} />

      {presenting && <PresentationView patient={patient} onClose={() => setPresenting(false)} />}
    </div>
  );
}

function TabContent({
  tab,
  patient,
  onPatientUpdated,
}: {
  tab: TabKey;
  patient: Patient;
  onPatientUpdated: (p: Patient) => void;
}) {
  const problems = patient.problemList.filter((p) => p.status === 'ativo');

  switch (tab) {
    case 'visao':
      return (
        <div className="space-y-3">
          <AnamneseCard patient={patient} onPatientUpdated={onPatientUpdated} />

          <div className="card">
            <h2 className="mb-2 font-semibold">Lista de problemas</h2>
            {problems.length === 0 ? (
              <p className="text-sm text-muted">
                Ainda sem problemas. Eles são extraídos automaticamente ao organizar a anamnese.
              </p>
            ) : (
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {problems.map((p) => (
                  <li key={p.id}>{p.title}</li>
                ))}
              </ol>
            )}
          </div>

          {patient.allergies.length > 0 && (
            <div className="card">
              <h2 className="mb-2 font-semibold">Alergias</h2>
              <div className="flex flex-wrap gap-2">
                {patient.allergies.map((a) => (
                  <span key={a} className="chip border-danger/40 text-danger">{a}</span>
                ))}
              </div>
            </div>
          )}

          <TimelineCard patient={patient} />
          <LabsCard patient={patient} />
          <TasksPanel patient={patient} />
        </div>
      );
    case 'evolucao':
      return <EvolucaoDiaria patient={patient} />;
    case 'diferencial':
      return <DiferencialTab patient={patient} />;
    case 'diretrizes':
      return <DiretrizesTab patient={patient} />;
    case 'atualizacoes':
      return <AtualizacoesTab patient={patient} />;
    case 'prescricao':
      return <PrescricaoTab patient={patient} />;
    case 'duvidas':
      return <PatientDuvidas patient={patient} />;
  }
}
