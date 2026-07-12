import { useEffect, useMemo, useState } from 'react';
import { Printer, Sparkles, Loader2 } from 'lucide-react';
import { Modal, CopyButton } from '@/components/ui';
import { AiOutput } from '@/components/AiOutput';
import { useSession } from '@/store/session';
import { useAiStream } from '@/hooks/useAiStream';
import { getAnamnesis, listEvolutions, listTasks } from '@/lib/remoteRepo';
import { diaInternacao, todayISO, fmtBR } from '@/lib/dates';
import { printA4, simpleMarkdownToHtml } from '@/lib/print';
import { SETTING_LABEL, type Patient } from '@/lib/types';

/** Ordena por leito de forma "natural" (12 antes de 100; texto alfabético). */
function bedKey(bed: string | null): [string, number, string] {
  const b = (bed ?? '~').trim();
  const m = b.match(/(\d+)/);
  return [b.replace(/\d+/g, '').toLowerCase(), m ? Number(m[1]) : Number.MAX_SAFE_INTEGER, b.toLowerCase()];
}

function cmpBed(a: Patient, b: Patient): number {
  const [pa, na, sa] = bedKey(a.bed);
  const [pb, nb, sb] = bedKey(b.bed);
  return pa < pb ? -1 : pa > pb ? 1 : na - nb || (sa < sb ? -1 : sa > sb ? 1 : 0);
}

export function PassagemPlantaoModal({ patients, onClose }: { patients: Patient[]; onClose: () => void }) {
  const key = useSession((s) => s.key);
  const ai = useAiStream();
  const [building, setBuilding] = useState(true);
  const [input, setInput] = useState('');

  const ordered = useMemo(() => [...patients].filter((p) => p.active).sort(cmpBed), [patients]);

  useEffect(() => {
    if (!key) return;
    void (async () => {
      setBuilding(true);
      const blocks = await Promise.all(
        ordered.map(async (p) => {
          const [a, evos, tasks] = await Promise.all([
            getAnamnesis(key, p.id),
            listEvolutions(key, p.id),
            listTasks(key, p.id),
          ]);
          const di = diaInternacao(p.admissionDate);
          const problems = p.problemList
            .filter((pr) => pr.status === 'ativo')
            .map((pr) => pr.title)
            .join('; ');
          const anamText = (a?.structured as { text?: string } | undefined)?.text ?? '';
          const lastEvo = evos[0]?.cleanVersion || (evos[0]?.structuredOutput as { text?: string })?.text || '';
          const pend = tasks.filter((t) => !t.done).map((t) => t.description).join('; ');
          return [
            `### Leito ${p.bed ?? '—'} — ${p.label} (${p.age ?? '—'} anos) — ${SETTING_LABEL[p.setting]}${
              di != null ? ` — D.I. ${di}` : ''
            }`,
            problems && `Problemas ativos: ${problems}`,
            p.allergies.length && `Alergias: ${p.allergies.join(', ')}`,
            anamText && `Anamnese: ${anamText.slice(0, 1800)}`,
            lastEvo && `Última evolução: ${lastEvo.slice(0, 1200)}`,
            pend && `Pendências: ${pend}`,
          ]
            .filter(Boolean)
            .join('\n');
        }),
      );
      setInput(blocks.join('\n\n---\n\n'));
      setBuilding(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  async function gerar() {
    if (!input) return;
    await ai.run({
      agent: 'plantao',
      messages: [
        {
          role: 'user',
          content:
            `Gere a passagem de plantão de ${ordered.length} paciente(s), ordenada por leito, para impressão em A4. ` +
            `Data: ${fmtBR(todayISO())}.\n\nPacientes:\n\n${input}`,
        },
      ],
    });
  }

  function imprimir() {
    const header = `<h1>Passagem de plantão</h1><div class="meta">${fmtBR(todayISO())} · ${ordered.length} paciente(s)</div>`;
    printA4('Passagem de plantão', header + simpleMarkdownToHtml(ai.text));
  }

  return (
    <Modal title="Gerar passagem de plantão" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Resumo de todos os pacientes ativos, ordenado por leito, com problemas, medicações-chave e o
          laboratório/sinais relevantes — pronto para imprimir em folha A4.
        </p>
        {building ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Reunindo os {ordered.length} pacientes…
          </p>
        ) : (
          <button className="btn-primary" disabled={ai.loading || !input} onClick={gerar}>
            <Sparkles className="h-4 w-4" /> {ai.loading ? 'Gerando…' : 'Gerar passagem'}
          </button>
        )}
        <AiOutput text={ai.text} loading={ai.loading} error={ai.error} />
        {ai.text && !ai.loading && (
          <div className="flex gap-2">
            <CopyButton text={ai.text} label="Copiar" />
            <button className="btn-ghost border border-border" onClick={imprimir}>
              <Printer className="h-4 w-4" /> Imprimir / PDF (A4)
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
