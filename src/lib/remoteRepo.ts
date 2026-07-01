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
import type { Patient, Anamnesis, Evolution, Task, LabResult, LabValue } from './types';

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

// ───────────────────────── Anamnese (uma por paciente) ─────────────────────────

export async function getAnamnesis(key: CryptoKey, patientId: string): Promise<Anamnesis | null> {
  const { data, error } = await supabase
    .from('anamneses')
    .select('enc')
    .eq('patient_id', patientId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return decryptJSON<Anamnesis>(key, (data as { enc: Cipher }).enc);
}

export async function saveAnamnesis(key: CryptoKey, anamnesis: Anamnesis): Promise<Anamnesis> {
  const userId = await requireUser();
  const enc = await encryptJSON(key, anamnesis);
  const { error } = await supabase
    .from('anamneses')
    .upsert({ patient_id: anamnesis.patientId, user_id: userId, enc });
  if (error) throw error;
  return anamnesis;
}

// ───────────────────────── Evoluções (histórico do paciente) ───────────────────

export async function listEvolutions(key: CryptoKey, patientId: string): Promise<Evolution[]> {
  const { data, error } = await supabase
    .from('evolutions')
    .select('enc')
    .eq('patient_id', patientId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as { enc: Cipher }[];
  return Promise.all(rows.map((r) => decryptJSON<Evolution>(key, r.enc)));
}

export async function createEvolution(
  key: CryptoKey,
  input: { patientId: string; date: string; dailyInput: string; structuredOutput: Record<string, unknown>; cleanVersion: string },
): Promise<Evolution> {
  const userId = await requireUser();
  const evo: Evolution = {
    id: uuid(),
    patientId: input.patientId,
    date: input.date,
    dailyInput: input.dailyInput,
    structuredOutput: input.structuredOutput,
    cleanVersion: input.cleanVersion,
    createdAt: nowISO(),
  };
  const enc = await encryptJSON(key, evo);
  const { error } = await supabase.from('evolutions').insert({
    id: evo.id,
    patient_id: evo.patientId,
    user_id: userId,
    date: evo.date,
    enc,
  });
  if (error) throw error;
  return evo;
}

export async function deleteEvolution(id: string): Promise<void> {
  const { error } = await supabase.from('evolutions').delete().eq('id', id);
  if (error) throw error;
}

// ───────────────────────── Pendências / Tarefas ─────────────────────────

export async function listTasks(key: CryptoKey, patientId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('enc')
    .eq('patient_id', patientId);
  if (error) throw error;
  const rows = (data ?? []) as { enc: Cipher }[];
  const tasks = await Promise.all(rows.map((r) => decryptJSON<Task>(key, r.enc)));
  // pendentes primeiro; urgentes no topo; depois por criação
  return tasks.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

export async function createTask(
  key: CryptoKey,
  input: { patientId: string; description: string; urgent: boolean; dueDate: string | null },
): Promise<Task> {
  const userId = await requireUser();
  const task: Task = {
    id: uuid(),
    patientId: input.patientId,
    description: input.description.trim(),
    done: false,
    urgent: input.urgent,
    createdAt: nowISO(),
    dueDate: input.dueDate,
  };
  const enc = await encryptJSON(key, task);
  const { error } = await supabase
    .from('tasks')
    .insert({ id: task.id, patient_id: task.patientId, user_id: userId, done: false, enc });
  if (error) throw error;
  return task;
}

export async function setTaskDone(key: CryptoKey, task: Task, done: boolean): Promise<Task> {
  const userId = await requireUser();
  const updated: Task = { ...task, done };
  const enc = await encryptJSON(key, updated);
  const { error } = await supabase
    .from('tasks')
    .upsert({ id: updated.id, patient_id: updated.patientId, user_id: userId, done, enc });
  if (error) throw error;
  return updated;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

/** Contagem de pendências abertas (barato — usa a coluna `done` em claro). */
export async function openTaskCount(patientId: string): Promise<number> {
  const { count, error } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', patientId)
    .eq('done', false);
  if (error) throw error;
  return count ?? 0;
}

// ───────────────────────── Exames laboratoriais (curvas) ─────────────────────

export async function listLabResults(key: CryptoKey, patientId: string): Promise<LabResult[]> {
  const { data, error } = await supabase
    .from('lab_results')
    .select('enc')
    .eq('patient_id', patientId)
    .order('date', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as { enc: Cipher }[];
  return Promise.all(rows.map((r) => decryptJSON<LabResult>(key, r.enc)));
}

export async function addLabResult(
  key: CryptoKey,
  input: { patientId: string; date: string; values: LabValue[] },
): Promise<LabResult> {
  const userId = await requireUser();
  const lab: LabResult = { patientId: input.patientId, date: input.date, values: input.values };
  const enc = await encryptJSON(key, lab);
  const { error } = await supabase
    .from('lab_results')
    .insert({ id: uuid(), patient_id: input.patientId, user_id: userId, date: input.date, enc });
  if (error) throw error;
  return lab;
}
