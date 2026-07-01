import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

/** Termo de primeira execução (seção 10.4). */
export function FirstRunTerm({ onAccept }: { onAccept: () => void }) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-6 p-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-8 w-8 text-brand" />
        <h1 className="text-2xl font-bold">ClinPrecep</h1>
      </div>

      <div className="card space-y-4 text-sm leading-relaxed">
        <p className="font-semibold text-text">Antes de começar, entenda:</p>
        <ul className="list-disc space-y-2 pl-5 text-muted">
          <li>
            É uma <strong className="text-text">ferramenta de apoio ao raciocínio e estudo</strong>.
            Não substitui a avaliação à beira do leito, a preceptoria nem a decisão do médico
            assistente. A responsabilidade clínica é sempre sua.
          </li>
          <li>
            <strong className="text-text">Não insira identificadores diretos</strong> do paciente
            (nome completo, CPF, RG, nº de prontuário). Use apenas apelido/iniciais e leito.
          </li>
          <li>
            Seus dados de paciente são <strong className="text-text">criptografados no seu
            dispositivo</strong> com um PIN que só você conhece. A sincronização em nuvem guarda
            apenas o conteúdo cifrado — o servidor nunca lê seus dados em claro.
          </li>
          <li>
            Todo conteúdo gerado por IA é apoio à decisão e cita as fontes; quando incerto, sinaliza.
          </li>
        </ul>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-surface-2 p-3">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 accent-[rgb(var(--brand))]"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span>Li e concordo. Assumo a responsabilidade pelo uso clínico e pela não inserção de identificadores diretos.</span>
        </label>
      </div>

      <button className="btn-primary w-full" disabled={!checked} onClick={onAccept}>
        Concordar e continuar
      </button>
    </div>
  );
}
