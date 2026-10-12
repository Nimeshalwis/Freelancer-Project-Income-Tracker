import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CircleCheck, TriangleAlert, Info, CircleX, X } from 'lucide-react';
import { setUnauthenticatedHandler } from '../services/api.js';

const NotificationContext = createContext(null);

const ICONS = { success: CircleCheck, error: TriangleAlert, info: Info, warning: TriangleAlert };
const STYLES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
};
const ICON_STYLES = {
  success: 'text-emerald-600',
  error: 'text-red-600',
  info: 'text-indigo-600',
  warning: 'text-amber-600',
};

let nextId = 1;

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const notify = useCallback((message, type = 'info', duration = 4500) => {
    const id = nextId++;
    setToasts((list) => [...list.slice(-4), { id, message, type }]);
    timers.current.set(id, setTimeout(() => dismiss(id), duration));
    return id;
  }, [dismiss]);

  useEffect(() => () => { timers.current.forEach((t) => clearTimeout(t)); }, []);

  const value = useMemo(
    () => ({
      notify,
      dismiss,
      success: (m) => notify(m, 'success'),
      error: (m) => notify(m, 'error', 6000),
      info: (m) => notify(m, 'info'),
      warning: (m) => notify(m, 'warning'),
    }),
    [notify, dismiss],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type] || Info;
          return (
            <div
              key={toast.id}
              className={`toast-enter pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg shadow-slate-900/5 backdrop-blur ${STYLES[toast.type] || STYLES.info}`}
              role="status"
            >
              <Icon size={18} className={`mt-0.5 shrink-0 ${ICON_STYLES[toast.type] || ''}`} />
              <p className="flex-1 text-sm font-medium leading-snug">{toast.message}</p>
              <button type="button" onClick={() => dismiss(toast.id)} className="shrink-0 rounded-md p-0.5 opacity-60 transition hover:opacity-100" aria-label="Dismiss notification">
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
}

export const useNotify = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotify must be used within NotificationProvider');
  return ctx;
};

/** Convenience hook: shows a toast with the backend error envelope's message. */
export function useApiErrorHandler() {
  const notify = useNotify();
  return useCallback((apiError, fallback = 'Something went wrong.') => {
    notify.error(apiError?.message || fallback);
  }, [notify]);
}

// Session expiry wiring lives in AuthProvider; this re-export keeps the handler import centralised.
export { setUnauthenticatedHandler };
