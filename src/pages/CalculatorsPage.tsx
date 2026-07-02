import { useState } from 'react';
import { Calculator, ChevronDown, ChevronRight } from 'lucide-react';
import {
  CALCULATORS,
  ckdEpi2021,
  gfrStage,
  type ChecklistScore,
  type Level,
} from '@/lib/calculators';
import { parseNum, fmtNum } from '@/lib/labs';
import { CopyButton, Disclaimer } from '@/components/ui';

const levelClass: Record<Level, string> = {
  ok: 'border-ok/40 bg-ok/10',
  warn: 'border-warn/40 bg-warn/10',
  danger: 'border-danger/40 bg-danger/10',
};

export function CalculatorsPage() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Calculator className="h-5 w-5 text-brand" />
        <h1 className="text-xl font-bold">Calculadoras / Escores</h1>
      </div>
      <Disclaimer text="Escores são apoio à decisão — interprete no contexto clínico e confira com a diretriz vigente e a preceptoria." />

      <div className="space-y-2">
        {CALCULATORS.map((c) => (
          <div key={c.id} className="card">
            <button
              className="flex w-full items-center gap-2 text-left"
              onClick={() => setOpen(open === c.id ? null : c.id)}
            >
              {open === c.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <div className="flex-1">
                <span className="font-semibold">{c.name}</span>
                <p className="text-xs text-muted">{c.desc}</p>
              </div>
            </button>
            {open === c.id && (
              <div className="mt-3 border-t border-border pt-3">
                {c.kind === 'checklist' ? <Checklist calc={c} /> : <CkdEpi />}
                <p className="mt-3 text-[11px] text-muted">Fonte: {c.source}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Checklist({ calc }: { calc: ChecklistScore }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const score = calc.items.reduce((s, i) => s + (checked.has(i.key) ? i.points : 0), 0);
  const r = calc.interpret(score, checked);
  const resultText = `${calc.name}: ${score.toLocaleString('pt-BR')} ponto(s) — ${r.text}`;

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-1">
        {calc.items.map((i) => (
          <li key={i.key}>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-surface-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[rgb(var(--brand))]"
                checked={checked.has(i.key)}
                onChange={() => toggle(i.key)}
              />
              <span className="flex-1">{i.label}</span>
              <span className="text-xs text-muted">
                {i.points > 0 ? `+${i.points.toLocaleString('pt-BR')}` : i.points.toLocaleString('pt-BR')}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className={`rounded-lg border p-3 text-sm ${levelClass[r.level]}`}>
        <p className="font-semibold">{score.toLocaleString('pt-BR')} ponto(s)</p>
        <p>{r.text}</p>
      </div>
      <CopyButton text={resultText} label="Copiar resultado" />
    </div>
  );
}

function CkdEpi() {
  const [cr, setCr] = useState('');
  const [idade, setIdade] = useState('');
  const [fem, setFem] = useState(false);

  const crN = parseNum(cr);
  const idadeN = parseNum(idade);
  const valido = crN != null && crN > 0 && idadeN != null && idadeN >= 18;
  const egfr = valido ? ckdEpi2021(crN, idadeN, fem) : null;
  const st = egfr != null ? gfrStage(egfr) : null;
  const resultText =
    egfr != null && st
      ? `TFG (CKD-EPI 2021): ${fmtNum(egfr)} mL/min/1,73m² — estágio ${st.stage}. ${st.text}`
      : '';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Creatinina (mg/dL)</label>
          <input className="input" inputMode="decimal" placeholder="Ex.: 1,2" value={cr} onChange={(e) => setCr(e.target.value)} />
        </div>
        <div>
          <label className="label">Idade (anos)</label>
          <input className="input" inputMode="numeric" placeholder="Ex.: 63" value={idade} onChange={(e) => setIdade(e.target.value)} />
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" checked={fem} onChange={(e) => setFem(e.target.checked)} />
        Sexo feminino
      </label>

      {egfr != null && st && (
        <>
          <div className={`rounded-lg border p-3 text-sm ${levelClass[st.level]}`}>
            <p className="font-semibold">
              TFG estimada: {fmtNum(egfr)} mL/min/1,73m² — estágio {st.stage}
            </p>
            <p>{st.text}</p>
          </div>
          <CopyButton text={resultText} label="Copiar resultado" />
        </>
      )}
      {!valido && (cr || idade) && (
        <p className="text-xs text-muted">Preencha creatinina e idade (≥ 18 anos) para calcular.</p>
      )}
    </div>
  );
}
