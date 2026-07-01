import { useState } from 'react';
import { Moon, Sun, Trash2, Timer, ShieldCheck, LogOut } from 'lucide-react';
import { useSession } from '@/store/session';
import { useAuth } from '@/store/auth';
import { wipeMyData } from '@/lib/remoteRepo';
import {
  getTheme,
  setTheme as persistTheme,
  getTimeoutMin,
  setTimeoutMin,
} from '@/lib/prefs';

export function SettingsPage() {
  const lock = useSession((s) => s.lock);
  const { user, signOut } = useAuth();
  const [theme, setTheme] = useState<'dark' | 'light'>(getTheme());
  const [timeout, setTimeout] = useState(getTimeoutMin());

  function applyTheme(next: 'dark' | 'light') {
    setTheme(next);
    persistTheme(next);
  }
  function applyTimeout(min: number) {
    setTimeout(min);
    setTimeoutMin(min);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Configurações</h1>

      <section className="card space-y-2">
        <div className="flex items-center gap-2 font-semibold">Conta</div>
        <p className="text-sm text-muted">{user?.email}</p>
        <button className="btn-ghost w-fit text-danger" onClick={() => void signOut()}>
          <LogOut className="h-4 w-4" /> Sair da conta
        </button>
      </section>

      <section className="card space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />} Tema
        </div>
        <div className="flex gap-2">
          <button className={theme === 'dark' ? 'btn-primary' : 'btn-ghost'} onClick={() => applyTheme('dark')}>
            Escuro
          </button>
          <button className={theme === 'light' ? 'btn-primary' : 'btn-ghost'} onClick={() => applyTheme('light')}>
            Claro
          </button>
        </div>
      </section>

      <section className="card space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <Timer className="h-4 w-4" /> Bloqueio por inatividade
        </div>
        <p className="text-sm text-muted">
          Após esse tempo sem uso, o app se bloqueia e pede o PIN novamente.
        </p>
        <select className="input" value={timeout} onChange={(e) => applyTimeout(Number(e.target.value))}>
          <option value={2}>2 minutos</option>
          <option value={5}>5 minutos</option>
          <option value={10}>10 minutos</option>
          <option value={30}>30 minutos</option>
          <option value={0}>Nunca (não recomendado)</option>
        </select>
        <button className="btn-ghost w-fit" onClick={lock}>
          Bloquear agora
        </button>
      </section>

      <section className="card space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4 text-ok" /> Privacidade
        </div>
        <p className="text-sm text-muted">
          Os dados de paciente são criptografados no seu dispositivo com o seu PIN antes de sincronizar.
          A nuvem guarda apenas o conteúdo cifrado — nem o servidor consegue ler.
        </p>
      </section>

      <section className="card space-y-3 border-danger/40">
        <div className="flex items-center gap-2 font-semibold text-danger">
          <Trash2 className="h-4 w-4" /> Zona de perigo
        </div>
        <p className="text-sm text-muted">
          Apaga permanentemente todos os seus pacientes e as credenciais de criptografia (você
          precisará criar um novo PIN). A conta de login permanece.
        </p>
        <button
          className="btn-danger w-fit"
          onClick={async () => {
            if (confirm('Apagar TODOS os seus dados de paciente e o PIN? Esta ação não pode ser desfeita.')) {
              await wipeMyData();
              lock();
              location.reload();
            }
          }}
        >
          Apagar meus dados
        </button>
      </section>
    </div>
  );
}
