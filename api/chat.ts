/**
 * Função serverless de IA (Vercel) — agora usando o Google Gemini (camada gratuita).
 *
 * - A GEMINI_API_KEY vive só aqui no servidor; nunca vai ao cliente.
 * - Valida o usuário pelo token do Supabase antes de usar a chave.
 * - Não registra o conteúdo clínico (sem logs de payload).
 * - Faz streaming (SSE) das respostas do Gemini, no MESMO formato de eventos que
 *   o front já entende ({type:'text'|'citations'|'error'|'done'}).
 *
 * O contrato com o front é idêntico ao anterior (agent, messages, systemExtra):
 * a conversão de blocos (texto/imagem/PDF) e a busca web (Google Search grounding)
 * acontecem aqui dentro.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AGENTS } from './_agents.js';

// Streaming pode levar alguns segundos; mantém a folga do plano.
export const config = { maxDuration: 300 };

const DEFAULT_MODEL = process.env.CLINPRECEP_MODEL || 'gemini-2.5-flash';
const MODEL_ALLOWLIST = new Set(['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash']);

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ── Tipos mínimos do que recebemos do front (blocos no formato "Anthropic-like") ──
type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'document'; source: { type: 'base64'; media_type: string; data: string } };
type MsgContent = string | ContentBlock[];

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

/** Converte o conteúdo de uma mensagem (texto ou blocos) em `parts` do Gemini. */
function toGeminiParts(content: MsgContent): GeminiPart[] {
  if (typeof content === 'string') return [{ text: content }];
  const parts: GeminiPart[] = [];
  for (const b of content) {
    if (b.type === 'text') parts.push({ text: b.text });
    else if (b.type === 'image' || b.type === 'document') {
      parts.push({ inlineData: { mimeType: b.source.media_type, data: b.source.data } });
    }
  }
  return parts.length ? parts : [{ text: '' }];
}

/** Confirma que o token pertence a um usuário Supabase válido. */
async function verifyUser(token: string | undefined): Promise<boolean> {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return true; // em dev sem envs, não bloqueia
  if (!token) return false;
  try {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
    });
    return r.ok;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'IA não configurada. Defina GEMINI_API_KEY na Vercel.' });
    return;
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || undefined;
  if (!(await verifyUser(token))) {
    res.status(401).json({ error: 'Não autenticado.' });
    return;
  }

  const { agent, messages, model, systemExtra } = (req.body ?? {}) as {
    agent?: string;
    messages?: { role: 'user' | 'assistant'; content: MsgContent }[];
    model?: string;
    systemExtra?: string;
  };

  const cfg = agent ? AGENTS[agent] : undefined;
  if (!cfg) {
    res.status(400).json({ error: `Agente desconhecido: ${agent}` });
    return;
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages vazio.' });
    return;
  }

  const useModel = model && MODEL_ALLOWLIST.has(model) ? model : DEFAULT_MODEL;
  const system = systemExtra ? `${cfg.system}\n\n---\nContexto do paciente:\n${systemExtra}` : cfg.system;

  // Monta o corpo do Gemini.
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: system }] },
    // Gemini usa papéis 'user' e 'model' (assistant → model).
    contents: messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: toGeminiParts(m.content),
    })),
    generationConfig: {
      maxOutputTokens: cfg.maxTokens ?? 16000,
      // Desliga o "thinking" interno: as respostas já são estruturadas pelos prompts,
      // e isso mantém a saída completa e rápida dentro da cota gratuita.
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  if (cfg.webSearch) body.tools = [{ googleSearch: {} }];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  const send = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    const url = `${API_BASE}/${encodeURIComponent(useModel)}:streamGenerateContent?alt=sse`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    });

    if (!r.ok || !r.body) {
      const txt = await r.text().catch(() => '');
      const detalhe = txt.replace(/\s+/g, ' ').slice(0, 300);
      let msg: string;
      if (r.status === 429) {
        msg = 'Limite gratuito da IA atingido. Aguarde ~1 minuto e tente novamente.';
      } else if (r.status === 403 || /API_KEY_INVALID|API key not valid|permission|PERMISSION_DENIED|has not been used|is disabled/i.test(txt)) {
        msg =
          'Chave da IA inválida ou API não habilitada. Crie a chave em aistudio.google.com, coloque em GEMINI_API_KEY na Vercel e refaça o deploy. ' +
          `(${r.status}: ${detalhe})`;
      } else if (r.status === 404) {
        msg = `Modelo de IA indisponível para esta chave. (${r.status}: ${detalhe})`;
      } else {
        msg = `Falha na IA (${r.status}): ${detalhe}`;
      }
      console.error('[api/chat] Gemini erro:', r.status, detalhe);
      send({ type: 'error', message: msg });
      res.end();
      return;
    }

    const citations: { sourceName: string; url: string; type: string }[] = [];
    const seen = new Set<string>();
    const addCitation = (uri?: string, title?: string) => {
      if (!uri || seen.has(uri)) return;
      seen.add(uri);
      citations.push({ sourceName: title || uri, url: uri, type: 'artigo' });
    };

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // O Gemini separa eventos SSE com "\r\n\r\n"; aceitamos ambos os formatos.
      const chunks = buffer.split(/\r?\n\r?\n/);
      buffer = chunks.pop() ?? '';
      for (const chunk of chunks) {
        const line = chunk.trim();
        if (!line.startsWith('data:')) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;
        let evt: Record<string, unknown>;
        try {
          evt = JSON.parse(jsonStr);
        } catch {
          continue;
        }
        const cand = (evt.candidates as Record<string, unknown>[] | undefined)?.[0];
        if (!cand) {
          // Bloqueio de segurança do prompt?
          const pf = evt.promptFeedback as { blockReason?: string } | undefined;
          if (pf?.blockReason) send({ type: 'error', message: 'A IA recusou o pedido (filtro de conteúdo).' });
          continue;
        }
        const parts = (cand.content as { parts?: GeminiPart[] } | undefined)?.parts ?? [];
        for (const p of parts) {
          // Ignora partes de "pensamento" caso apareçam.
          if ((p as { thought?: boolean }).thought) continue;
          if (typeof p.text === 'string' && p.text) send({ type: 'text', text: p.text });
        }
        // Fontes (Google Search grounding).
        const gm = cand.groundingMetadata as
          | { groundingChunks?: { web?: { uri?: string; title?: string } }[] }
          | undefined;
        for (const gc of gm?.groundingChunks ?? []) addCitation(gc.web?.uri, gc.web?.title);
      }
    }

    if (citations.length) send({ type: 'citations', citations });
    send({ type: 'done', model: useModel });
  } catch (err) {
    const e = err as { name?: string; message?: string };
    console.error('[api/chat] erro de IA:', e?.name, e?.message);
    send({ type: 'error', message: `Falha ao chamar a IA: ${e?.message || e?.name || 'erro desconhecido'}` });
  } finally {
    res.end();
  }
}
