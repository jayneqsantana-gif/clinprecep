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

// Modelos Gemini candidatos, em ordem: primeiro os de MAIOR cota gratuita.
// São modelos DISTINTOS (cada um tem cota separada), então ao bater o limite de
// um, o próximo ainda tem quota. O Google muda o catálogo e alguns IDs "somem"
// para chaves novas — o fallback pula qualquer 404 automaticamente.
const MODEL_CANDIDATES = [
  'gemini-2.5-flash-lite', // maior cota diária, boa qualidade
  'gemini-flash-latest', // 2.5-flash (melhor qualidade), alias sempre atual
  'gemini-2.0-flash-lite', // cota separada
  'gemini-2.0-flash', // cota separada
];
const MODEL_ALLOWLIST = new Set([...MODEL_CANDIDATES, 'gemini-2.5-flash', 'gemini-flash-lite-latest']);
// Só aceita CLINPRECEP_MODEL se for um modelo Gemini conhecido (ignora lixo antigo).
const ENV_MODEL = process.env.CLINPRECEP_MODEL;

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

  const system = systemExtra ? `${cfg.system}\n\n---\nContexto do paciente:\n${systemExtra}` : cfg.system;

  /** Monta o corpo do Gemini para um modelo específico. */
  function buildBody(useModel: string): Record<string, unknown> {
    const is20 = useModel.includes('2.0');
    const gen: Record<string, unknown> = { maxOutputTokens: cfg!.maxTokens ?? (is20 ? 8192 : 16000) };
    // "thinking" não existe/não é aceito nos modelos 2.0; nos demais desligamos
    // (respostas já estruturadas pelos prompts) para saída completa e rápida.
    if (!is20) gen.thinkingConfig = { thinkingBudget: 0 };
    const b: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: system }] },
      contents: messages!.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: toGeminiParts(m.content),
      })),
      generationConfig: gen,
    };
    if (cfg!.webSearch) b.tools = [{ googleSearch: {} }];
    return b;
  }

  // Ordem de tentativa: modelo pedido/env (se válido) primeiro, depois os candidatos.
  const tryOrder = [
    ...(model && MODEL_ALLOWLIST.has(model) ? [model] : []),
    ...(ENV_MODEL && MODEL_ALLOWLIST.has(ENV_MODEL) ? [ENV_MODEL] : []),
    ...MODEL_CANDIDATES,
  ].filter((v, i, a) => a.indexOf(v) === i);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  const send = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    let r: Awaited<ReturnType<typeof fetch>> | null = null;
    let usedModel = '';
    let lastDetail = '';
    let lastWasRateLimit = false;
    for (const m of tryOrder) {
      const url = `${API_BASE}/${encodeURIComponent(m)}:streamGenerateContent?alt=sse`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(buildBody(m)),
      });
      if (resp.ok && resp.body) {
        r = resp;
        usedModel = m;
        break;
      }
      const txt = await resp.text().catch(() => '');
      const detalhe = txt.replace(/\s+/g, ' ').slice(0, 500);
      const modeloIndisponivel = resp.status === 404 || /not found|no longer available|not supported|NOT_FOUND/i.test(txt);
      const noLimite = resp.status === 429 || resp.status === 503 || /RESOURCE_EXHAUSTED|quota|overloaded|UNAVAILABLE/i.test(txt);
      // Modelo indisponível OU no limite → tenta o próximo candidato (cada modelo
      // tem cota gratuita separada, então isso soma a capacidade de todos).
      if (modeloIndisponivel || noLimite) {
        lastDetail = detalhe;
        lastWasRateLimit = noLimite;
        console.error('[api/chat] pulando modelo:', m, resp.status, detalhe.slice(0, 100));
        continue;
      }
      // Erros que não adianta tentar outro modelo (chave, API desabilitada).
      let msg: string;
      if (/SERVICE_DISABLED|has not been used|is disabled/i.test(txt)) {
        msg =
          'A API do Gemini NÃO está habilitada no projeto da sua chave. Em aistudio.google.com/apikey crie a chave em um NOVO projeto, troque a GEMINI_API_KEY na Vercel e refaça o deploy. ' +
          `(detalhe: ${detalhe})`;
      } else if (resp.status === 403 || /API_KEY_INVALID|API key not valid|permission|PERMISSION_DENIED/i.test(txt)) {
        msg = 'Chave da IA inválida. Crie a chave em aistudio.google.com e coloque em GEMINI_API_KEY na Vercel. ' + `(${resp.status}: ${detalhe})`;
      } else {
        msg = `Falha na IA (${resp.status}): ${detalhe}`;
      }
      console.error('[api/chat] Gemini erro:', resp.status, detalhe);
      send({ type: 'error', message: msg });
      res.end();
      return;
    }

    if (!r || !r.body) {
      const msg = lastWasRateLimit
        ? 'Limite gratuito da IA atingido em todos os modelos agora. Espere ~1 minuto e tente de novo. Se persistir por muito tempo, é o limite diário da cota grátis (zera no dia seguinte).'
        : `Nenhum modelo de IA disponível para esta chave. Detalhe do Google: ${lastDetail || 'sem detalhe'}`;
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
    let gotText = false;
    let finishReason = '';
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
        if (typeof cand.finishReason === 'string') finishReason = cand.finishReason;
        const parts = (cand.content as { parts?: GeminiPart[] } | undefined)?.parts ?? [];
        for (const p of parts) {
          // Ignora partes de "pensamento" caso apareçam.
          if ((p as { thought?: boolean }).thought) continue;
          if (typeof p.text === 'string' && p.text) {
            send({ type: 'text', text: p.text });
            gotText = true;
          }
        }
        // Fontes (Google Search grounding).
        const gm = cand.groundingMetadata as
          | { groundingChunks?: { web?: { uri?: string; title?: string } }[] }
          | undefined;
        for (const gc of gm?.groundingChunks ?? []) addCitation(gc.web?.uri, gc.web?.title);
      }
    }

    // Não deixa "resposta vazia" silenciosa: se nada foi gerado, explica o porquê.
    if (!gotText) {
      let msg = 'A IA não retornou texto. Tente novamente.';
      if (/SAFETY/i.test(finishReason)) msg = 'A IA bloqueou a resposta pelo filtro de segurança. Reescreva sem termos sensíveis e tente de novo.';
      else if (/RECITATION/i.test(finishReason)) msg = 'A IA interrompeu por possível reprodução de conteúdo protegido. Tente reformular.';
      else if (/MAX_TOKENS/i.test(finishReason)) msg = 'A resposta ficou longa demais e foi cortada. Tente um pedido mais curto.';
      send({ type: 'error', message: msg });
      res.end();
      return;
    }

    if (citations.length) send({ type: 'citations', citations });
    send({ type: 'done', model: usedModel });
  } catch (err) {
    const e = err as { name?: string; message?: string };
    console.error('[api/chat] erro de IA:', e?.name, e?.message);
    send({ type: 'error', message: `Falha ao chamar a IA: ${e?.message || e?.name || 'erro desconhecido'}` });
  } finally {
    res.end();
  }
}
