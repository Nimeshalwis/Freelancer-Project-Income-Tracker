import { useRef, useState } from 'react';
import { LogOut, Menu, ChevronDown, UserRound } from 'lucide-react';
import Avatar from '../ui/Avatar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useClickOutside } from '../../hooks/useApi.js';

export default function Topbar({ onMenu, title, subtitle }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={onMenu} className="-ml-1 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 lg:hidden" aria-label="Open navigation">
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="hidden truncate text-xs text-slate-500 sm:block">{subtitle}</p>}
        </div>
      </div>

      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2.5 transition hover:bg-slate-100"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <Avatar name={user?.name} size="sm" />
          <span className="hidden max-w-[140px] truncate text-sm font-medium text-slate-700 md:block">{user?.name}</span>
          <ChevronDown size={15} className="text-slate-400" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-30 mt-2 w-64 origin-top-right rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 animate-[fadeIn_.12s_ease-out]" role="menu">
            <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
              <Avatar name={user?.name} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
                <p className="truncate text-xs text-slate-500">{user?.email}</p>
              </div>
            </div>
            <div className="my-1 border-t border-slate-100" />
            <div className="px-3 py-1.5 text-[11px] font-medium text-slate-400">Signed in as freelancer account</div>
            <button
              type="button"
              role="menuitem"
              onClick={() => { setMenuOpen(false); logout(); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              <LogOut size={16} /> Sign out
            </button>
            <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-slate-400">
              <UserRound size={13} /> Session uses a Bearer access token
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
