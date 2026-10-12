import { useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { dashboardApi } from '../../services/api.js';

const TITLES = {
  '/dashboard': ['Dashboard', 'Your business at a glance'],
  '/clients': ['Clients', 'Manage your client relationships'],
  '/projects': ['Projects', 'Track project scope, fees, and status'],
  '/payments': ['Payments', 'Record income against project balances'],
  '/income': ['Income Analytics', 'Revenue trends and project mix'],
};

export default function AppLayout() {
  const { authenticated, initializing } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const section = '/' + (location.pathname.split('/')[1] || 'dashboard');
  const [title, subtitle] = TITLES[section] || ['FreelanceHub', ''];

  // Lightweight summary for the sidebar "outstanding" widget; failures are non-fatal here.
  const { data: summary } = useApi(() => dashboardApi.summary().then((r) => r.data.data), [authenticated]);

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 size={28} className="animate-spin text-indigo-600" />
          <p className="text-sm font-medium">Restoring your session…</p>
        </div>
      </div>
    );
  }

  if (!authenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} summary={summary} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setSidebarOpen(true)} title={title} subtitle={subtitle} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
