import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Users,
  Search,
  BedDouble,
  AlertTriangle,
  FlaskConical,
  Printer,
  FileText,
  ClipboardList,
  Archive,
  Trash2,
} from 'lucide-react';
import { useSession } from '@/store/session';
import {
  createPatient,
  listPatients,
  archivePatient,
  deletePatient,
  openTaskCount,
  type NewPatientInput,
} from '@/lib/remoteRepo';
import type { Patient, PatientSetting } from '@/lib/types';
import { SETTING_LABEL, SETTINGS_ORDER } from '@/lib/types';
import { diaInternacao } from '@/lib/dates';
import { EmptyState, Modal } from '@/components/ui';
import { GenderIcon } from '@/components/GenderIcon';
import { TranscreverLabModal } from '@/features/passagem/TranscreverLabModal';
import { PassagemCasoModal } from '@/features/passagem/PassagemCasoModal';
import { PassagemPlantaoModal } from '@/features/passagem/PassagemPlantaoModal';

export function PatientsPage() {
  const key = useSession((s) => s.key);
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [cenario, setCenario] = useState<PatientSetting | 'todos'>('todos');
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [plantao, setPlantao] = useState(false);
  const [passeCaso, setPasseCaso] = useState<Patient | null>(null);

  async function refresh() {
    if (!key) return;
    setLoading(true);
    const list = await listPatients(key, showArchived);
    setPatients(list);
    setLoading(false);
    // Contagem de pendências abertas por paciente (barato — coluna `done`).
    const entries = await Promise.all(
      list.map(async (p) => [p.id, await openTaskCount(p.id)] as const),
    );
    setCounts(Object.fromEntries(entries));
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, showArchived]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return patients.filter((p) => {
      if (cenario !== 'todos' && p.setting !== cenario) return false;
      if (!q) return true;
      return p.label.toLowerCase().includes(q) || (p.bed ?? '').toLowerCase().includes(q);
    });
  }, [patients, query, cenario]);

  const contagemCenario = useMemo(() => {
    const c: Record<string, number> = { todos: patients.length, enfermaria: 0, uti: 0, ambulatorio: 0, psf: 0 };
    for (const p of patients) c[p.setting] = (c[p.setting] ?? 0) + 1;
    return c;
  }, [patients]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Prontuários</h1>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Paciente
          </button>
          <button className="btn-ghost border border-border" onClick={() => setPlantao(true)}>
            <Printer className="h-4 w-4" /> Gerar passagem de plantão
          </button>
          <button className="btn-ghost border border-border" onClick={() => setTranscrevendo(true)}>
            <FlaskConical className="h-4 w-4" /> Transcrever laboratório
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            className="input pl-9"
            placeholder="Buscar por apelido ou leito…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          className={`chip ${showArchived ? 'border-brand text-brand' : ''}`}
          onClick={() => setShowArchived((v) => !v)}
        >
          {showArchived ? 'Mostrando arquivados' : 'Ativos'}
        </button>
      </div>

      {/* Abas por cenário */}
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-1 border-b border-border pb-px">
          {(['todos', ...SETTINGS_ORDER] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCenario(c)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3 py-2 text-sm font-medium transition ${
                cenario === c ? 'border-b-2 border-brand text-brand' : 'text-muted hover:text-text'
              }`}
            >
              {c === 'todos' ? 'Todos' : SETTING_LABEL[c]}
              <span className="rounded-full bg-surface-2 px-1.5 text-xs">{contagemCenario[c] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-muted">Carregando…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="Nenhum paciente ainda"
          hint="Adicione o primeiro paciente para começar a organizar a anamnese e as evoluções."
          action={
            <button className="btn-primary" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Adicionar paciente
            </button>
          }
        />
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((p) => (
            <PatientCard
              key={p.id}
              patient={p}
              openTasks={counts[p.id] ?? 0}
              onOpen={() => navigate(`/pacientes/${p.id}`)}
              onPasse={() => setPasseCaso(p)}
              onArchive={async () => {
                if (!key) return;
                await archivePatient(key, p.id, p.active);
                await refresh();
              }}
              onDelete={async () => {
                if (
                  confirm(
                    `Remover definitivamente "${p.label}"? Esta ação apaga todos os dados do paciente e não pode ser desfeita.`,
                  )
                ) {
                  await deletePatient(p.id);
                  await refresh();
                }
              }}
            />
          ))}
        </div>
      )}

      {adding && key && (
        <AddPatientModal
          defaultSetting={cenario === 'todos' ? 'enfermaria' : cenario}
          onClose={() => setAdding(false)}
          onCreate={async (input) => {
            const p = await createPatient(key, input);
            setAdding(false);
            navigate(`/pacientes/${p.id}`);
          }}
        />
      )}

      {transcrevendo && <TranscreverLabModal onClose={() => setTranscrevendo(false)} />}
      {plantao && <PassagemPlantaoModal patients={patients} onClose={() => setPlantao(false)} />}
      {passeCaso && <PassagemCasoModal patient={passeCaso} onClose={() => setPasseCaso(null)} />}
    </div>
  );
}

function PatientCard({
  patient,
  openTasks,
  onOpen,
  onPasse,
  onArchive,
  onDelete,
}: {
  patient: Patient;
  openTasks: number;
  onOpen: () => void;
  onPasse: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const di = diaInternacao(patient.admissionDate);
  return (
    <div className="card flex flex-col gap-3 transition hover:border-brand/40 hover:shadow-lg hover:shadow-black/20">
      <button className="flex-1 text-left" onClick={onOpen}>
        <div className="flex items-start justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[15px] font-semibold leading-tight">
            <GenderIcon sex={patient.sex} className="text-base" /> {patient.label}
          </span>
          {openTasks > 0 && (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warn/15 px-2 py-0.5 text-xs font-medium text-warn"
              title={`${openTasks} pendência(s) aberta(s)`}
            >
              <AlertTriangle className="h-3 w-3" /> {openTasks}
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {patient.age != null && <span>{patient.age}a</span>}
          {patient.bed && (
            <span className="inline-flex items-center gap-1">
              <BedDouble className="h-3 w-3" /> {patient.bed}
            </span>
          )}
          {di != null && <span className="chip">D.I. {di}</span>}
          <span className="chip">{SETTING_LABEL[patient.setting]}</span>
        </div>
      </button>

      <div className="space-y-2 border-t border-border pt-3">
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-primary justify-center whitespace-nowrap px-2 py-1.5 text-xs" onClick={onOpen}>
            <FileText className="h-3.5 w-3.5" /> Abrir
          </button>
          <button
            className="btn-ghost justify-center whitespace-nowrap border border-border px-2 py-1.5 text-xs"
            onClick={onPasse}
          >
            <ClipboardList className="h-3.5 w-3.5" /> Passe o caso
          </button>
        </div>
        <div className="flex items-center justify-end gap-4 text-[11px] text-muted">
          <button className="inline-flex items-center gap-1 hover:text-text" onClick={onArchive}>
            <Archive className="h-3 w-3" /> {patient.active ? 'Arquivar' : 'Reativar'}
          </button>
          <button className="inline-flex items-center gap-1 hover:text-danger" onClick={onDelete}>
            <Trash2 className="h-3 w-3" /> Remover
          </button>
        </div>
      </div>
    </div>
  );
}

function AddPatientModal({
  onClose,
  onCreate,
  defaultSetting,
}: {
  onClose: () => void;
  onCreate: (input: NewPatientInput) => Promise<void>;
  defaultSetting: PatientSetting;
}) {
  const [label, setLabel] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Patient['sex']>(null);
  const [setting, setSetting] = useState<PatientSetting>(defaultSetting);
  const [admissionDate, setAdmissionDate] = useState('');
  const [bed, setBed] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setBusy(true);
    try {
      await onCreate({
        label,
        age: age ? Number(age) : null,
        sex,
        setting,
        admissionDate: admissionDate || null,
        bed: bed || null,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Novo paciente" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">Apelido / iniciais + leito *</label>
          <input
            className="input"
            placeholder="Ex.: Leito 12 - J.Q."
            value={label}
            autoFocus
            onChange={(e) => setLabel(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted">
            Nunca use nome completo, CPF ou nº de prontuário.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Idade</label>
            <input
              className="input"
              inputMode="numeric"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Sexo</label>
            <select
              className="input"
              value={sex ?? ''}
              onChange={(e) => setSex((e.target.value || null) as Patient['sex'])}
            >
              <option value="">—</option>
              <option value="M">M</option>
              <option value="F">F</option>
              <option value="outro">outro</option>
            </select>
          </div>
          <div>
            <label className="label">Data de admissão</label>
            <input
              className="input"
              type="date"
              value={admissionDate}
              onChange={(e) => setAdmissionDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Leito</label>
            <input className="input" value={bed} onChange={(e) => setBed(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Cenário</label>
            <select
              className="input"
              value={setting}
              onChange={(e) => setSetting(e.target.value as PatientSetting)}
            >
              <option value="enfermaria">Enfermaria</option>
              <option value="uti">UTI</option>
              <option value="ambulatorio">Ambulatório</option>
              <option value="psf">PSF</option>
            </select>
            <p className="mt-1 text-xs text-muted">Define o estilo da anamnese e da evolução.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={busy || !label.trim()}>
            Criar e abrir
          </button>
        </div>
      </form>
    </Modal>
  );
}
