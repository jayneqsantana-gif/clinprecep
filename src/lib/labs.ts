/**
 * Analitos laboratoriais para as curvas de tendência (seção 7.4).
 * Ordem canônica e faixas de referência aproximadas (adulto) apenas para
 * SINALIZAR alterações — não substituem o laudo do laboratório.
 */
export interface Analyte {
  key: string;
  label: string;
  unit: string;
  low?: number;
  high?: number;
}

export const ANALYTES: Analyte[] = [
  { key: 'hb', label: 'Hb', unit: 'g/dL', low: 12, high: 17 },
  { key: 'leuco', label: 'Leucócitos', unit: '/mm³', low: 4000, high: 11000 },
  { key: 'plaq', label: 'Plaquetas', unit: '/mm³', low: 150000, high: 450000 },
  { key: 'na', label: 'Na', unit: 'mEq/L', low: 135, high: 145 },
  { key: 'k', label: 'K', unit: 'mEq/L', low: 3.5, high: 5.0 },
  { key: 'ur', label: 'Ureia', unit: 'mg/dL', low: 15, high: 40 },
  { key: 'cr', label: 'Creatinina', unit: 'mg/dL', low: 0.6, high: 1.3 },
  { key: 'pcr', label: 'PCR', unit: 'mg/L', high: 5 },
  { key: 'glic', label: 'Glicemia', unit: 'mg/dL', low: 70, high: 140 },
];

export type Flag = 'alto' | 'baixo' | 'critico' | 'normal' | null;

export function flagFor(a: Analyte, value: number): Flag {
  if (a.high != null && value > a.high) return 'alto';
  if (a.low != null && value < a.low) return 'baixo';
  return 'normal';
}

/** Converte texto BR ("1,5" / "11.000") para número; null se vazio/inválido. */
export function parseNum(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  // Com vírgula: pontos são separador de milhar, vírgula é decimal.
  // Sem vírgula: ponto é tratado como decimal (padrão numérico do JS).
  const norm = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

/** Analitos que são CONTAGENS inteiras (ponto = separador de milhar). */
const CONTAGENS = new Set(['leuco', 'plaq']);

/**
 * Parse ciente do analito. Para contagens (leuco/plaq), "15.000" e "15000"
 * viram 15000 (ponto é milhar). Para decimais, usa parseNum.
 */
export function parseAnalyte(key: string, s: string): number | null {
  if (!CONTAGENS.has(key)) return parseNum(s);
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Formata número com vírgula decimal (padrão BR). */
export function fmtNum(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}
