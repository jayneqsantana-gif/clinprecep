/**
 * Cliente da função serverless de IA (/api/chat na Vercel).
 * Envia o token do Supabase (a função valida o usuário antes de chamar a IA).
 * A chave da Anthropic vive só no servidor — nunca chega aqui.
 */
import { accessToken } from './supabase';
import type { ContentBlock } from './attachments';

export type AgentName =
  | 'organizador'
  | 'laboratorio'
  | 'transcritor'
  | 'preceptor'
  | 'alta'
  | 'diferencial'
  | 'diretrizes'
  | 'atualizacoes'
  | 'prescricao'
  | 'duvidas'
  | 'passagem'
  | 'plantao';

/** Conteúdo de uma mensagem: texto simples ou blocos (texto + imagem/PDF). */
export type MsgContent = string | ContentBlock[];

export interface Citation {
  sourceName: string;
  url: string;
  type: string;
}

export interface AskParams {
  agent: AgentName;
  messages: { role: 'user' | 'assistant'; content: MsgContent }[];
  systemExtra?: string;
  model?: string;
  onText: (delta: string) => void;
  onCitations?: (c: Citation[]) => void;
  signal?: AbortSignal;
}

/** Chama a IA em streaming. Resolve quando a resposta termina. */
export async function askAgent(params: AskParams): Promise<void> {
  const token = await accessToken();
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      agent: params.agent,
      messages: params.messages,
      systemExtra: params.systemExtra,
      model: params.model,
    }),
    signal: params.signal,
  });

  if (!res.ok || !res.body) {
    const msg = await res.text().catch(() => '');
    throw new Error(msg || `Falha na IA (HTTP ${res.status}).`);
  }

  // Lê o stream SSE (eventos "data: {json}\n\n").
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';
    for (const chunk of chunks) {
      const line = chunk.trim();
      if (!line.startsWith('data:')) continue;
      const evt = JSON.parse(line.slice(5).trim());
      if (evt.type === 'text') params.onText(evt.text);
      else if (evt.type === 'citations') params.onCitations?.(evt.citations);
      else if (evt.type === 'error') throw new Error(evt.message);
    }
  }
}
