/**
 * Estado de autenticação (Supabase). Controla QUEM é o usuário (login do médico).
 * A criptografia dos dados é separada (ver store/session.ts) — o login não dá
 * acesso ao conteúdo do paciente sem o PIN.
 */
import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  ready: boolean;
  error: string | null;
  init: () => void;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<{ ok: boolean; needsConfirm: boolean }>;
  signOut: () => Promise<void>;
}

let subscribed = false;

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,
  error: null,

  init() {
    void supabase.auth.getSession().then(({ data }) => {
      set({ user: data.session?.user ?? null, ready: true });
    });
    if (!subscribed) {
      subscribed = true;
      // O Supabase dispara este callback ao focar a janela / renovar o token,
      // com um NOVO objeto `user`. Se o id não mudou, mantemos a MESMA referência
      // para não re-inicializar a sessão e remontar a tela (perdendo aba/texto).
      supabase.auth.onAuthStateChange((_event, session) => {
        const next = session?.user ?? null;
        set((s) => (s.user?.id === next?.id ? { ready: true } : { user: next, ready: true }));
      });
    }
  },

  async signIn(email, password) {
    set({ error: null });
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      set({ error: traduzir(error.message) });
      return false;
    }
    return true;
  },

  async signUp(email, password) {
    set({ error: null });
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) {
      set({ error: traduzir(error.message) });
      return { ok: false, needsConfirm: false };
    }
    // Se o projeto exige confirmação de e-mail, não há sessão ainda.
    return { ok: true, needsConfirm: !data.session };
  },

  async signOut() {
    await supabase.auth.signOut();
    set({ user: null });
  },
}));

function traduzir(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/already registered/i.test(msg)) return 'Este e-mail já está cadastrado.';
  if (/password should be at least/i.test(msg)) return 'A senha é muito curta (mínimo 6 caracteres).';
  return msg;
}
