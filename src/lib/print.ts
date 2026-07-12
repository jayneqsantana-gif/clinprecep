/**
 * Impressão em folha A4 → PDF pelo diálogo do navegador (Salvar como PDF).
 * Abre uma janela isolada com CSS de impressão; não depende de biblioteca externa.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Converte um markdown simples (negrito **x**, títulos #, bullets - / —, linhas)
 * em HTML seguro para a folha de impressão.
 */
export function simpleMarkdownToHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      closeList();
      continue;
    }
    let html = escapeHtml(line);
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeList();
      const lvl = Math.min(heading[1].length + 1, 4);
      out.push(`<h${lvl}>${escapeHtml(heading[2]).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</h${lvl}>`);
      continue;
    }
    const bullet = line.match(/^\s*([-—•>])\s+(.*)$/);
    if (bullet) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      const content = escapeHtml(bullet[2]).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      out.push(`<li>${content}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${html}</p>`);
  }
  closeList();
  return out.join('\n');
}

export interface PlantaoCell {
  header: string;
  problems: string[];
  pendencias: string[];
}

/** Monta o grid (3 colunas) da passagem de plantão a partir dos dados já estruturados. */
export function plantaoGridHtml(cells: PlantaoCell[]): string {
  const cell = (c: PlantaoCell) => {
    const probs = c.problems.length
      ? `<div class="pt-probs">${c.problems.map((p, i) => `<div>P${i + 1}. ${escapeHtml(p)}</div>`).join('')}</div>`
      : '';
    const pend = c.pendencias.length
      ? `<div class="pt-pend"><div class="pt-pend-title">PENDÊNCIAS:</div>${c.pendencias
          .map((p) => `<div>- ${escapeHtml(p)}</div>`)
          .join('')}</div>`
      : '';
    return `<div class="pt-cell"><div class="pt-head">${escapeHtml(c.header)}</div><div class="pt-body">${probs}${pend}</div><div class="pt-foot"><span>Prescrição</span><span>Evolução</span><span>Exames</span></div></div>`;
  };
  // Completa a última linha com células vazias para o grid fechar bonito.
  const filled = [...cells];
  while (filled.length % 3 !== 0) filled.push({ header: '', problems: [], pendencias: [] });
  return `<div class="pt-grid">${filled.map(cell).join('')}</div>`;
}

const PRINT_CSS = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #111; font-size: 11pt; line-height: 1.4; }
  h1 { font-size: 15pt; margin: 0 0 2mm; }
  h2 { font-size: 12.5pt; margin: 4mm 0 1mm; border-bottom: 1px solid #ccc; padding-bottom: 1mm; }
  h3, h4 { font-size: 11.5pt; margin: 3mm 0 1mm; }
  p { margin: 1mm 0; }
  ul { margin: 1mm 0 1mm 5mm; padding: 0; }
  li { margin: 0.5mm 0; }
  .meta { color: #555; font-size: 9.5pt; margin-bottom: 4mm; }
  .patient { break-inside: avoid; page-break-inside: avoid; border: 1px solid #ddd; border-radius: 3mm; padding: 3mm 4mm; margin-bottom: 3mm; }
  .patient h2 { border: 0; margin-top: 0; }
  strong { font-weight: 700; }

  /* Grid da passagem de plantão (leito a leito) */
  .pt-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; border-top: 1px solid #000; border-left: 1px solid #000; }
  .pt-cell { border-right: 1px solid #000; border-bottom: 1px solid #000; display: flex; flex-direction: column; min-height: 48mm; break-inside: avoid; page-break-inside: avoid; }
  .pt-head { border-bottom: 1px solid #000; padding: 1.2mm 2mm; font-weight: 700; font-size: 9.5pt; background: #f2f2f2; }
  .pt-body { flex: 1; padding: 1.5mm 2mm; font-size: 9pt; }
  .pt-probs { margin-bottom: 1.5mm; }
  .pt-probs div, .pt-pend div { margin: 0.3mm 0; }
  .pt-pend-title { font-weight: 700; margin-top: 1mm; }
  .pt-foot { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid #000; font-size: 8pt; }
  .pt-foot span { text-align: center; padding: 1mm 0; border-right: 1px solid #ccc; }
  .pt-foot span:last-child { border-right: 0; }`;

/**
 * Imprime via IFRAME OCULTO na própria página (sem abrir pop-up — não é bloqueado
 * por bloqueadores de pop-up). O usuário escolhe "Salvar como PDF" no diálogo.
 */
export function printA4(title: string, bodyHtml: string): void {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${PRINT_CSS}</style></head><body>${bodyHtml}</body></html>`;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);

  let cleaned = false;
  let printed = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    setTimeout(() => iframe.parentNode?.removeChild(iframe), 1000);
  };

  const doPrint = () => {
    if (printed) return; // evita disparar a impressão duas vezes (onload + fallback)
    printed = true;
    const win = iframe.contentWindow;
    if (!win) {
      cleanup();
      return;
    }
    try {
      win.focus();
      win.onafterprint = cleanup;
      win.print();
    } catch {
      cleanup();
    }
    // Rede de segurança: remove o iframe mesmo que onafterprint não dispare.
    setTimeout(cleanup, 60000);
  };

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.parentNode?.removeChild(iframe);
    return;
  }
  // Escreve o conteúdo e dispara a impressão após o layout.
  iframe.onload = () => setTimeout(doPrint, 200);
  doc.open();
  doc.write(html);
  doc.close();
  // Fallback caso onload não dispare para about:blank em alguns navegadores.
  setTimeout(() => {
    if (!printed && iframe.contentWindow) doPrint();
  }, 700);
}
