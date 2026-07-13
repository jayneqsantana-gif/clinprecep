import type { Problem } from '@/lib/types';

/**
 * Seletor de alvo (problema/tema) para Diretrizes e Diferencial: um dropdown
 * VISÍVEL com os problemas ativos + um campo de texto para refinar/digitar um
 * tópico livre. O valor efetivo é sempre o do campo de texto.
 */
export function ProblemTargetPicker({
  problems,
  value,
  onChange,
  label = 'Problema / tema',
  placeholder = 'Ex.: insuficiência cardíaca com FE reduzida',
}: {
  problems: Problem[];
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
}) {
  const ativos = problems.filter((p) => p.status === 'ativo');
  return (
    <div>
      <label className="label">{label}</label>
      {ativos.length > 0 && (
        <select
          className="input mb-2"
          value=""
          onChange={(e) => e.target.value && onChange(e.target.value)}
        >
          <option value="">— escolher da lista de problemas ({ativos.length}) —</option>
          {ativos.map((p) => (
            <option key={p.id} value={p.title}>
              {p.title}
            </option>
          ))}
        </select>
      )}
      <input
        className="input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {ativos.length === 0 && (
        <p className="mt-1 text-xs text-muted">
          Organize a anamnese na Visão Geral para extrair a lista de problemas.
        </p>
      )}
    </div>
  );
}
