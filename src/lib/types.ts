/**
 * Modelo de dados (seção 5). Nenhum identificador direto do paciente
 * (sem nome completo, CPF, RG, nº de prontuário). Apenas label/iniciais.
 */

export type ISODate = string; // 'YYYY-MM-DD'
export type ISODateTime = string; // ISO 8601

export type ProblemStatus = 'ativo' | 'resolvido';

/** Cenário de internação — define o estilo da anamnese. */
export type PatientSetting = 'enfermaria' | 'uti' | 'ambulatorio';

export const SETTING_LABEL: Record<PatientSetting, string> = {
  enfermaria: 'Enfermaria',
  uti: 'UTI',
  ambulatorio: 'Ambulatório',
};

export interface Problem {
  id: string;
  order: number;
  title: string;
  status: ProblemStatus;
  linkedGuidelineTopic: string | null;
}

export interface Patient {
  id: string;
  label: string; // apelido/iniciais (ex.: "Leito 12 - J.Q.")
  age: number | null;
  sex: 'M' | 'F' | 'outro' | null;
  setting: PatientSetting; // enfermaria | uti | ambulatorio
  admissionDate: ISODate | null;
  bed: string | null;
  allergies: string[]; // p/ checagem de alergia na prescrição (seção 7.8)
  active: boolean; // no cardápio ou arquivado
  problemList: Problem[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Anamnesis {
  patientId: string;
  rawText: string;
  structured: Record<string, unknown>;
  createdAt: ISODateTime;
}

export interface Evolution {
  id: string;
  patientId: string;
  date: ISODate;
  dailyInput: string;
  structuredOutput: Record<string, unknown>;
  cleanVersion: string;
  createdAt: ISODateTime;
}

export interface LabValue {
  name: string;
  value: string;
  unit: string;
  flag: 'alto' | 'baixo' | 'critico' | 'normal' | null;
}

export interface LabResult {
  patientId: string;
  date: ISODate;
  values: LabValue[];
}

export interface Task {
  id: string;
  patientId: string;
  description: string;
  done: boolean;
  urgent: boolean;
  createdAt: ISODateTime;
  dueDate: ISODate | null;
}

export type CitationType = 'diretriz' | 'sociedade' | 'artigo' | 'outro';

export interface Citation {
  sourceName: string;
  url: string;
  type: CitationType;
}

export interface ChatMessage {
  id: string;
  patientId: string | null; // null = tira-dúvidas geral
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  createdAt: ISODateTime;
}

/** Preferências e estado do app (não-PHI). */
export interface Settings {
  theme: 'dark' | 'light';
  sessionTimeoutMin: number; // timeout de inatividade (seção 10.7)
  termAccepted: boolean; // aceite do termo de primeira execução
  aiModel: string; // seleção exposta pelo proxy
}
