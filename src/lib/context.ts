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
export function extractOrganizerJson(text: string): { problemList?: { title: string }[]; allergies?: string[] } | null {
  const m = text.match(/<json>([\s\S]*?)<\/json>/i);
  if (!m) return null;
  try {
    return JSON.parse(m[1].trim());
  } catch {
    return null;
  }
}

/** Remove o bloco <json>...</json> do texto exibido ao usuário. */
export function stripOrganizerJson(text: string): string {
  return text.replace(/<json>[\s\S]*?<\/json>/i, '').trim();
}
