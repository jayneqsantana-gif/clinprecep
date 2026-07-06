import { useRef, useState } from 'react';
import { askAgent, type AgentName, type Citation, type MsgContent } from '@/lib/ai';

/**
 * Hook para chamar um agente de IA em streaming. Acumula o texto, expõe estado
 * de carregamento/erro/citações e devolve o texto final no fim de `run`.
 */
export function useAiStream() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const citationsRef = useRef<Citation[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  async function run(params: {
    agent: AgentName;
    messages: { role: 'user' | 'assistant'; content: MsgContent }[];
    systemExtra?: string;
  }): Promise<string | null> {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let acc = '';
    setText('');
    setError(null);
    setCitations([]);
    citationsRef.current = [];
    setLoading(true);
    try {
      await askAgent({
        agent: params.agent,
        messages: params.messages,
        systemExtra: params.systemExtra,
        signal: ctrl.signal,
        onText: (d) => {
          acc += d;
          setText(acc);
        },
        onCitations: (c) => {
          citationsRef.current = c;
          setCitations(c);
        },
      });
      return acc;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return null;
      setError((e as Error).message || 'Falha ao gerar a resposta de IA.');
      return null;
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    abortRef.current?.abort();
    setText('');
    setError(null);
    setCitations([]);
    setLoading(false);
  }

  return { text, loading, error, citations, citationsRef, run, reset, setText };
}
