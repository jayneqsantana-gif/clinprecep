import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Search, BedDouble, AlertTriangle } from 'lucide-react';
import { useSession } from '@/store/session';
import {
  createPatient,
  listPatients,
  archivePatient,
  deletePatient,
  openTaskCount,
  type NewPatientInput,
} from '@/lib/remoteRepo';
import type { Patient } from '@/lib/types';
import { diaInternacao } from '@/lib/dates';
import { EmptyState, Modal } from '@/components/ui';

export function PatientsPage() {
  const key = useSession((s) => s.key);
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

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
    if (!q) return patients;
    return patients.filter(
      (p) => p.label.toLowerCase().includes(q) || (p.bed ?? '').toLowerCase().includes(q),
    );
  }, [patients, query]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Prontuários</h1>
        <button className="btn-primary" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Paciente
        </button>
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
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((p) => (
            <PatientCard
              key={p.id}
              patient={p}
              openTasks={counts[p.id] ?? 0}
              onOpen={() => navigate(`/pacientes/${p.id}`)}
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
          onClose={() => setAdding(false)}
          onCreate={async (input) => {
            const p = await createPatient(key, input);
            setAdding(false);
            navigate(`/pacientes/${p.id}`);
          }}
        />
      )}
    </div>
  );
}

function PatientCard({
  patient,
  openTasks,
  onOpen,
  onArchive,
  onDelete,
}: {
  patient: Patient;
  openTasks: number;
  onOpen: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const di = diaInternacao(patient.admissionDate);
  return (
    <div className="card flex flex-col gap-3">
      <button className="flex-1 text-left" onClick={onOpen}>
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold">{patient.label}</span>
          {openTasks > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warn/15 px-2 py-0.5 text-xs font-medium text-warn">
              <AlertTriangle className="h-3 w-3" /> {openTasks}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
          {patient.age != null && <span>{patient.age}a</span>}
          {patient.sex && <span>{patient.sex}</span>}
          {patient.bed && (
            <span className="inline-flex items-center gap-1">
              <BedDouble className="h-3 w-3" /> {patient.bed}
            </span>
          )}
          {di != null && <span className="chip">D.I. {di}</span>}
        </div>
      </button>
      <div className="flex gap-2 border-t border-border pt-2 text-xs">
        <button className="btn-ghost px-2 py-1" onClick={onArchive}>
          {patient.active ? 'Arquivar' : 'Reativar'}
        </button>
        <button className="btn-ghost px-2 py-1 text-danger" onClick={onDelete}>
          Remover
        </button>
      </div>
    </div>
  );
}

function AddPatientModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: NewPatientInput) => Promise<void>;
}) {
  const [label, setLabel] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Patient['sex']>(null);
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
