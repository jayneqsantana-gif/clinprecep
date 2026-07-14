/**
 * Preferências locais NÃO-PHI (tema, timeout de sessão, aceite do termo).
 * Guardadas em localStorage — nada de conteúdo clínico aqui.
 */

const K = {
  theme: 'clinprecep.theme',
  timeout: 'clinprecep.timeoutMin',
  term: 'clinprecep.termAccepted',
  pin: 'clinprecep.pin',
} as const;

export function getTheme(): 'dark' | 'light' {
  return (localStorage.getItem(K.theme) as 'dark' | 'light') || 'dark';
}
export function setTheme(v: 'dark' | 'light') {
  localStorage.setItem(K.theme, v);
  document.documentElement.classList.toggle('dark', v === 'dark');
}

export function getTimeoutMin(): number {
  // 0 = nunca bloquear por inatividade (padrão) — trocar de janela não derruba a sessão.
  const v = localStorage.getItem(K.timeout);
  return v == null ? 0 : Number(v);
}

/** PIN lembrado neste aparelho (para não pedir toda vez). Só fica no dispositivo. */
export function getSavedPin(): string | null {
  return localStorage.getItem(K.pin);
}
export function setSavedPin(pin: string) {
  localStorage.setItem(K.pin, pin);
}
export function clearSavedPin() {
  localStorage.removeItem(K.pin);
}
export function setTimeoutMin(v: number) {
  localStorage.setItem(K.timeout, String(v));
}

export function getTermAccepted(): boolean {
  return localStorage.getItem(K.term) === '1';
}
export function setTermAccepted(v: boolean) {
  localStorage.setItem(K.term, v ? '1' : '0');
}
