import { useState } from 'react';
import { Lock, KeyRound } from 'lucide-react';
import { useSession } from '@/store/session';

interface Props {
  mode: 'needs-setup' | 'locked';
}

/** Tela de PIN: criação (needs-setup) ou desbloqueio (locked). Seção 10.2. */
export function PinGate({ mode }: Props) {
  const { setupPin, unlock, error } = useSession();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isSetup = mode === 'needs-setup';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (pin.length < 4) {
      setLocalError('Use ao menos 4 dígitos.');
      return;
    }
    setBusy(true);
    try {
      if (isSetup) {
        if (pin !== confirm) {
          setLocalError('Os PINs não coincidem.');
          return;
        }
        await setupPin(pin);
      } else {
        const ok = await unlock(pin);
        if (!ok) setPin('');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="rounded-2xl bg-surface p-4">
          {isSetup ? (
            <KeyRound className="h-8 w-8 text-brand" />
          ) : (
            <Lock className="h-8 w-8 text-brand" />
          )}
        </div>
        <h1 className="text-xl font-bold">{isSetup ? 'Crie seu PIN' : 'Digite seu PIN'}</h1>
        <p className="text-sm text-muted">
          {isSetup
            ? 'Ele criptografa seus dados. Guarde-o: sem o PIN, os dados não podem ser recuperados. Vou lembrá-lo neste aparelho e não pedir de novo.'
            : 'Só desta vez — depois vou lembrar dele neste aparelho e não pedir mais.'}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <input
          className="input text-center text-lg tracking-widest"
          type="password"
          inputMode="numeric"
          autoFocus
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />
        {isSetup && (
          <input
            className="input text-center text-lg tracking-widest"
            type="password"
            inputMode="numeric"
            placeholder="Confirme o PIN"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        )}
        {(localError || error) && (
          <p className="text-sm text-danger">{localError || error}</p>
        )}
        <button className="btn-primary w-full" disabled={busy}>
          {isSetup ? 'Criar PIN e entrar' : 'Desbloquear'}
        </button>
      </form>
    </div>
  );
}
