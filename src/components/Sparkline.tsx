import { flagFor, fmtNum, type Analyte } from '@/lib/labs';

interface Point {
  date: string;
  value: number;
}

/** Mini-curva de tendência de um analito, com destaque do último valor alterado. */
export function Sparkline({ analyte, points }: { analyte: Analyte; points: Point[] }) {
  if (points.length === 0) return null;
  const W = 220;
  const H = 44;
  const pad = 4;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const x = (i: number) =>
    points.length === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (points.length - 1);
  const y = (v: number) => H - pad - ((v - min) / range) * (H - 2 * pad);

  const last = points[points.length - 1];
  const lastFlag = flagFor(analyte, last.value);
  const alterado = lastFlag === 'alto' || lastFlag === 'baixo';
  const color = alterado ? 'rgb(var(--danger))' : 'rgb(var(--brand))';

  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ');

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-2">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-semibold text-text">{analyte.label}</span>
        <span className={alterado ? 'font-semibold text-danger' : 'text-muted'}>
          {fmtNum(last.value)} {analyte.unit}
          {lastFlag === 'alto' && ' ↑'}
          {lastFlag === 'baixo' && ' ↓'}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" preserveAspectRatio="none">
        {points.length > 1 && (
          <polyline points={line} fill="none" stroke={color} strokeWidth="1.5" />
        )}
        {points.map((p, i) => {
          const f = flagFor(analyte, p.value);
          const alt = f === 'alto' || f === 'baixo';
          return (
            <circle
              key={i}
              cx={x(i)}
              cy={y(p.value)}
              r={i === points.length - 1 ? 3 : 2}
              fill={alt ? 'rgb(var(--danger))' : 'rgb(var(--brand))'}
            />
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-muted">
        <span>{points[0].date.slice(5)}</span>
        <span>{last.date.slice(5)}</span>
      </div>
    </div>
  );
}
