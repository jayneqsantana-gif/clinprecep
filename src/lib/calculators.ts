/**
 * Escores clínicos (seção 7.10 / Fase 4). Cálculo 100% no cliente.
 * Interpretações resumidas para uso à beira do leito — sempre conferir com a
 * diretriz vigente e a preceptoria.
 */

export type Level = 'ok' | 'warn' | 'danger';

export interface ChecklistItem {
  key: string;
  label: string;
  points: number;
}

export interface ChecklistScore {
  kind: 'checklist';
  id: string;
  name: string;
  desc: string;
  source: string;
  items: ChecklistItem[];
  interpret: (score: number, checked: Set<string>) => { text: string; level: Level };
}

export interface GfrScore {
  kind: 'ckdepi';
  id: string;
  name: string;
  desc: string;
  source: string;
}

export type Calculator = ChecklistScore | GfrScore;

export const CALCULATORS: Calculator[] = [
  {
    kind: 'checklist',
    id: 'curb65',
    name: 'CURB-65',
    desc: 'Gravidade da pneumonia adquirida na comunidade (PAC).',
    source: 'BTS/Lim et al., Thorax 2003',
    items: [
      { key: 'c', label: 'Confusão mental (desorientação recente)', points: 1 },
      { key: 'u', label: 'Ureia ≥ 50 mg/dL', points: 1 },
      { key: 'r', label: 'FR ≥ 30 irpm', points: 1 },
      { key: 'b', label: 'PAS < 90 ou PAD ≤ 60 mmHg', points: 1 },
      { key: '65', label: 'Idade ≥ 65 anos', points: 1 },
    ],
    interpret: (s) => {
      if (s <= 1) return { text: `${s} ponto(s) — baixo risco. Considerar tratamento ambulatorial.`, level: 'ok' };
      if (s === 2) return { text: '2 pontos — risco intermediário. Considerar internação (ou ambulatorial assistido).', level: 'warn' };
      return { text: `${s} pontos — alto risco. Internação; considerar UTI se 4–5.`, level: 'danger' };
    },
  },
  {
    kind: 'checklist',
    id: 'chads',
    name: 'CHA₂DS₂-VASc',
    desc: 'Risco de AVC na fibrilação atrial (indicação de anticoagulação).',
    source: 'ESC 2020/2024 (FA)',
    items: [
      { key: 'icc', label: 'IC congestiva / disfunção de VE', points: 1 },
      { key: 'has', label: 'Hipertensão arterial', points: 1 },
      { key: 'a2', label: 'Idade ≥ 75 anos', points: 2 },
      { key: 'dm', label: 'Diabetes mellitus', points: 1 },
      { key: 's2', label: 'AVC / AIT / tromboembolismo prévio', points: 2 },
      { key: 'v', label: 'Doença vascular (IAM prévio, DAP, placa aórtica)', points: 1 },
      { key: 'a1', label: 'Idade 65–74 anos', points: 1 },
      { key: 'sc', label: 'Sexo feminino', points: 1 },
    ],
    interpret: (s, checked) => {
      const fem = checked.has('sc');
      const limiar = fem ? 3 : 2;
      const consider = fem ? 2 : 1;
      if (s >= limiar) return { text: `${s} pontos — anticoagulação indicada (revisar contraindicações/HAS-BLED).`, level: 'danger' };
      if (s >= consider) return { text: `${s} ponto(s) — considerar anticoagulação (individualizar).`, level: 'warn' };
      return { text: `${s} ponto(s) — baixo risco; anticoagulação não indicada de rotina.`, level: 'ok' };
    },
  },
  {
    kind: 'checklist',
    id: 'qsofa',
    name: 'qSOFA',
    desc: 'Triagem rápida de pior prognóstico na suspeita de infecção.',
    source: 'Sepsis-3, JAMA 2016',
    items: [
      { key: 'fr', label: 'FR ≥ 22 irpm', points: 1 },
      { key: 'pas', label: 'PAS ≤ 100 mmHg', points: 1 },
      { key: 'gcs', label: 'Alteração do nível de consciência (ECG < 15)', points: 1 },
    ],
    interpret: (s) =>
      s >= 2
        ? { text: `${s} pontos — alto risco: avaliar disfunção orgânica (SOFA), lactato e cuidados intensivos.`, level: 'danger' }
        : { text: `${s} ponto(s) — baixo risco pelo qSOFA (não descarta sepse; use o contexto clínico).`, level: 'ok' },
  },
  {
    kind: 'checklist',
    id: 'wellstep',
    name: 'Wells — TEP',
    desc: 'Probabilidade pré-teste de tromboembolismo pulmonar.',
    source: 'Wells, Thromb Haemost 2000',
    items: [
      { key: 'tvp', label: 'Sinais clínicos de TVP', points: 3 },
      { key: 'alt', label: 'TEP é o diagnóstico mais provável que as alternativas', points: 3 },
      { key: 'fc', label: 'FC > 100 bpm', points: 1.5 },
      { key: 'imo', label: 'Imobilização ≥ 3 dias ou cirurgia < 4 semanas', points: 1.5 },
      { key: 'prev', label: 'TEP/TVP prévio', points: 1.5 },
      { key: 'hem', label: 'Hemoptise', points: 1 },
      { key: 'ca', label: 'Malignidade ativa (tratamento < 6 meses ou paliativo)', points: 1 },
    ],
    interpret: (s) => {
      const fx = s.toLocaleString('pt-BR');
      if (s > 6) return { text: `${fx} pontos — probabilidade ALTA. Considerar imagem (angio-TC) direto.`, level: 'danger' };
      if (s >= 2) return { text: `${fx} pontos — probabilidade moderada. D-dímero; se positivo, imagem.`, level: 'warn' };
      return { text: `${fx} ponto(s) — probabilidade baixa. D-dímero (ou PERC) para excluir.`, level: 'ok' };
    },
  },
  {
    kind: 'checklist',
    id: 'wellstvp',
    name: 'Wells — TVP',
    desc: 'Probabilidade pré-teste de trombose venosa profunda.',
    source: 'Wells, NEJM 2003',
    items: [
      { key: 'ca', label: 'Câncer ativo', points: 1 },
      { key: 'par', label: 'Paralisia/paresia ou imobilização de MMII', points: 1 },
      { key: 'acam', label: 'Acamado ≥ 3 dias ou grande cirurgia < 12 semanas', points: 1 },
      { key: 'dor', label: 'Dor à palpação no trajeto venoso profundo', points: 1 },
      { key: 'ede', label: 'Edema de toda a perna', points: 1 },
      { key: 'pan', label: 'Panturrilha > 3 cm que a contralateral', points: 1 },
      { key: 'cac', label: 'Edema com cacifo unilateral', points: 1 },
      { key: 'col', label: 'Veias colaterais superficiais (não varicosas)', points: 1 },
      { key: 'prev', label: 'TVP prévia', points: 1 },
      { key: 'alt', label: 'Diagnóstico alternativo mais provável que TVP', points: -2 },
    ],
    interpret: (s) =>
      s >= 2
        ? { text: `${s} pontos — TVP PROVÁVEL. USG doppler; considerar D-dímero conforme fluxo local.`, level: 'danger' }
        : { text: `${s} ponto(s) — TVP improvável. D-dímero para excluir.`, level: 'ok' },
  },
  {
    kind: 'ckdepi',
    id: 'ckdepi',
    name: 'TFG — CKD-EPI 2021',
    desc: 'Taxa de filtração glomerular estimada (sem coeficiente de raça).',
    source: 'Inker et al., NEJM 2021',
  },
];

