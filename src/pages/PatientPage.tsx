import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BedDouble } from 'lucide-react';
import { useSession } from '@/store/session';
import { getPatient } from '@/lib/remoteRepo';
import type { Patient } from '@/lib/types';
import { diaInternacao, fmtBR } from '@/lib/dates';
import { ComingSoon, Disclaimer, EmptyState } from '@/components/ui';

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
        <button
          className="btn-ghost mb-2 px-0 text-sm text-muted"
          onClick={() => navigate('/pacientes')}
        >
          <ArrowLeft className="h-4 w-4" /> Prontuários
        </button>
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

      {/* Sub-abas roláveis (seção 6) */}
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-1 border-b border-border pb-px">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap rounded-t-lg px-3 py-2 text-sm font-medium transition ${
                tab === t.key
                  ? 'border-b-2 border-brand text-brand'
                  : 'text-muted hover:text-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <TabContent tab={tab} patient={patient} />
    </div>
  );
}

function TabContent({ tab, patient }: { tab: TabKey; patient: Patient }) {
  const problems = patient.problemList.filter((p) => p.status === 'ativo');

  switch (tab) {
    case 'visao':
      return (
        <div className="space-y-3">
          <div className="card">
            <h2 className="mb-2 font-semibold">Lista de problemas</h2>
            {problems.length === 0 ? (
              <p className="text-sm text-muted">
                Ainda sem problemas. Eles serão extraídos da anamnese na Fase 1.
              </p>
            ) : (
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {problems.map((p) => (
                  <li key={p.id}>{p.title}</li>
                ))}
              </ol>
            )}
          </div>
          <ComingSoon phase="Fase 2">
            Linha do tempo + curvas dos laboratoriais (Hb, Na, Cr, PCR…) e dispositivos.
          </ComingSoon>
        </div>
      );
    case 'evolucao':
      return (
        <ComingSoon phase="Fase 1 (MVP)">
          Chat de evolução diária: "como está o paciente hoje?" → 4 blocos + versão limpa.
        </ComingSoon>
      );
    case 'diferencial':
      return (
        <div className="space-y-3">
          <Disclaimer text="Apoio ao raciocínio. Hipóteses e critérios não substituem a avaliação clínica nem a preceptoria." />
          <ComingSoon phase="Fase 2">
            Diferencial em 3 camadas (mais provável / não posso perder / plausível) com fontes.
          </ComingSoon>
        </div>
      );
    case 'diretrizes':
      return <ComingSoon phase="Fase 3">Revisão da diretriz vigente por problema, com link oficial.</ComingSoon>;
    case 'atualizacoes':
      return <ComingSoon phase="Fase 3">Novidades das sociedades relevantes ao caso (web search).</ComingSoon>;
    case 'prescricao':
      return (
        <div className="space-y-3">
          <Disclaimer text="Sugestão para conferência. A decisão e a responsabilidade da prescrição são do médico assistente." />
          <ComingSoon phase="Fase 2">
            Prescrição por itens + rede de segurança + checagem de alergia + "⚠️ Não pode passar".
          </ComingSoon>
        </div>
      );
    case 'duvidas':
      return <ComingSoon phase="Fase 3">Chat livre no contexto do paciente, com citações.</ComingSoon>;
  }
}
