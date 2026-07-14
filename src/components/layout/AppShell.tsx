import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Users, BookOpen, Calculator, Settings } from 'lucide-react';

const nav = [
  { to: '/pacientes', label: 'Prontuários', icon: Users },
  { to: '/estudo', label: 'Estudo', icon: BookOpen },
  { to: '/calculadoras', label: 'Escores', icon: Calculator },
  { to: '/config', label: 'Config', icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <img src="/icons/icon.svg" alt="" className="h-6 w-6" />
          <span className="font-bold tracking-tight">ClinPrecep</span>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-24">{children}</main>

      {/* Barra de navegação inferior — ações-chave a um toque (seção 11) */}
      <nav className="safe-b fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition ${
                  isActive ? 'text-brand' : 'text-muted hover:text-text'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
