import { useEffect, useState } from 'react';
import { LogIn, FileText } from 'lucide-react';
import { useSession } from '@/store/session';
import { listEvolutions } from '@/lib/remoteRepo';
import { fmtBR } from '@/lib/dates';
import type { Patient, Evolution } from '@/lib/types';

interface Event {
  date: string;
  label: string;
  icon: 'admissao' | 'evolucao';
}

/** Linha do tempo do caso: admissão + evoluções salvas (seção 7.4). */
export function TimelineCard({ patient }: { patient: Patient }) {
  const key = useSession((s) => s.key);
  const [evos, setEvos] = useState<Evolution[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!key) return;
    void listEvolutions(key, patient.id).then((e) => {
      setEvos(e);
      setLoaded(true);
    });
  }, [key, patient.id]);

  const events: Event[] = [];
  if (patient.admissionDate) events.push({ date: patient.admissionDate, label: 'Admissão', icon: 'admissao' });
  for (const e of evos) events.push({ date: e.date, label: 'Evolução', icon: 'evolucao' });
  events.sort((a, b) => (a.date < b.date ? 1 : -1)); // mais recente no topo

  if (!loaded) return null;
  if (events.length === 0) return null;

  return (
    <div className="card">
      <h2 className="mb-3 font-semibold">Linha do tempo</h2>
      <ol className="relative space-y-3 border-l border-border pl-5">
        {events.map((ev, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[26px] flex h-5 w-5 items-center justify-center rounded-full bg-surface-2 text-brand">
              {ev.icon === 'admissao' ? <LogIn className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
            </span>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{ev.label}</span>
              <span className="text-muted">{fmtBR(ev.date)}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