/** CKD-EPI 2021 (creatinina em mg/dL, idade em anos). */
export function ckdEpi2021(creatinina: number, idade: number, feminino: boolean): number {
  const k = feminino ? 0.7 : 0.9;
  const alpha = feminino ? -0.241 : -0.302;
  const scrK = creatinina / k;
  const egfr =
    142 *
    Math.pow(Math.min(scrK, 1), alpha) *
    Math.pow(Math.max(scrK, 1), -1.2) *
    Math.pow(0.9938, idade) *
    (feminino ? 1.012 : 1);
  return Math.round(egfr * 10) / 10;
}

export function gfrStage(egfr: number): { stage: string; text: string; level: Level } {
  if (egfr >= 90) return { stage: 'G1', text: 'TFG normal ou alta (se houver lesão renal, DRC G1).', level: 'ok' };
  if (egfr >= 60) return { stage: 'G2', text: 'Levemente diminuída (DRC G2 se houver lesão renal).', level: 'ok' };
  if (egfr >= 45) return { stage: 'G3a', text: 'Diminuição leve-moderada — revisar doses de fármacos renais.', level: 'warn' };
  if (egfr >= 30) return { stage: 'G3b', text: 'Diminuição moderada-grave — ajustar doses; evitar nefrotóxicos.', level: 'warn' };
  if (egfr >= 15) return { stage: 'G4', text: 'Diminuição grave — encaminhar nefrologia; preparar TRS.', level: 'danger' };
  return { stage: 'G5', text: 'Falência renal — avaliar terapia renal substitutiva.', level: 'danger' };
}
