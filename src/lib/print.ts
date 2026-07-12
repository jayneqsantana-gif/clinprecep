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

export function printA4(title: string, bodyHtml: string): void {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1200');
  if (!win) {
    alert('O navegador bloqueou a janela de impressão. Permita pop-ups para gerar o PDF.');
    return;
  }
  const doc = win.document;
  doc.open();
  doc.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
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
  @media print { .noprint { display: none; } }
</style></head><body>
${bodyHtml}
<div class="noprint" style="margin-top:8mm;text-align:center;color:#666;font-size:9pt">
  Use “Salvar como PDF” no destino da impressão. Esta janela pode ser fechada depois.
</div>
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };</script>
</body></html>`);
  doc.close();
}
