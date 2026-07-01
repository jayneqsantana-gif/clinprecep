import { Calculator } from 'lucide-react';
import { ComingSoon } from '@/components/ui';

export function CalculatorsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Calculator className="h-5 w-5 text-brand" />
        <h1 className="text-xl font-bold">Calculadoras / Escores</h1>
      </div>
      <ComingSoon phase="Fase 4">
        Biblioteca de escores clínicos (CHA₂DS₂-VASc, CURB-65, Wells, TFG…) com input e interpretação.
      </ComingSoon>
    </div>
  );
}
