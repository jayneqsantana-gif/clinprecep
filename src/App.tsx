import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { useSession } from '@/store/session';
import { supabaseConfigured } from '@/lib/supabase';
import { getTermAccepted, setTermAccepted, getTheme } from '@/lib/prefs';
import { FirstRunTerm } from '@/features/auth/FirstRunTerm';
import { AuthGate } from '@/features/auth/AuthGate';
import { PinGate } from '@/features/auth/PinGate';
import { AppShell } from '@/components/layout/AppShell';
import { PatientsPage } from '@/pages/PatientsPage';
import { PatientPage } from '@/pages/PatientPage';
import { StudyPage } from '@/pages/StudyPage';
import { CalculatorsPage } from '@/pages/CalculatorsPage';
import { SettingsPage } from '@/pages/SettingsPage';

const Loading = () => (
  <div className="flex h-full items-center justify-center text-muted">Carregando…</div>
);

export default function App() {
  const { user, ready, init: authInit } = useAuth();
  const { status, initForUser, reset, touch } = useSession();
  const [term, setTerm] = useState(getTermAccepted());

  // Aplica o tema salvo e liga a autenticação uma vez.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', getTheme() === 'dark');
    authInit();
  }, [authInit]);

  // Quando o usuário loga/desloga, prepara ou reseta a sessão de criptografia.
  useEffect(() => {
    if (user) void initForUser(user.id);
    else reset();
  }, [user, initForUser, reset]);

  // Atividade realimenta o timeout de sessão (seção 10.7).
  useEffect(() => {
    const handler = () => touch();
    window.addEventListener('pointerdown', handler);
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, [touch]);

  // 1. Termo de primeira execução (seção 10.4).
  if (!term) return <FirstRunTerm onAccept={() => { setTermAccepted(true); setTerm(true); }} />;

  // 2. Supabase precisa estar configurado (envs VITE_SUPABASE_*).
  if (!supabaseConfigured) return <SupabaseSetupNeeded />;

  // 3. Autenticação.
  if (!ready) return <Loading />;
  if (!user) return <AuthGate />;

  // 4. PIN de criptografia (criação ou desbloqueio).
  if (status === 'idle' || status === 'loading') return <Loading />;
  if (status !== 'unlocked') {
    return <PinGate mode={status === 'needs-setup' ? 'needs-setup' : 'locked'} />;
  }

  // 5. App.
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/pacientes" replace />} />
        <Route path="/pacientes" element={<PatientsPage />} />
        <Route path="/pacientes/:id/*" element={<PatientPage />} />
        <Route path="/estudo" element={<StudyPage />} />
        <Route path="/calculadoras" element={<CalculatorsPage />} />
        <Route path="/config" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/pacientes" replace />} />
      </Routes>
    </AppShell>
  );
}

function SupabaseSetupNeeded() {
  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-4 p-6">
      <div className="flex items-center gap-2 text-warn">
        <AlertTriangle className="h-6 w-6" />
        <h1 className="text-lg font-bold text-text">Configurar o Supabase</h1>
      </div>
      <p className="text-sm text-muted">
        Defina as variáveis <code className="text-text">VITE_SUPABASE_URL</code> e{' '}
        <code className="text-text">VITE_SUPABASE_ANON_KEY</code> no arquivo{' '}
        <code className="text-text">app/.env</code> (local) ou nas Environment Variables do projeto
        na Vercel, e recarregue.
      </p>
      <p className="text-sm text-muted">
        Rode a migração SQL em <code className="text-text">supabase/migrations/0001_init.sql</code> no
        seu projeto Supabase para criar as tabelas e as políticas de segurança (RLS).
      </p>
    </div>
  );
}
