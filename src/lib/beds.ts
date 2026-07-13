import type { Patient } from './types';

/**
 * Ordenação "natural" por leito: agrupa por prefixo textual (ex.: "UTI", "L"),
 * depois pelo número (12 antes de 100), depois alfabético. Leitos vazios vão ao fim.
 */
function bedKey(bed: string | null): [string, number, string] {
  const b = (bed ?? '~~~').trim();
  const m = b.match(/(\d+)/);
  return [b.replace(/\d+/g, '').toLowerCase(), m ? Number(m[1]) : Number.MAX_SAFE_INTEGER, b.toLowerCase()];
}

export function compareByBed(a: Patient, b: Patient): number {
  const [pa, na, sa] = bedKey(a.bed);
  const [pb, nb, sb] = bedKey(b.bed);
  if (pa !== pb) return pa < pb ? -1 : 1;
  if (na !== nb) return na - nb;
  if (sa !== sb) return sa < sb ? -1 : 1;
  // desempate estável: apelido
  return a.label.localeCompare(b.label, 'pt-BR');
}
