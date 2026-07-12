import type { Patient } from '@/lib/types';

/** Ícone de sexo com os símbolos ♂ / ♀ (lucide não traz Mars/Venus nesta versão). */
export function GenderIcon({ sex, className = '' }: { sex: Patient['sex']; className?: string }) {
  if (sex === 'M') {
    return (
      <span className={`text-sky-500 ${className}`} title="Masculino" aria-label="Masculino">
        ♂
      </span>
    );
  }
  if (sex === 'F') {
    return (
      <span className={`text-pink-500 ${className}`} title="Feminino" aria-label="Feminino">
        ♀
      </span>
    );
  }
  if (sex === 'outro') {
    return (
      <span className={`text-muted ${className}`} title="Outro" aria-label="Outro">
        ⚧
      </span>
    );
  }
  return null;
}
