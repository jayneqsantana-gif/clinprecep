/**
 * Preferências locais NÃO-PHI (tema, timeout de sessão, aceite do termo).
 * Guardadas em localStorage — nada de conteúdo clínico aqui.
 */

const K = {
  theme: 'clinprecep.theme',
  timeout: 'clinprecep.timeoutMin',
  term: 'clinprecep.termAccepted',
} as const;

export function getTheme(): 'dark' | 'light' {
  return (localStorage.getItem(K.theme) as 'dark' | 'light') || 'dark';
}
export function setTheme(v: 'dark' | 'light') {
  localStorage.setItem(K.theme, v);
  document.documentElement.classList.toggle('dark', v === 'dark');
}

export function getTimeoutMin(): number {
  const v = localStorage.getItem(K.timeout);
  return v == null ? 10 : Number(v);
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
