import { useEffect, useState } from 'react';
import { useSession } from '@/store/session';
import { getAnamnesis, listEvolutions } from '@/lib/remoteRepo';
import { buildPatientContext } from '@/lib/context';
import type { Patient, Anamnesis, Evolution } from '@/lib/types';

/** Carrega anamnese + última evolução e devolve o contexto do paciente p/ a IA. */
export function usePatientAiContext(patient: Patient) {
  const key = useSession((s) => s.key);
  const [anamnesis, setAnamnesis] = useState<Anamnesis | null>(null);
  const [lastEvo, setLastEvo] = useState<Evolution | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    void Promise.all([getAnamnesis(key, patient.id), listEvolutions(key, patient.id)]).then(
      ([a, evos]) => {
        if (!alive) return;
        setAnamnesis(a);
        setLastEvo(evos[0] ?? null);
        setReady(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [key, patient.id]);

  const context = () => buildPatientContext(patient, anamnesis, lastEvo);
  return { context, ready };
}
