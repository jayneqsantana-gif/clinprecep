/**
 * Criptografia local (Princípio 1 / seção 10).
 *
 * Dados de paciente ficam SOMENTE no dispositivo, criptografados em repouso.
 * A chave AES-GCM é derivada do PIN do usuário via PBKDF2 e vive apenas em
 * memória (nunca é persistida). Ao bloquear o app, a chave é descartada.
 *
 * Nada aqui envolve o servidor. O proxy de IA jamais recebe a chave nem o PIN.
 */

const PBKDF2_ITERATIONS = 210_000; // OWASP 2023+ p/ PBKDF2-SHA256
const SALT_BYTES = 16;
const IV_BYTES = 12;

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Blob criptografado como será guardado no IndexedDB. */
export interface Cipher {
  iv: string; // base64
  ct: string; // base64 (ciphertext + tag GCM)
  v: 1; // versão do formato, p/ migrações futuras
}

function toB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomSaltB64(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(SALT_BYTES)).buffer);
}

/** Deriva a chave AES-GCM a partir do PIN + salt do usuário. */
export async function deriveKey(pin: string, saltB64: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: fromB64(saltB64),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptJSON(key: CryptoKey, data: unknown): Promise<Cipher> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = enc.encode(JSON.stringify(data));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return { iv: toB64(iv.buffer), ct: toB64(ct), v: 1 };
}

export async function decryptJSON<T = unknown>(key: CryptoKey, cipher: Cipher): Promise<T> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(cipher.iv) },
    key,
    fromB64(cipher.ct),
  );
  return JSON.parse(dec.decode(pt)) as T;
}

/**
 * "Verifier": um token conhecido, criptografado com a chave derivada. Serve para
 * conferir se o PIN digitado está correto no desbloqueio (se decifrar, o PIN bate).
 */
const VERIFIER_TOKEN = 'clinprecep::verifier::v1';

export async function makeVerifier(key: CryptoKey): Promise<Cipher> {
  return encryptJSON(key, VERIFIER_TOKEN);
}

export async function checkVerifier(key: CryptoKey, verifier: Cipher): Promise<boolean> {
  try {
    const token = await decryptJSON<string>(key, verifier);
    return token === VERIFIER_TOKEN;
  } catch {
    return false;
  }
}
