/**
 * Anexos para a IA (foto/PDF de exames e anamnese). A imagem é compactada no
 * cliente e enviada à IA apenas para leitura — NUNCA é armazenada. Guardamos só
 * o texto/dados extraídos (criptografados), preservando o modelo de privacidade.
 */

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } };

export interface Attachment {
  block: ContentBlock;
  previewUrl: string; // object URL (imagem) ou vazio (PDF)
  name: string;
  kind: 'image' | 'pdf';
  bytes: number;
}

const MAX_DIM = 1568; // resolução ótima do modelo p/ visão
const MAX_PDF_BYTES = 4 * 1024 * 1024;

function stripDataUrl(dataUrl: string): { media_type: string; data: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) throw new Error('Formato de arquivo não suportado.');
  return { media_type: m[1], data: m[2] };
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error('Falha ao ler o arquivo.'));
    r.readAsDataURL(file);
  });
}

/** Compacta uma imagem para JPEG ≤ 1568px e devolve o Attachment. */
async function imageAttachment(file: File): Promise<Attachment> {
  const dataUrl = await readAsDataURL(file);
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('Não foi possível abrir a imagem (formato não suportado?).'));
    img.src = dataUrl;
  });
  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível.');
  ctx.drawImage(img, 0, 0, w, h);
  const jpeg = canvas.toDataURL('image/jpeg', 0.82);
  const { media_type, data } = stripDataUrl(jpeg);
  return {
    block: { type: 'image', source: { type: 'base64', media_type, data } },
    previewUrl: jpeg,
    name: file.name || 'imagem.jpg',
    kind: 'image',
    bytes: Math.round((data.length * 3) / 4),
  };
}

async function pdfAttachment(file: File): Promise<Attachment> {
  if (file.size > MAX_PDF_BYTES) {
    throw new Error('PDF muito grande (máx. 4 MB). Envie páginas específicas ou uma foto.');
  }
  const dataUrl = await readAsDataURL(file);
  const { data } = stripDataUrl(dataUrl);
  return {
    block: { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } },
    previewUrl: '',
    name: file.name || 'documento.pdf',
    kind: 'pdf',
    bytes: file.size,
  };
}

/** Converte um File (imagem ou PDF) em Attachment pronto p/ a IA. */
export async function fileToAttachment(file: File): Promise<Attachment> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return pdfAttachment(file);
  }
  if (file.type.startsWith('image/')) return imageAttachment(file);
  throw new Error('Envie uma imagem (JPG/PNG) ou um PDF.');
}

/** Extrai imagens de um evento de colar (paste). */
export function imagesFromPaste(e: ClipboardEvent): File[] {
  const out: File[] = [];
  const items = e.clipboardData?.items ?? [];
  for (const it of items) {
    if (it.kind === 'file' && it.type.startsWith('image/')) {
      const f = it.getAsFile();
      if (f) out.push(f);
    }
  }
  return out;
}
