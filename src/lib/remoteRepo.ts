/**
 * Repositório remoto: CRUD de pacientes sobre o Supabase, cifrando/decifrando
 * no cliente. O Postgres guarda só o blob `enc` (ciphertext) + índices não-PHI
 * (id, active, updated_at). RLS garante que cada usuário só acessa os seus dados.
 *
 * Mantém a MESMA API do antigo repo local (createPatient, listPatients, etc.),
 * então as telas não mudam.
 */

import { supabase, currentUserId } from './supabase';
import { decryptJSON, encryptJSON, type Cipher } from './crypto';
import type { Patient } from './types';

export type NewPatientInput = {
  label: string;
  age: number | null;
  sex: Patient['sex'];
  admissionDate: string | null;
  bed: string | null;
};

interface PatientRow {
  id: string;
  user_id: string;
  active: boolean;
  updated_at: string;
  enc: Cipher;
}

function uuid(): string {
  return crypto.randomUUID();
}
function nowISO(): string {
  return new Date().toISOString();
}

async function requireUser(): Promise<string> {
  const uid = await currentUserId();
  if (!uid) throw new Error('Sessão expirada. Faça login novamente.');
  return uid;
}

export async function createPatient(key: CryptoKey, input: NewPatientInput): Promise<Patient> {
  const userId = await requireUser();
  const now = nowISO();
  const patient: Patient = {
    id: uuid(),
    label: input.label.trim(),
    age: input.age,
    sex: input.sex,
    admissionDate: input.admissionDate,
    bed: input.bed,
    allergies: [],
    active: true,
    problemList: [],
    createdAt: now,
    updatedAt: now,
  };
  const enc = await encryptJSON(key, patient);
  const { error } = await supabase.from('patients').insert({
    id: patient.id,
    user_id: userId,
    active: true,
    updated_at: now,
    enc,
  });
  if (error) throw error;
  return patient;
}

export async function listPatients(key: CryptoKey, includeArchived = false): Promise<Patient[]> {
  let query = supabase.from('patients').select('id, enc, updated_at').order('updated_at', { ascending: false });
  if (!includeArchived) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as Pick<PatientRow, 'id' | 'enc' | 'updated_at'>[];
  return Promise.all(rows.map((r) => decryptJSON<Patient>(key, r.enc)));
}

export async function getPatient(key: CryptoKey, id: string): Promise<Patient | null> {
  const { data, error } = await supabase.from('patients').select('enc').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return decryptJSON<Patient>(key, (data as { enc: Cipher }).enc);
}

export async function savePatient(key: CryptoKey, patient: Patient): Promise<Patient> {
  const userId = await requireUser();
  const updated: Patient = { ...patient, updatedAt: nowISO() };
  const enc = await encryptJSON(key, updated);
  const { error } = await supabase.from('patients').upsert({
    id: updated.id,
    user_id: userId,
    active: updated.active,
    updated_at: updated.updatedAt,
    enc,
  });
  if (error) throw error;
  return updated;
}

export async function archivePatient(key: CryptoKey, id: string, archived: boolean): Promise<void> {
  const p = await getPatient(key, id);
  if (!p) return;
  await savePatient(key, { ...p, active: !archived });
}

/** Remove o paciente. As tabelas-filhas têm ON DELETE CASCADE no schema. */
export async function deletePatient(id: string): Promise<void> {
  const { error } = await supabase.from('patients').delete().eq('id', id);
  if (error) throw error;
}

/** Apaga TODOS os dados do usuário (seção 10.6). */
export async function wipeMyData(): Promise<void> {
  const userId = await requireUser();
  await supabase.from('patients').delete().eq('user_id', userId);
  await supabase.from('user_crypto').delete().eq('user_id', userId);
}
