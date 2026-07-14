import { useRef, useState } from 'react';
import { Moon, Sun, Trash2, KeyRound, ShieldCheck, LogOut, Download, Upload } from 'lucide-react';
import { useSession } from '@/store/session';
import { useAuth } from '@/store/auth';
import { wipeMyData, exportAllData, importAllData, type BackupFile } from '@/lib/remoteRepo';
import { todayISO } from '@/lib/dates';
import { getTheme, setTheme as persistTheme, getSavedPin, clearSavedPin } from '@/lib/prefs';

export function SettingsPage() {
  const lock = useSession((s) => s.lock);
  const { user, signOut } = useAuth();
  const [theme, setTheme] = useState<'dark' | 'light'>(getTheme());
  const [pinSaved, setPinSaved] = useState(!!getSavedPin());

  function applyTheme(next: 'dark' | 'light') {
    setTheme(next);
    persistTheme(next);
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
          <KeyRound className="h-4 w-4" /> PIN
        </div>
        <p className="text-sm text-muted">
          {pinSaved
            ? 'O PIN está lembrado neste aparelho — o app abre direto, sem pedir o PIN toda vez.'
            : 'O app vai pedir o PIN na próxima vez que abrir.'}
        </p>
        {pinSaved && (
          <button
            className="btn-ghost w-fit"
            onClick={() => {
              clearSavedPin();
              setPinSaved(false);
              lock();
            }}
          >
            Esquecer PIN neste aparelho
          </button>
        )}
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

      <BackupSection />


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

/** Backup criptografado + restauração (seção 10.6). */
function BackupSection() {
  const lock = useSession((s) => s.lock);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function exportar() {
    setBusy('export');
    setMsg(null);
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `clinprecep-backup-${todayISO()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMsg(`Backup exportado (${data.patients.length} paciente(s)).`);
    } catch (e) {
      setMsg('Falha ao exportar: ' + (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function importar(file: File) {
    setBusy('import');
    setMsg(null);
    try {
      const parsed = JSON.parse(await file.text()) as BackupFile;
      const n = parsed?.patients?.length ?? 0;
      if (
        !confirm(
          `Restaurar o backup de ${parsed?.exportedAt?.slice(0, 10) ?? '?'} com ${n} paciente(s)?\n\n` +
            'Isto SUBSTITUI todos os dados atuais. Após restaurar, o desbloqueio usa o PIN da época do backup.',
        )
      )
        return;
      await importAllData(parsed);
      lock();
      location.reload();
    } catch (e) {
      setMsg('Falha ao restaurar: ' + (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card space-y-3">
      <div className="flex items-center gap-2 font-semibold">
        <Download className="h-4 w-4" /> Meus dados (backup)
      </div>
      <p className="text-sm text-muted">
        O arquivo de backup contém seus dados <strong className="text-text">já criptografados</strong> —
        só pode ser lido com o mesmo PIN. Guarde-o em local seguro.
      </p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy !== null} onClick={exportar}>
          <Download className="h-4 w-4" /> {busy === 'export' ? 'Exportando…' : 'Exportar backup'}
        </button>
        <button className="btn-ghost" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> {busy === 'import' ? 'Restaurando…' : 'Restaurar backup'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importar(f);
            e.target.value = '';
          }}
        />
      </div>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </section>
  );
}
