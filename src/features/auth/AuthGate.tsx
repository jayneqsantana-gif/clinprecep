import { useState } from 'react';
import { LogIn, UserPlus, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/store/auth';

/** Login/cadastro do médico (Supabase Auth). Antecede o PIN de criptografia. */
export function AuthGate() {
  const { signIn, signUp, error } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setInfo(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        const { ok, needsConfirm } = await signUp(email, password);
        if (ok && needsConfirm) {
          setInfo('Cadastro criado. Confirme o e-mail que enviamos e depois faça login.');
          setMode('login');
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const isLogin = mode === 'login';

  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="rounded-2xl bg-surface p-4">
          <ShieldCheck className="h-8 w-8 text-brand" />
        </div>
        <h1 className="text-xl font-bold">ClinPrecep</h1>
        <p className="text-sm text-muted">
          {isLogin ? 'Entre na sua conta.' : 'Crie sua conta de residente.'}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">E-mail</label>
          <input
            className="input"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Senha</label>
          <input
            className="input"
            type="password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {(error || info) && (
          <p className={`text-sm ${info ? 'text-ok' : 'text-danger'}`}>{info || error}</p>
        )}
        <button className="btn-primary w-full" disabled={busy || !email || !password}>
          {isLogin ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {isLogin ? 'Entrar' : 'Criar conta'}
        </button>
      </form>

      <button
        className="text-sm text-brand hover:underline"
        onClick={() => {
          setMode(isLogin ? 'signup' : 'login');
          setInfo(null);
        }}
      >
        {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
      </button>

      <p className="text-center text-xs text-muted">
        O e-mail é só para sua conta. Os dados de paciente ficam criptografados com um PIN que só você conhece — nem o servidor lê.
      </p>
    </div>
  );
}
