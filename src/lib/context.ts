/**
 * Monta o contexto do paciente (não-identificante) para enviar aos agentes de IA
 * como `systemExtra`. Inclui idade/sexo/D.I., lista de problemas, alergias e,
 * quando houver, a anamnese estruturada e a última evolução.
 */
import type { Patient, Anamnesis, Evolution } from './types';
import { diaInternacao } from './dates';

export function buildPatientContext(
  patient: Patient,
  anamnesis?: Anamnesis | null,
  lastEvolution?: Evolution | null,
): string {
  const linhas: string[] = [];
  const di = diaInternacao(patient.admissionDate);
  linhas.push(
    `Dados: ${patient.age != null ? patient.age + ' anos' : 'idade [não informado]'}, ` +
      `sexo ${patient.sex ?? '[não informado]'}` +
      (di != null ? `, D.I. ${di}` : '') +
      (patient.admissionDate ? `, admissão ${patient.admissionDate}` : ''),
  );

  const ativos = patient.problemList.filter((p) => p.status === 'ativo');
  if (ativos.length) {
    linhas.push('Lista de problemas ativos: ' + ativos.map((p) => p.title).join('; '));
  }
  linhas.push('Alergias: ' + (patient.allergies.length ? patient.allergies.join(', ') : '[não informado]'));

  const structured = anamnesis?.structured as { text?: string } | undefined;
  if (structured?.text) {
    linhas.push('\nAnamnese estruturada:\n' + structured.text);
  }

  if (lastEvolution) {
    const out = lastEvolution.structuredOutput as { text?: string } | undefined;
    linhas.push(
      `\nÚltima evolução (${lastEvolution.date}):\n` +
        (lastEvolution.cleanVersion || out?.text || '').slice(0, 4000),
    );
  }

  return linhas.join('\n');
}

/** Extrai o bloco <json>...</json> do agente Organizador (problemList + allergies). */
export function extractOrganizerJson(
  text: string,
): { problemList?: { title: string; status?: 'ativo' | 'resolvido' }[]; allergies?: string[] } | null {
  const m = text.match(/<json>([\s\S]*?)<\/json>/i);
  if (!m) return null;
  try {
    return JSON.parse(m[1].trim());
  } catch {
    return null;
  }
}

/** Extrai o bloco <pendencias>[...]</pendencias> (lista de strings) do organizador/preceptor. */
export function extractPendencias(text: string): string[] {
  const m = text.match(/<pendencias>([\s\S]*?)<\/pendencias>/i);
  if (!m) return [];
  try {
    const arr = JSON.parse(m[1].trim());
    return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === 'string' && s.trim().length > 0) : [];
  } catch {
    return [];
  }
}

export interface ExtractedLab {
  date: string;
  values: { name: string; value: string; unit: string; flag: 'alto' | 'baixo' | 'critico' | 'normal' | null }[];
}

/** Extrai o bloco <labs>[...]</labs> do preceptor (para alimentar a curva laboratorial). */
export function extractLabs(text: string): ExtractedLab[] {
  const m = text.match(/<labs>([\s\S]*?)<\/labs>/i);
  if (!m) return [];
  try {
    const arr = JSON.parse(m[1].trim());
    return Array.isArray(arr) ? (arr as ExtractedLab[]) : [];
  } catch {
    return [];
  }
}

/** Remove todos os blocos de metadados (<json>, <pendencias>, <labs>) do texto exibido. */
export function stripOrganizerJson(text: string): string {
  return text
    .replace(/<json>[\s\S]*?<\/json>/i, '')
    .replace(/<pendencias>[\s\S]*?<\/pendencias>/i, '')
    .replace(/<labs>[\s\S]*?<\/labs>/i, '')
    .trim();
}

/**
 * Separa a saída do Organizador em: anamnese (pronta para copiar) e análise da
 * IA. O agente emite a anamnese, depois o marcador ===ANALISE===, depois a
 * análise, e por fim o <json>. Durante o streaming, se o marcador ainda não
 * apareceu, tudo é tratado como anamnese.
 */
export function parseOrganizerOutput(text: string): { anamnese: string; analysis: string } {
  const noJson = stripOrganizerJson(text);
  const idx = noJson.search(/={2,}\s*AN[ÁA]LISE\s*={2,}/i);
  if (idx === -1) return { anamnese: noJson.trim(), analysis: '' };
  const anamnese = noJson.slice(0, idx).trim();
  const analysis = noJson.slice(idx).replace(/={2,}\s*AN[ÁA]LISE\s*={2,}/i, '').trim();
  return { anamnese, analysis };
}

/**
 * Separa a análise nos 3 blocos (raciocínio, conduta, o que falta). Se os
 * marcadores "## BLOCO n" não aparecerem, devolve tudo em `raciocinio`.
 */
export function splitAnalysisBlocks(analysis: string): {
  raciocinio: string;
  conduta: string;
  oQueFalta: string;
} {
  if (!analysis.trim()) return { raciocinio: '', conduta: '', oQueFalta: '' };
  const b2 = analysis.search(/##\s*BLOCO\s*2\b/i);
  const b3 = analysis.search(/##\s*BLOCO\s*3\b/i);
  const b4 = analysis.search(/##\s*BLOCO\s*4\b/i);
  if (b2 === -1 && b3 === -1 && b4 === -1) return { raciocinio: analysis.trim(), conduta: '', oQueFalta: '' };
  const clean = (s: string) => s.replace(/^##\s*BLOCO\s*\d\s*[—-]?\s*[^\n]*\n?/i, '').trim();
  const start2 = b2 === -1 ? 0 : b2;
  const end2 = b3 !== -1 ? b3 : b4 !== -1 ? b4 : analysis.length;
  const raciocinio = clean(analysis.slice(start2, end2));
  const conduta = b3 === -1 ? '' : clean(analysis.slice(b3, b4 !== -1 ? b4 : analysis.length));
  const oQueFalta = b4 === -1 ? '' : clean(analysis.slice(b4));
  return { raciocinio, conduta, oQueFalta };
}
