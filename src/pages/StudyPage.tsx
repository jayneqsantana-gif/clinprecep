import { BookOpen } from 'lucide-react';
import { ComingSoon } from '@/components/ui';

export function StudyPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-brand" />
        <h1 className="text-xl font-bold">Tira-dúvidas geral</h1>
      </div>
      <ComingSoon phase="Fase 3">
        Chat de estudo sem paciente vinculado, com evidência e citações (links).
      </ComingSoon>
    </div>
  );
}
