import { BookOpen } from 'lucide-react';
import { Chat } from '@/features/duvidas/Chat';

/** Tira-dúvidas geral (seção 7.10) — chat de estudo sem paciente vinculado. */
export function StudyPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-brand" />
        <h1 className="text-xl font-bold">Tira-dúvidas geral</h1>
      </div>
      <p className="text-sm text-muted">
        Chat de estudo, sem paciente vinculado. Respostas com evidência e citações; quando incerto, sinaliza.
      </p>
      <Chat placeholder="Ex.: quando iniciar anticoagulação na FA?" />
    </div>
  );
}
