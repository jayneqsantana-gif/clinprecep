# ClinPrecep

Preceptor de bolso para residentes de Clínica Médica — apoio ao raciocínio clínico e estudo.
**WebApp** (Vercel + Supabase) com **criptografia ponta-a-ponta**: os dados de paciente são cifrados no dispositivo com um PIN que só você conhece; o servidor só guarda o conteúdo cifrado.

## Arquitetura

A raiz deste repositório é o app (deploy na Vercel com Root Directory = `.`).

```
.
  api/chat.ts          Função serverless de IA (a chave da Anthropic vive só no servidor)
  src/lib/supabase     Auth + sync de blobs criptografados
  src/lib/crypto       AES-GCM + PBKDF2 (chave derivada do PIN, só em memória)
  supabase/
    migrations/        SQL do schema + RLS (rode no seu projeto Supabase)
```

- **Vercel** hospeda o SPA e a função `/api/chat` (streaming de IA).
- **Supabase** faz autenticação (login do médico) e guarda os dados **já criptografados** (RLS por usuário). Nunca vê PHI em claro.

## Setup

### 1. Supabase
1. Crie um projeto em supabase.com.
2. No SQL Editor, rode `supabase/migrations/0001_init.sql` (cria tabelas + RLS).
3. Pegue a **Project URL** e a **anon key** (Settings → API).

### 2. Rodar localmente
```bash
npm install
cp .env.example .env      # preencha VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
                          # e, para a IA local, ANTHROPIC_API_KEY + SUPABASE_URL/ANON_KEY

# opção A — só o front (sem IA):
npm run dev               # http://localhost:5173

# opção B — front + função /api (IA) juntos:
npm i -g vercel
vercel dev                # roda o Vite e a função serverless
```

### 3. Deploy na Vercel
1. Importe o repositório na Vercel (**Root Directory = `.`**, framework Vite é detectado). Já está conectado ao repo `jayneqsantana-gif/clinprecep` — cada push na `main` faz deploy.
2. Em **Environment Variables**, defina:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (cliente)
   - `ANTHROPIC_API_KEY` (servidor — nunca exposta)
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY` (servidor — valida o usuário antes de chamar a IA)
   - `CLINPRECEP_MODEL` (opcional: `claude-sonnet-5` | `claude-opus-4-8` | `claude-haiku-4-5`)
3. Deploy.

## Estado — Fase 0 (Fundação) concluída

- Auth Supabase (login/cadastro) → termo de uso → PIN de criptografia (criação/desbloqueio) → app.
- Cardápio de prontuários (adicionar/arquivar/remover), **dados cifrados no cliente** e sincronizados no Supabase.
- 7 sub-abas do paciente (stubs por fase), Estudo, Escores, Configurações (tema, timeout, sair, apagar meus dados).
- Função serverless de IA com streaming, allowlist de modelos, web search para Diretrizes/Atualizações, **sem log de conteúdo clínico**, validando o usuário.

Próximo: **Fase 1 (MVP)** — upload/organização da anamnese → evolução diária via chat → versão limpa → histórico.

## Privacidade (LGPD/CFM)

- Sem identificadores diretos (só apelido/iniciais + leito).
- Criptografia ponta-a-ponta: a chave nunca sai do dispositivo; o Supabase guarda só ciphertext; RLS isola cada usuário.
- A função de IA não persiste nem loga o conteúdo clínico.

> Ferramenta de apoio ao estudo e à organização. Não substitui a avaliação à beira do leito, a preceptoria nem a decisão do médico assistente.
