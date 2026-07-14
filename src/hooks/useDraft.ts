import { useEffect, useState } from 'react';

/**
 * Rascunho persistente: guarda o que está sendo digitado no localStorage
 * (não-PHI fica só no aparelho) para não perder o texto ao trocar de janela,
 * recarregar a página ou bloquear/desbloquear. Retorna [valor, setValor, limpar].
 */
export function useDraft(key: string, initial = ''): [string, (v: string) => void, () => void] {
  const [value, setValue] = useState<string>(() => {
    try {
      return localStorage.getItem(key) ?? initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    } catch {
      /* ignora cota/indisponível */
    }
  }, [key, value]);

  const clear = () => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignora */
    }
    setValue('');
  };

  return [value, setValue, clear];
}
