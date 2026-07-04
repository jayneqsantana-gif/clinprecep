import { useState } from 'react';
import { Calculator, ChevronDown, ChevronRight } from 'lucide-react';
import {
  CALCULATORS,
  ckdEpi2021,
  gfrStage,
  meldNa,
  type ChecklistScore,
  type RadioScore,
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
            <button className="flex w-full items-center gap-2 text-left" onClick={() => setOpen(open === c.id ? null : c.id)}>
              {open === c.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <div className="flex-1">
                <span className="font-semibold">{c.name}</span>
                <p className="text-xs text-muted">{c.desc}</p>
              </div>
            </button>
            {open === c.id && (
              <div className="mt-3 border-t border-border pt-3">
                {c.kind === 'checklist' && <Checklist calc={c} />}
                {c.kind === 'radios' && <Radios calc={c} />}
                {c.kind === 'ckdepi' && <CkdEpi />}
                {c.kind === 'meld' && <Meld />}
                <p className="mt-3 text-[11px] text-muted">Fonte: {c.source}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Result({ level, children, copy }: { level: Level; children: React.ReactNode; copy?: string }) {
  return (
    <>
      <div className={`rounded-lg border p-3 text-sm ${levelClass[level]}`}>{children}</div>
      {copy && <CopyButton text={copy} label="Copiar resultado" />}
    </>
  );
}

function Checklist({ calc }: { calc: ChecklistScore }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const score = calc.items.reduce((s, i) => s + (checked.has(i.key) ? i.points : 0), 0);
  const r = calc.interpret(score, checked);

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
                onChange={() =>
                  setChecked((prev) => {
                    const n = new Set(prev);
                    n.has(i.key) ? n.delete(i.key) : n.add(i.key);
                    return n;
                  })
                }
              />
              <span className="flex-1">{i.label}</span>
              <span className="text-xs text-muted">{i.points > 0 ? `+${i.points.toLocaleString('pt-BR')}` : i.points.toLocaleString('pt-BR')}</span>
            </label>
          </li>
        ))}
      </ul>
      <Result level={r.level} copy={`${calc.name}: ${score.toLocaleString('pt-BR')} ponto(s) — ${r.text}`}>
        <p className="font-semibold">{score.toLocaleString('pt-BR')} ponto(s)</p>
        <p>{r.text}</p>
      </Result>
    </div>
  );
}

function Radios({ calc }: { calc: RadioScore }) {
  const [sel, setSel] = useState<Record<string, number>>(
    Object.fromEntries(calc.groups.map((g) => [g.key, 0])),
  );
  const score = calc.groups.reduce((s, g) => s + g.options[sel[g.key]].points, 0);
  const r = calc.interpret(score);

  return (
    <div className="space-y-3">
      {calc.groups.map((g) => (
        <div key={g.key}>
          <p className="mb-1 text-sm font-medium">{g.label}</p>
          <div className="flex flex-wrap gap-1">
            {g.options.map((o, idx) => (
              <button
                key={idx}
                onClick={() => setSel((p) => ({ ...p, [g.key]: idx }))}
                className={`chip cursor-pointer ${sel[g.key] === idx ? 'border-brand text-brand' : ''}`}
              >
                {o.label} <span className="text-muted">({o.points})</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <Result level={r.level} copy={`${calc.name}: ${score} pontos — ${r.text}`}>
        <p className="font-semibold">{score} pontos</p>
        <p>{r.text}</p>
      </Result>
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

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Creatinina (mg/dL)" value={cr} onChange={setCr} placeholder="Ex.: 1,2" decimal />
        <Field label="Idade (anos)" value={idade} onChange={setIdade} placeholder="Ex.: 63" />
      </div>
      <Check label="Sexo feminino" checked={fem} onChange={setFem} />
      {egfr != null && st && (
        <Result level={st.level} copy={`TFG (CKD-EPI 2021): ${fmtNum(egfr)} mL/min/1,73m² — estágio ${st.stage}. ${st.text}`}>
          <p className="font-semibold">TFG estimada: {fmtNum(egfr)} mL/min/1,73m² — estágio {st.stage}</p>
          <p>{st.text}</p>
        </Result>
      )}
      {!valido && (cr || idade) && <p className="text-xs text-muted">Preencha creatinina e idade (≥ 18 anos).</p>}
    </div>
  );
}

function Meld() {
  const [bili, setBili] = useState('');
  const [inr, setInr] = useState('');
  const [cr, setCr] = useState('');
  const [na, setNa] = useState('');
  const [dial, setDial] = useState(false);
  const b = parseNum(bili), i = parseNum(inr), c = parseNum(cr), n = parseNum(na);
  const valido = b != null && i != null && c != null && n != null;
  const res = valido ? meldNa(b, i, c, n, dial) : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bilirrubina total (mg/dL)" value={bili} onChange={setBili} placeholder="Ex.: 2,5" decimal />
        <Field label="INR" value={inr} onChange={setInr} placeholder="Ex.: 1,8" decimal />
        <Field label="Creatinina (mg/dL)" value={cr} onChange={setCr} placeholder="Ex.: 1,6" decimal />
        <Field label="Sódio (mEq/L)" value={na} onChange={setNa} placeholder="Ex.: 132" />
      </div>
      <Check label="Diálise ≥ 2×/semana (trava Cr em 4)" checked={dial} onChange={setDial} />
      {res && (
        <Result level={res.level} copy={res.text}>
          <p className="font-semibold">MELD-Na: {res.meld}</p>
          <p>{res.text}</p>
        </Result>
      )}
      {!valido && (bili || inr || cr || na) && <p className="text-xs text-muted">Preencha bilirrubina, INR, creatinina e sódio.</p>}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, decimal }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; decimal?: boolean }) {
  return (
    <div>
      <label className="label text-xs">{label}</label>
      <input className="input" inputMode={decimal ? 'decimal' : 'numeric'} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
