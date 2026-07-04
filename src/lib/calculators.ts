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

export interface RadioOption {
  label: string;
  points: number;
}
export interface RadioGroup {
  key: string;
  label: string;
  options: RadioOption[];
}

interface Base {
  id: string;
  name: string;
  desc: string;
  source: string;
}

export interface ChecklistScore extends Base {
  kind: 'checklist';
  items: ChecklistItem[];
  interpret: (score: number, checked: Set<string>) => { text: string; level: Level };
}

export interface RadioScore extends Base {
  kind: 'radios';
  groups: RadioGroup[];
  interpret: (score: number) => { text: string; level: Level };
}

export interface CkdScore extends Base {
  kind: 'ckdepi';
}
export interface MeldScore extends Base {
  kind: 'meld';
}

export type Calculator = ChecklistScore | RadioScore | CkdScore | MeldScore;

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
      if (s === 2) return { text: '2 pontos — risco intermediário. Considerar internação.', level: 'warn' };
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
      if (s >= limiar) return { text: `${s} pontos — anticoagulação indicada (revisar HAS-BLED/contraindicações).`, level: 'danger' };
      if (s >= consider) return { text: `${s} ponto(s) — considerar anticoagulação (individualizar).`, level: 'warn' };
      return { text: `${s} ponto(s) — baixo risco; anticoagulação não indicada de rotina.`, level: 'ok' };
    },
  },
  {
    kind: 'checklist',
    id: 'hasbled',
    name: 'HAS-BLED',
    desc: 'Risco de sangramento em anticoagulação por FA.',
    source: 'Pisters et al., Chest 2010',
    items: [
      { key: 'h', label: 'Hipertensão não controlada (PAS > 160)', points: 1 },
      { key: 'a1', label: 'Função renal alterada (diálise, transplante ou Cr > 2,26)', points: 1 },
      { key: 'a2', label: 'Função hepática alterada (cirrose ou BT > 2× / TGO-TGP > 3×)', points: 1 },
      { key: 's', label: 'AVC prévio', points: 1 },
      { key: 'b', label: 'Sangramento prévio ou predisposição', points: 1 },
      { key: 'l', label: 'INR lábil (TTR < 60%)', points: 1 },
      { key: 'e', label: 'Idade > 65 anos', points: 1 },
      { key: 'd1', label: 'Fármacos (antiplaquetário / AINE)', points: 1 },
      { key: 'd2', label: 'Álcool (≥ 8 doses/semana)', points: 1 },
    ],
    interpret: (s) =>
      s >= 3
        ? { text: `${s} pontos — alto risco de sangramento. Não contraindica anticoagular: corrigir fatores modificáveis e reavaliar.`, level: 'danger' }
        : { text: `${s} ponto(s) — risco de sangramento baixo/moderado.`, level: 'ok' },
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
        : { text: `${s} ponto(s) — baixo risco pelo qSOFA (não descarta sepse).`, level: 'ok' },
  },
  {
    kind: 'checklist',
    id: 'wellstep',
    name: 'Wells — TEP',
    desc: 'Probabilidade pré-teste de tromboembolismo pulmonar.',
    source: 'Wells, Thromb Haemost 2000',
    items: [
      { key: 'tvp', label: 'Sinais clínicos de TVP', points: 3 },
      { key: 'alt', label: 'TEP é o diagnóstico mais provável', points: 3 },
      { key: 'fc', label: 'FC > 100 bpm', points: 1.5 },
      { key: 'imo', label: 'Imobilização ≥ 3 dias ou cirurgia < 4 semanas', points: 1.5 },
      { key: 'prev', label: 'TEP/TVP prévio', points: 1.5 },
      { key: 'hem', label: 'Hemoptise', points: 1 },
      { key: 'ca', label: 'Malignidade ativa', points: 1 },
    ],
    interpret: (s) => {
      const fx = s.toLocaleString('pt-BR');
      if (s > 6) return { text: `${fx} pontos — probabilidade ALTA. Considerar angio-TC direto.`, level: 'danger' };
      if (s >= 2) return { text: `${fx} pontos — moderada. D-dímero; se positivo, imagem.`, level: 'warn' };
      return { text: `${fx} ponto(s) — baixa. D-dímero (ou PERC) para excluir.`, level: 'ok' };
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
      { key: 'acam', label: 'Acamado ≥ 3 dias ou cirurgia < 12 semanas', points: 1 },
      { key: 'dor', label: 'Dor à palpação no trajeto venoso profundo', points: 1 },
      { key: 'ede', label: 'Edema de toda a perna', points: 1 },
      { key: 'pan', label: 'Panturrilha > 3 cm que a contralateral', points: 1 },
      { key: 'cac', label: 'Edema com cacifo unilateral', points: 1 },
      { key: 'col', label: 'Veias colaterais superficiais', points: 1 },
      { key: 'prev', label: 'TVP prévia', points: 1 },
      { key: 'alt', label: 'Diagnóstico alternativo mais provável', points: -2 },
    ],
    interpret: (s) =>
      s >= 2
        ? { text: `${s} pontos — TVP PROVÁVEL. USG doppler.`, level: 'danger' }
        : { text: `${s} ponto(s) — TVP improvável. D-dímero para excluir.`, level: 'ok' },
  },
  {
    kind: 'radios',
    id: 'childpugh',
    name: 'Child-Pugh',
    desc: 'Gravidade/prognóstico da cirrose hepática.',
    source: 'Pugh et al., 1973',
    groups: [
      {
        key: 'bili',
        label: 'Bilirrubina total',
        options: [
          { label: '< 2 mg/dL', points: 1 },
          { label: '2–3 mg/dL', points: 2 },
          { label: '> 3 mg/dL', points: 3 },
        ],
      },
      {
        key: 'alb',
        label: 'Albumina',
        options: [
          { label: '> 3,5 g/dL', points: 1 },
          { label: '2,8–3,5 g/dL', points: 2 },
          { label: '< 2,8 g/dL', points: 3 },
        ],
      },
      {
        key: 'inr',
        label: 'INR',
        options: [
          { label: '< 1,7', points: 1 },
          { label: '1,7–2,3', points: 2 },
          { label: '> 2,3', points: 3 },
        ],
      },
      {
        key: 'asc',
        label: 'Ascite',
        options: [
          { label: 'Ausente', points: 1 },
          { label: 'Leve (controlada)', points: 2 },
          { label: 'Moderada a tensa', points: 3 },
        ],
      },
      {
        key: 'enc',
        label: 'Encefalopatia',
        options: [
          { label: 'Ausente', points: 1 },
          { label: 'Grau 1–2', points: 2 },
          { label: 'Grau 3–4', points: 3 },
        ],
      },
    ],
    interpret: (s) => {
      if (s <= 6) return { text: `${s} pontos — Child A (doença compensada; ~100%/85% sobrevida 1/2 anos).`, level: 'ok' };
      if (s <= 9) return { text: `${s} pontos — Child B (comprometimento significativo; ~80%/60%).`, level: 'warn' };
      return { text: `${s} pontos — Child C (descompensada; ~45%/35%). Avaliar transplante.`, level: 'danger' };
    },
  },
  {
    kind: 'meld',
    id: 'meldna',
    name: 'MELD-Na',
    desc: 'Gravidade da doença hepática terminal (priorização de transplante).',
    source: 'UNOS/OPTN 2016 (Kim et al., NEJM 2008)',
  },
  {
    kind: 'ckdepi',
    id: 'ckdepi',
    name: 'TFG — CKD-EPI 2021',
    desc: 'Taxa de filtração glomerular estimada (sem coeficiente de raça).',
    source: 'Inker et al., NEJM 2021',
  },
];

