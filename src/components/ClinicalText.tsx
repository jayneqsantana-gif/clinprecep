/**
 * Renderiza a anamnese/evolução EXATAMENTE como o texto que será colado no
 * prontuário — verbatim, preservando os cabeçalhos com "#", quebras de linha e
 * espaçamento. Só o **negrito** vira destaque visual (dado presumido/complementado);
 * ao copiar, os marcadores ** são removidos para o texto sair limpo.
 */

/** Remove os marcadores ** para copiar/colar limpo no prontuário. */
export function stripBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1');
}

export function ClinicalText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*\n]+\*\*)/g);
  return (
    <div className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-text">
      {parts.map((p, i) => {
        const m = p.match(/^\*\*([^*\n]+)\*\*$/);
        return m ? (
          <strong key={i} className="font-semibold text-warn">
            {m[1]}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        );
      })}
    </div>
  );
}
