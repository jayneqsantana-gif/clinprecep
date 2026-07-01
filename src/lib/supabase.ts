/**
 * Cliente Supabase (auth + sync de blobs criptografados).
 *
 * IMPORTANTE: o Supabase guarda SOMENTE dados de paciente já criptografados no
 * cliente (coluna `enc`). A chave de criptografia é derivada do PIN e nunca sai
 * do dispositivo — o servidor jamais lê PHI em claro. Ver crypto.ts e seção 10.
 */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const supabaseConfigured = Boolean(url && anon);

// Fallback inócuo para não quebrar o import quando as envs ainda não foram
// preenchidas (o app mostra uma tela de "configurar Supabase" nesse caso).
export const supabase = createClient(url || 'http://localhost:54321', anon || 'public-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
