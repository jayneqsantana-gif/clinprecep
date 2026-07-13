import { useEffect, useMemo, useState } from 'react';
import { Printer, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui';
import { useSession } from '@/store/session';
import { listTasks } from '@/lib/remoteRepo';
import { todayISO, fmtBR } from '@/lib/dates';
import { compareByBed } from '@/lib/beds';
import { printA4, plantaoGridHtml, type PlantaoCell } from '@/lib/print';
import { type Patient } from '@/lib/types';

/**
 * Passagem de plantão enxuta, leito a leito, para imprimir e levar ao leito:
 * só o crucial — leito/nome/idade, problemas ativos e pendências. Sem IA.
 */
export function PassagemPlantaoModal({ patients, onClose }: { patients: Patient[]; onClose: () => void }) {
  const key = useSession((s) => s.key);
  const [building, setBuilding] = useState(true);
  const [cells, setCells] = useState<PlantaoCell[]>([]);

  const ordered = useMemo(() => [...patients].filter((p) => p.active).sort(compareByBed), [patients]);

  useEffect(() => {
    if (!key) return;
    void (async () => {
      setBuilding(true);
      const built = await Promise.all(
        ordered.map(async (p) => {
          const tasks = await listTasks(key, p.id);
          const header =
            (p.bed ? `${p.bed} - ` : '') + p.label + (p.age != null ? ` | ${p.age}A` : '');
          return {
            header,
            problems: p.problemList.filter((pr) => pr.status === 'ativo').map((pr) => pr.title),
            pendencias: tasks.filter((t) => !t.done).map((t) => t.description),
          } as PlantaoCell;
        }),
      );
      setCells(built);
      setBuilding(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function imprimir() {
    const header = `<h1>Passagem de plantão</h1><div class="meta">${fmtBR(todayISO())} · ${ordered.length} leito(s)</div>`;
    printA4('Passagem de plantão', header + plantaoGridHtml(cells), { landscape: true });
  }

  return (
    <Modal title="Passagem de plantão" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Enxuta, leito a leito — só o crucial (problemas ativos e pendências), para imprimir e levar na visita.
        </p>

        {building ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Reunindo os {ordered.length} leitos…
          </p>
        ) : (
          <>
            {/* Prévia em tela (mesmo grid da impressão) */}
            <div className="max-h-[50vh] overflow-auto rounded-lg border border-border">
              <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
                {cells.map((c, i) => (
                  <div key={i} className="flex flex-col bg-surface text-xs">
                    <div className="border-b border-border bg-surface-2 px-2 py-1 font-semibold">{c.header}</div>
                    <div className="flex-1 space-y-1 px-2 py-1.5">
                      {c.problems.length > 0 && (
                        <div className="font-semibold">
                          {c.problems.map((p, k) => (
                            <div key={k}>
                              P{k + 1}. {p}
                            </div>
                          ))}
                        </div>
                      )}
                      {c.pendencias.length > 0 && (
                        <div>
                          <div className="font-semibold">PENDÊNCIAS:</div>
                          {c.pendencias.map((p, k) => (
                            <div key={k} className="font-normal text-muted">
                              - {p}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-3 border-t border-border text-[10px] text-muted">
                      <span className="border-r border-border py-0.5 text-center">Prescrição</span>
                      <span className="border-r border-border py-0.5 text-center">Evolução</span>
                      <span className="py-0.5 text-center">Exames</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button className="btn-primary w-full" disabled={!cells.length} onClick={imprimir}>
              <Printer className="h-4 w-4" /> Imprimir / PDF (A4)
            </button>
            <p className="text-xs text-muted">
              Já sai em <strong>paisagem</strong>, enxuto para caber em uma página. No diálogo de impressão, escolha
              “Salvar como PDF”.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
