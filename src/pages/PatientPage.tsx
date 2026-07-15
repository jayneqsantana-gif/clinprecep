import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BedDouble, Presentation } from 'lucide-react';
import { useSession } from '@/store/session';
import { getPatient } from '@/lib/remoteRepo';
import type { Patient } from '@/lib/types';
import { diaInternacao, fmtBR } from '@/lib/dates';
import { EmptyState } from '@/components/ui';
import { AnamneseCard } from '@/features/anamnese/AnamneseCard';
import { CaseAnalysisBlocks } from '@/features/anamnese/CaseAnalysisBlocks';
import { EvolucaoDiaria } from '@/features/evolucao/EvolucaoDiaria';
import { AltaTab } from '@/features/alta/AltaTab';
import { DiferencialTab } from '@/features/diferencial/DiferencialTab';
import { PrescricaoTab } from '@/features/prescricao/PrescricaoTab';
import { TasksPanel } from '@/features/tarefas/TasksPanel';
import { DiretrizesTab } from '@/features/diretrizes/DiretrizesTab';
import { AtualizacoesTab } from '@/features/atualizacoes/AtualizacoesTab';
import { PatientDuvidas } from '@/features/duvidas/PatientDuvidas';
import { PresentationView } from '@/features/apresentacao/PresentationView';
import { GenderIcon } from '@/components/GenderIcon';
import { BookOpen } from 'lucide-react';

type TabKey =
  | 'visao'
  | 'evolucao'
  | 'alta'
  | 'diferencial'
  | 'diretrizes'
  | 'atualizacoes'
  | 'prescricao'
  | 'duvidas';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'visao', label: 'Visão Geral' },
  { key: 'evolucao', label: 'Evolução' },
  { key: 'alta', label: 'Alta hospitalar' },
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
  // Aba ativa persistida por paciente: se a tela remontar (troca de janela,
  // atualização do PWA), volta para a mesma aba em vez de cair na Visão Geral.
  const tabKey = `clinprecep.tab.${id}`;
  const [tab, setTabState] = useState<TabKey>(() => {
    const saved = id ? (localStorage.getItem(tabKey) as TabKey | null) : null;
    return saved && TABS.some((t) => t.key === saved) ? saved : 'visao';
  });
  const setTab = (t: TabKey) => {
    setTabState(t);
    try {
      localStorage.setItem(tabKey, t);
    } catch {
      /* ignora */
    }
  };
  const [presenting, setPresenting] = useState(false);
  const [diretrizTopic, setDiretrizTopic] = useState('');

  function revisarTema(topic: string) {
    setDiretrizTopic(topic);
    setTab('diretrizes');
  }

  useEffect(() => {
    if (!key || !id) return;
    void getPatient(key, id).then(setPatient);
  }, [key, id]);

  // Ao trocar de aba, volta ao topo (evita abrir a aba nova rolada lá embaixo).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [tab]);

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
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
          {patient.age != null && <span>{patient.age} anos</span>}
          {patient.sex && <GenderIcon sex={patient.sex} className="text-sm" />}
          {patient.bed && (
            <span className="inline-flex items-center gap-1">
              <BedDouble className="h-3 w-3" /> {patient.bed}
            </span>
          )}
          <span>Admissão: {fmtBR(patient.admissionDate)}</span>
        </div>
      </div>

      <div className="sticky top-[3.25rem] z-20 -mx-4 overflow-x-auto border-b border-border bg-bg/95 px-4 backdrop-blur">
        <div className="flex w-max gap-1">
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

      <TabContent
        tab={tab}
        patient={patient}
        onPatientUpdated={setPatient}
        diretrizTopic={diretrizTopic}
        onRevisarTema={revisarTema}
      />

      {presenting && <PresentationView patient={patient} onClose={() => setPresenting(false)} />}
    </div>
  );
}

function TabContent({
  tab,
  patient,
  onPatientUpdated,
  diretrizTopic,
  onRevisarTema,
}: {
  tab: TabKey;
  patient: Patient;
  onPatientUpdated: (p: Patient) => void;
  diretrizTopic: string;
  onRevisarTema: (topic: string) => void;
}) {
  const [analysis, setAnalysis] = useState('');
  const [tasksKey, setTasksKey] = useState(0);
  const problems = patient.problemList.filter((p) => p.status === 'ativo');

  switch (tab) {
    case 'visao':
      return (
        <div className="space-y-3">
          <AnamneseCard
            patient={patient}
            onPatientUpdated={onPatientUpdated}
            onAnalysis={setAnalysis}
            onTasksChanged={() => setTasksKey((k) => k + 1)}
          />

          <div className="card">
            <h2 className="mb-2 font-semibold">Lista de problemas</h2>
            {problems.length === 0 ? (
              <p className="text-sm text-muted">
                Ainda sem problemas. Eles são extraídos automaticamente ao organizar a anamnese.
              </p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {problems.map((p, i) => (
                  <li key={p.id} className="flex items-start justify-between gap-2">
                    <span>
                      <span className="text-muted">{i + 1}.</span> {p.title}
                    </span>
                    <button
                      className="btn-ghost shrink-0 px-2 py-0.5 text-xs"
                      onClick={() => onRevisarTema(p.title)}
                      title="Abrir revisão da diretriz sobre este tema"
                    >
                      <BookOpen className="h-3.5 w-3.5" /> Revisar tema
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <TasksPanel patient={patient} refreshKey={tasksKey} />

          <CaseAnalysisBlocks analysis={analysis} />
        </div>
      );
    case 'evolucao':
      return <EvolucaoDiaria patient={patient} onPatientUpdated={onPatientUpdated} />;
    case 'alta':
      return <AltaTab patient={patient} />;
    case 'diferencial':
      return <DiferencialTab patient={patient} />;
    case 'diretrizes':
      return <DiretrizesTab patient={patient} initialTopic={diretrizTopic} />;
    case 'atualizacoes':
      return <AtualizacoesTab patient={patient} />;
    case 'prescricao':
      return <PrescricaoTab patient={patient} />;
    case 'duvidas':
      return <PatientDuvidas patient={patient} />;
  }
}
