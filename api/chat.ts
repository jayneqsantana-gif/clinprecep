/**
 * Função serverless de IA (Vercel). Seções 4 e 8.
 *
 * - A ANTHROPIC_API_KEY vive só aqui no servidor; nunca vai ao cliente.
 * - Valida o usuário pelo token do Supabase antes de gastar a chave.
 * - Não registra o conteúdo clínico (sem logs de payload).
 * - Faz streaming (SSE) das respostas da Anthropic.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { AGENTS } from './_agents.js';

export const config = { maxDuration: 60 };

const DEFAULT_MODEL = process.env.CLINPRECEP_MODEL || 'claude-sonnet-5';
const MODEL_ALLOWLIST = new Set(['claude-sonnet-5', 'claude-opus-4-8', 'claude-haiku-4-5']);

function webSearchTool(model: string, maxUses: number) {
  const type = model === 'claude-haiku-4-5' ? 'web_search_20250305' : 'web_search_20260209';
  return { type, name: 'web_search', max_uses: maxUses };
}

/** Confirma que o token pertence a um usuário Supabase válido. */
async function verifyUser(token: string | undefined): Promise<boolean> {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  // Em dev sem envs de Supabase no servidor, não bloqueia.
  if (!url || !anon) return true;
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'IA não configurada. Defina ANTHROPIC_API_KEY na Vercel.' });
    return;
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || undefined;
  if (!(await verifyUser(token))) {
    res.status(401).json({ error: 'Não autenticado.' });
    return;
  }

  const { agent, messages, model, systemExtra } = (req.body ?? {}) as {
    agent?: string;
    messages?: { role: 'user' | 'assistant'; content: string }[];
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
  const tools = cfg.webSearch ? [webSearchTool(useModel, cfg.maxUses ?? 5)] : undefined;
  const maxTokens = cfg.maxTokens ?? 16000;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  const send = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const client = new Anthropic({ apiKey });

  try {
    // A tipagem do SDK 0.65 é anterior a `adaptive` e `output_config`; enviamos
    // assim mesmo (a API aceita em runtime) e evitamos o erro de compilação.
    const streamBody = {
      model: useModel,
      max_tokens: maxTokens,
      thinking: { type: 'adaptive' },
      output_config: { effort: cfg.effort },
      system,
      tools,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    };
    const stream = client.messages.stream(streamBody as never);

    stream.on('text', (delta: string) => send({ type: 'text', text: delta }));

    const final = await stream.finalMessage();
    const citations = extractCitations(final);
    if (citations.length) send({ type: 'citations', citations });
    send({ type: 'done', model: useModel, stopReason: final.stop_reason });
  } catch (err) {
    const e = err as { name?: string; message?: string };
    console.error('[api/chat] erro de IA:', e?.name, e?.message);
    send({ type: 'error', message: 'Falha ao gerar a resposta de IA.' });
  } finally {
    res.end();
  }
}

function extractCitations(message: { content?: unknown[] }) {
  const out: { sourceName: string; url: string; type: string }[] = [];
  const seen = new Set<string>();
  const push = (url?: string, name?: string, type = 'artigo') => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push({ sourceName: name || url, url, type });
  };
  for (const block of (message?.content ?? []) as Record<string, unknown>[]) {
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const r of block.content as Record<string, unknown>[]) {
        if (r?.type === 'web_search_result') push(r.url as string, r.title as string);
      }
    }
    if (block.type === 'text' && Array.isArray(block.citations)) {
      for (const c of block.citations as Record<string, unknown>[]) {
        push(c.url as string, (c.title || c.document_title) as string);
      }
    }
  }
  return out;
}
