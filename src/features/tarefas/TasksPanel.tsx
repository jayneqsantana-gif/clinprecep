import { useEffect, useState } from 'react';
import { ListChecks, Plus, Trash2, AlertTriangle, Check } from 'lucide-react';
import { useSession } from '@/store/session';
import { listTasks, createTask, setTaskDone, deleteTask } from '@/lib/remoteRepo';
import { fmtBR } from '@/lib/dates';
import type { Patient, Task } from '@/lib/types';

/** Pendências do paciente (seção 7 / rede de segurança). */
export function TasksPanel({ patient }: { patient: Patient }) {
  const key = useSession((s) => s.key);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [desc, setDesc] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [due, setDue] = useState('');

  async function refresh() {
    if (!key) return;
    setTasks(await listTasks(key, patient.id));
    setLoaded(true);
  }
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, patient.id]);

  async function add() {
    if (!key || !desc.trim()) return;
    await createTask(key, { patientId: patient.id, description: desc, urgent, dueDate: due || null });
    setDesc('');
    setUrgent(false);
    setDue('');
    await refresh();
  }

  const abertas = tasks.filter((t) => !t.done).length;

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <ListChecks className="h-4 w-4 text-brand" /> Pendências
        </h2>
        {abertas > 0 && <span className="chip">{abertas} aberta{abertas > 1 ? 's' : ''}</span>}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1">
          <input
            className="input"
            placeholder="Nova pendência (ex.: ajustar dose por TFG)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
        </div>
        <input
          className="input w-36"
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          title="Prazo (opcional)"
        />
        <button
          className={`chip cursor-pointer ${urgent ? 'border-danger text-danger' : ''}`}
          onClick={() => setUrgent((v) => !v)}
          title="Marcar como urgente"
        >
          <AlertTriangle className="h-3.5 w-3.5" /> Urgente
        </button>
        <button className="btn-primary" disabled={!desc.trim()} onClick={add}>
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </div>

      {!loaded ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma pendência.</p>
      ) : (
        <ul className="space-y-1">
          {tasks.map((t) => (
            <li
              key={t.id}
              className={`flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-sm ${
                t.done ? 'opacity-50' : ''
              }`}
            >
              <button
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                  t.done ? 'border-ok bg-ok text-white' : 'border-border'
                }`}
                onClick={async () => {
                  if (!key) return;
                  await setTaskDone(key, t, !t.done);
                  await refresh();
                }}
                aria-label={t.done ? 'Reabrir' : 'Concluir'}
              >
                {t.done && <Check className="h-3.5 w-3.5" />}
              </button>
              <span className={`flex-1 ${t.done ? 'line-through' : ''}`}>{t.description}</span>
              {t.urgent && !t.done && <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />}
              {t.dueDate && <span className="chip text-[10px]">{fmtBR(t.dueDate)}</span>}
              <button
                className="btn-ghost px-1.5 py-1 text-danger"
                onClick={async () => {
                  await deleteTask(t.id);
                  await refresh();
                }}
                aria-label="Excluir"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
