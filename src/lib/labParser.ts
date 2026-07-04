/**
 * Extração de exames a partir de texto colado (Fase 4, refino).
 * Determinístico e 100% no cliente — o residente revisa antes de salvar.
 * Reconhece os analitos das curvas por nome/sinônimos comuns em laudos BR.
 */

// Analitos que são CONTAGENS inteiras (ponto = separador de milhar).
const CONTAGENS = new Set(['leuco', 'plaq']);

// Sinônimos por analito (case-insensitive). O 1º grupo captura o número logo após.
const PADROES: Record<string, RegExp[]> = {
  hb: [/\b(?:hb|hemoglobina)\b/],
  leuco: [/\b(?:leuco(?:cito)?s?|leucometria|gb)\b/],
  plaq: [/\b(?:plaq(?:uetas)?|plt)\b/],
  na: [/\b(?:na|s[oó]dio)\b/],
  k: [/\b(?:k|pot[aá]ssio)\b/],
  ur: [/\b(?:ur(?:eia)?|bun)\b/],
  cr: [/\b(?:cr|creat(?:inina)?)\b/],
  pcr: [/\b(?:pcr|prote[ií]na\s+c\s+reativa)\b/],
  glic: [/\b(?:glic(?:emia|ose)?|gli)\b/],
};

/** Normaliza um token numérico BR para string numérica, ciente do tipo do analito. */
function normalize(raw: string, isCount: boolean): string | null {
  let t = raw.trim();
  if (!t) return null;
  if (isCount) {
    // contagem: remove separadores; se tiver vírgula decimal, arredonda depois.
    t = t.replace(/\./g, '').replace(',', '.');
    const n = Number(t);
    return Number.isFinite(n) ? String(Math.round(n)) : null;
  }
  // decimal: vírgula é decimal; ponto pode ser milhar ou decimal.
  const norm = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = Number(norm);
  return Number.isFinite(n) ? String(n) : null;
}

/**
 * Varre o texto e devolve { analitoKey: valorString } para o que reconhecer.
 * Estratégia: para cada analito, procura o rótulo e captura o 1º número que
 * aparece logo depois (aceitando ":", "=", "-" e espaços entre eles).
 */
export function parseLabText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!text.trim()) return out;

  for (const [key, regexes] of Object.entries(PADROES)) {
    for (const rx of regexes) {
      // rótulo, separadores opcionais, depois o número (sem capturar
      // pontuação de lista à direita, ex.: "13.5," não pode virar "135").
      const full = new RegExp(rx.source + String.raw`\s*[:=\-]?\s*([0-9]+(?:[.,][0-9]+)*)`, 'i');
      const m = full.exec(text);
      if (m && m[1]) {
        const val = normalize(m[1], CONTAGENS.has(key));
        if (val != null) {
          out[key] = val;
          break;
        }
      }
    }
  }
  return out;
}
