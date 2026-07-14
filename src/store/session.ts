/**
 * Estado da "sessão de criptografia" (Zustand). Guarda a CryptoKey do vault
 * APENAS em memória. O salt e o verifier ficam na tabela `user_crypto` do
 * Supabase (não são segredos — o salt é público e o verifier é um cifrado que
 * só confirma se o PIN bate). A chave em si NUNCA vai ao servidor.
 *
 * Bloquear = descartar a chave. Timeout de inatividade em prefs (localStorage).
 */

import { create } from 'zustand';
import {
  deriveKey,
  makeVerifier,
  checkVerifier,
  randomSaltB64,
  type Cipher,
} from '@/lib/crypto';
import { supabase } from '@/lib/supabase';
import { getTimeoutMin, getSavedPin, setSavedPin, clearSavedPin } from '@/lib/prefs';

type Status = 'idle' | 'loading' | 'needs-setup' | 'locked' | 'unlocked';

interface SessionState {
  status: Status;
  key: CryptoKey | null;
  error: string | null;
  userId: string | null;
  salt: string | null;
  verifier: Cipher | null;

  initForUser: (userId: string) => Promise<void>;
  setupPin: (pin: string) => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
  reset: () => void;
  touch: () => void;
}

let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

export const useSession = create<SessionState>((set, get) => {
  function armTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    const mins = getTimeoutMin();
    if (mins <= 0) return;
    inactivityTimer = setTimeout(() => get().lock(), mins * 60_000);
  }

  return {
    status: 'idle',
    key: null,
    error: null,
    userId: null,
    salt: null,
    verifier: null,

    async initForUser(userId: string) {
      set({ status: 'loading', userId });
      const { data, error } = await supabase
        .from('user_crypto')
        .select('salt, verifier')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        set({ status: 'needs-setup', error: 'Não foi possível ler as credenciais locais.' });
        return;
      }
      if (!data) {
        set({ status: 'needs-setup', salt: null, verifier: null });
        // Aparelho já configurado antes? Recria a vault com o PIN lembrado.
        const saved = getSavedPin();
        if (saved) await get().setupPin(saved);
      } else {
        set({
          status: 'locked',
          salt: (data as { salt: string }).salt,
          verifier: (data as { verifier: Cipher }).verifier,
        });
        // Desbloqueio automático se o PIN estiver lembrado neste aparelho.
        const saved = getSavedPin();
        if (saved) {
          const ok = await get().unlock(saved);
          if (!ok) clearSavedPin(); // PIN salvo não confere mais → pede de novo
        }
      }
    },

    async setupPin(pin: string) {
      const userId = get().userId;
      if (!userId) return;
      const salt = randomSaltB64();
      const key = await deriveKey(pin, salt);
      const verifier = await makeVerifier(key);
      const { error } = await supabase
        .from('user_crypto')
        .upsert({ user_id: userId, salt, verifier });
      if (error) {
        set({ error: 'Falha ao salvar as credenciais. Tente novamente.' });
        return;
      }
      set({ key, salt, verifier, status: 'unlocked', error: null });
      setSavedPin(pin); // lembra neste aparelho (não pede de novo)
      armTimer();
    },

    async unlock(pin: string) {
      const { salt, verifier } = get();
      if (!salt || !verifier) {
        set({ status: 'needs-setup' });
        return false;
      }
      const key = await deriveKey(pin, salt);
      const ok = await checkVerifier(key, verifier);
      if (!ok) {
        set({ error: 'PIN incorreto.' });
        return false;
      }
      set({ key, status: 'unlocked', error: null });
      setSavedPin(pin); // lembra neste aparelho (não pede de novo)
      armTimer();
      return true;
    },

    lock() {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      // Mantém salt/verifier para permitir desbloqueio; só descarta a chave.
      set({ key: null, status: get().salt ? 'locked' : 'needs-setup', error: null });
    },

    reset() {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      set({ status: 'idle', key: null, error: null, userId: null, salt: null, verifier: null });
    },

    touch() {
      if (get().status === 'unlocked') armTimer();
    },
  };
});
