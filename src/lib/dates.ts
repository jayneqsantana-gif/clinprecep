/** Utilidades de data. D.I. = dia de internação (seção 7.1 / 7.3). */

export function todayISO(): string {
  // Data LOCAL (não UTC) — evita o "+1 dia" no plantão noturno (após ~21h em
  // Brasília o toISOString já estaria no dia seguinte, quebrando D.I. e evoluções).
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Dia de internação: D1 = dia da admissão. Retorna null se sem data. */
export function diaInternacao(admissionDate: string | null, ref = todayISO()): number | null {
  if (!admissionDate) return null;
  const a = new Date(admissionDate + 'T00:00:00');
  const r = new Date(ref + 'T00:00:00');
  const diff = Math.floor((r.getTime() - a.getTime()) / 86_400_000);
  return diff >= 0 ? diff + 1 : null;
}

/** Formata data ISO -> dd/mm/aaaa (padrão BR). */
export function fmtBR(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