/** CKD-EPI 2021 (creatinina mg/dL, idade anos). */
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
  if (egfr >= 90) return { stage: 'G1', text: 'TFG normal ou alta (DRC G1 se houver lesão renal).', level: 'ok' };
  if (egfr >= 60) return { stage: 'G2', text: 'Levemente diminuída (DRC G2 se houver lesão renal).', level: 'ok' };
  if (egfr >= 45) return { stage: 'G3a', text: 'Leve-moderada — revisar doses de fármacos renais.', level: 'warn' };
  if (egfr >= 30) return { stage: 'G3b', text: 'Moderada-grave — ajustar doses; evitar nefrotóxicos.', level: 'warn' };
  if (egfr >= 15) return { stage: 'G4', text: 'Grave — encaminhar nefrologia; preparar TRS.', level: 'danger' };
  return { stage: 'G5', text: 'Falência renal — avaliar terapia renal substitutiva.', level: 'danger' };
}

/** MELD-Na (2016). creat/bili mg/dL, INR, Na mEq/L; dialise trava Cr em 4. */
export function meldNa(
  bili: number,
  inr: number,
  creat: number,
  na: number,
  dialise: boolean,
): { meld: number; level: Level; text: string } {
  const clamp1 = (x: number) => (x < 1 ? 1 : x);
  const b = clamp1(bili);
  const i = clamp1(inr);
  let c = clamp1(creat);
  if (dialise || c > 4) c = 4;
  let meld = Math.round((0.957 * Math.log(c) + 0.378 * Math.log(b) + 1.12 * Math.log(i) + 0.643) * 10);
  if (meld > 11) {
    const naC = Math.min(137, Math.max(125, na));
    meld = Math.round(meld + 1.32 * (137 - naC) - 0.033 * meld * (137 - naC));
  }
  meld = Math.min(40, Math.max(6, meld));
  let level: Level = 'ok';
  let text = `MELD-Na ${meld}.`;
  if (meld >= 30) { level = 'danger'; text = `MELD-Na ${meld} — mortalidade em 3 meses muito alta; prioridade em transplante.`; }
  else if (meld >= 20) { level = 'danger'; text = `MELD-Na ${meld} — mortalidade em 3 meses elevada.`; }
  else if (meld >= 15) { level = 'warn'; text = `MELD-Na ${meld} — considerar avaliação/lista de transplante.`; }
  else { text = `MELD-Na ${meld} — mortalidade em 3 meses baixa.`; }
  return { meld, level, text };
}
