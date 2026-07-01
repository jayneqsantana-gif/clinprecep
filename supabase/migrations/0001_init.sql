-- ClinPrecep — schema inicial (Supabase / Postgres).
--
-- PRIVACIDADE: o conteúdo de paciente é gravado SEMPRE criptografado no cliente,
-- na coluna `enc` (jsonb com { iv, ct, v }). O servidor nunca vê PHI em claro.
-- Apenas campos não-identificantes (ids, datas, flags) ficam em claro para índice.
-- RLS garante que cada usuário só acessa as próprias linhas.

-- ── Credenciais de criptografia por usuário ──────────────────────────────────
-- salt (público) + verifier (cifrado) para derivar/conferir a chave do PIN.
-- A CHAVE em si nunca é gravada — vive só na memória do dispositivo.
create table if not exists public.user_crypto (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  salt       text not null,
  verifier   jsonb not null,
  updated_at timestamptz not null default now()
);

-- ── Pacientes (payload criptografado em `enc`) ───────────────────────────────
create table if not exists public.patients (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  active     boolean not null default true,
  updated_at timestamptz not null default now(),
  enc        jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists patients_user_idx on public.patients(user_id, active, updated_at desc);

-- ── Tabelas-filhas (Fases 1+) — também criptografadas ────────────────────────
create table if not exists public.anamneses (
  patient_id uuid primary key references public.patients(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  enc        jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.evolutions (
  id         uuid primary key,
  patient_id uuid not null references public.patients(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date,
  enc        jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists evolutions_patient_idx on public.evolutions(patient_id, date desc);

create table if not exists public.lab_results (
  id         uuid primary key,
  patient_id uuid not null references public.patients(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date,
  enc        jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists lab_results_patient_idx on public.lab_results(patient_id, date desc);

create table if not exists public.tasks (
  id         uuid primary key,
  patient_id uuid not null references public.patients(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  done       boolean not null default false,
  enc        jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists tasks_patient_idx on public.tasks(patient_id, done);

create table if not exists public.chat_messages (
  id         uuid primary key,
  patient_id uuid references public.patients(id) on delete cascade, -- null = tira-dúvidas geral
  user_id    uuid not null references auth.users(id) on delete cascade,
  enc        jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_user_idx on public.chat_messages(user_id, patient_id);

-- ── Row Level Security: cada usuário só enxerga o que é dele ──────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'user_crypto','patients','anamneses','evolutions','lab_results','tasks','chat_messages'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists own_all on public.%I;', t);
    execute format(
      'create policy own_all on public.%I for all
         using (user_id = auth.uid())
         with check (user_id = auth.uid());', t);
  end loop;
end $$;
