import { useRef, useState, useEffect } from 'react';
import { Send, Loader2, ListPlus, ExternalLink, Check } from 'lucide-react';
import { useAiStream } from '@/hooks/useAiStream';
import { Markdown } from '@/components/Markdown';
import { CopyButton } from '@/components/ui';
import type { Citation } from '@/lib/ai';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

/**
 * Chat de tira-dúvidas (seções 7.9 / 7.10). Genérico: recebe o contexto opcional
 * do paciente e, quando houver, permite transformar uma resposta em pendência.
 */
export function Chat({
  systemExtra,
  onSaveTask,
  placeholder,
}: {
  systemExtra?: () => string;
  onSaveTask?: (text: string) => Promise<void>;
  placeholder?: string;
}) {
  const ai = useAiStream();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, ai.text]);

  async function send() {
    if (!input.trim() || ai.loading) return;
    const userMsg: Msg = { role: 'user', content: input.trim() };
    const hist = [...messages, userMsg];
    setMessages(hist);
    setInput('');
    const result = await ai.run({
      agent: 'duvidas',
      systemExtra: systemExtra?.(),
      messages: hist.map((m) => ({ role: m.role, content: m.content })),
    });
    if (result != null) {
      setMessages((h) => [...h, { role: 'assistant', content: result, citations: ai.citationsRef.current }]);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-3">
        {messages.length === 0 && !ai.loading && (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
            Faça uma pergunta. As respostas citam as fontes; quando incerto, a IA sinaliza.
          </p>
        )}

        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="ml-auto max-w-[85%] rounded-lg rounded-br-sm bg-brand px-3 py-2 text-sm text-brand-fg">
              {m.content}
            </div>
          ) : (
            <AssistantBubble key={i} msg={m} onSaveTask={onSaveTask} />
          ),
        )}

        {ai.loading && (
          <div className="max-w-[95%] rounded-lg border border-border bg-surface p-3">
            {ai.text ? (
              <Markdown>{ai.text}</Markdown>
            ) : (
              <span className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> pensando…
              </span>
            )}
          </div>
        )}
        {ai.error && !ai.loading && (
          <p className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-text">
            {ai.error}
            {/não configurada|503/i.test(ai.error) && ' — a IA ainda não está ligada no servidor.'}
          </p>
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-16 flex items-end gap-2 bg-bg/80 py-1 backdrop-blur">
        <textarea
          className="input min-h-[44px] flex-1 resize-none"
          rows={1}
          placeholder={placeholder ?? 'Escreva sua pergunta…'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button className="btn-primary" disabled={!input.trim() || ai.loading} onClick={send}>
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AssistantBubble({
  msg,
  onSaveTask,
}: {
  msg: Msg;
  onSaveTask?: (text: string) => Promise<void>;
}) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="max-w-[95%] space-y-2 rounded-lg border border-border bg-surface p-3">
      <Markdown>{msg.content}</Markdown>
      {msg.citations && msg.citations.length > 0 && (
        <div className="border-t border-border pt-2">
          <p className="mb-1 text-xs font-semibold text-muted">Fontes</p>
          <ul className="space-y-1">
            {msg.citations.map((c, i) => (
              <li key={i}>
                <a href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
                  <ExternalLink className="h-3 w-3" /> {c.sourceName}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex gap-1">
        <CopyButton text={msg.content} />
        {onSaveTask && (
          <button
            className="btn-ghost text-xs"
            disabled={saved}
            onClick={async () => {
              // Vira pendência: usa a 1ª linha da resposta como descrição.
              const desc = msg.content.split('\n').find((l) => l.trim())?.slice(0, 120) ?? 'Pendência';
              await onSaveTask(desc);
              setSaved(true);
            }}
          >
            {saved ? <Check className="h-4 w-4 text-ok" /> : <ListPlus className="h-4 w-4" />}
            {saved ? 'Vira pendência' : 'Virar pendência'}
          </button>
        )}
      </div>
    </div>
  );
}
