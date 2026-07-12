import { MessagesSquare } from 'lucide-react';
import { useSession } from '@/store/session';
import { usePatientAiContext } from '@/hooks/usePatientAiContext';
import { createTask } from '@/lib/remoteRepo';
import { Chat } from './Chat';
import type { Patient } from '@/lib/types';

/** Tira-dúvidas no contexto do paciente (seção 7.9). */
export function PatientDuvidas({ patient }: { patient: Patient }) {
  const key = useSession((s) => s.key);
  const { context } = usePatientAiContext(patient);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 font-semibold">
        <MessagesSquare className="h-4 w-4 text-brand" /> Tira-dúvidas do caso
      </div>
      <Chat
        systemExtra={context}
        placeholder="Pergunte sobre este paciente…"
        persist={{ patientId: patient.id }}
        onSaveTask={async (desc) => {
          if (!key) return;
          await createTask(key, { patientId: patient.id, description: desc, urgent: false, dueDate: null });
        }}
      />
    </div>
  );
}
