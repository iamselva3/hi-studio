import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError, setToken } from '@/lib/api';
import { AdminLoginPage } from './AdminLoginPage';
import { AdminShell } from './AdminShell';
import { Button, Spinner } from './ui';

/** The admin is always dark, whatever theme the visitor chose on the public site. */
const ADMIN_THEME = {
  '--canvas': '#0D0C0B',
  '--canvas-subtle': '#141312',
  '--canvas-elevated': '#1B1A18',
  '--canvas-surface': '#242220',
  '--ink': '#F7F2E4',
  '--ink-soft': '#D1C9BE',
  '--ink-muted': '#8F897E',
  '--ink-faint': '#B3AC9F',
  '--ink-light': '#F7F2E4',
  '--accent': '#D6C098',
  '--accent-hover': '#E4D1AC',
  '--accent-deep': '#9E8458',
  '--accent-glow': 'rgba(214, 192, 152, 0.25)',
  '--hairline': 'rgba(249, 244, 232, 0.08)',
  '--hairline-strong': 'rgba(249, 244, 232, 0.18)',
  '--hairline-faint': 'rgba(249, 244, 232, 0.04)',
  colorScheme: 'dark',
} as React.CSSProperties;

type Session = 'checking' | 'in' | 'out' | 'unreachable';
export type SignedOutReason = 'expired' | 'logout' | 'logout-offline' | null;

interface MeResponse {
  authenticated: boolean;
  expiresAt?: number;
}

const AdminApp: React.FC = () => {
  const [session, setSession] = useState<Session>('checking');
  const [reason, setReason] = useState<SignedOutReason>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const checkSession = useCallback(async () => {
    setSession('checking');
    try {
      const me = await api<MeResponse>('/api/auth/me');
      if (me && me.authenticated) {
        setExpiresAt(typeof me.expiresAt === 'number' ? me.expiresAt : null);
        setSession('in');
      } else {
        setToken(null);
        setSession('out');
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setToken(null);
        setSession('out');
      } else {
        setSession('unreachable');
      }
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Keep search engines out and give the tab a clear name.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const prevTitle = document.title;
    document.title = 'Studio admin';
    return () => {
      meta.remove();
      document.title = prevTitle;
    };
  }, []);

  // Any admin API call answering 401 means the session is gone.
  useEffect(() => {
    const onUnauthorized = () => {
      if (sessionRef.current !== 'in') return;
      setToken(null);
      setReason('expired');
      setSession('out');
    };
    window.addEventListener('hi:unauthorized', onUnauthorized);
    return () => window.removeEventListener('hi:unauthorized', onUnauthorized);
  }, []);

  // Sign out when the 8-hour session runs out, rather than failing on the next save.
  useEffect(() => {
    if (session !== 'in' || !expiresAt) return;
    const ms = expiresAt - Date.now();
    if (ms > 2_147_000_000) return;
    const t = window.setTimeout(() => {
      setToken(null);
      setReason('expired');
      setSession('out');
    }, Math.max(0, ms));
    return () => window.clearTimeout(t);
  }, [session, expiresAt]);

  const handleLoggedIn = useCallback(
    (exp: number | null) => {
      setExpiresAt(exp);
      setReason(null);
      setSession('in');
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from.startsWith('/admin') && from !== '/admin/login' ? from : '/admin', { replace: true });
    },
    [location.state, navigate]
  );

  const handleLogout = useCallback(async () => {
    let ok = true;
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      ok = false;
    }
    setToken(null);
    setReason(ok ? 'logout' : 'logout-offline');
    setSession('out');
    navigate('/admin/login', { replace: true });
  }, [navigate]);

  const guarded = useMemo(() => {
    if (session === 'checking') {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <Spinner label="Opening the studio admin…" />
        </div>
      );
    }
    if (session === 'unreachable') {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="max-w-sm space-y-4 text-center">
            <p className="font-serif text-2xl">Can't reach the server</p>
            <p className="text-sm text-ink-faint">Check your internet connection, then try again.</p>
            <Button variant="primary" onClick={checkSession}>
              Try again
            </Button>
          </div>
        </div>
      );
    }
    if (session === 'out') {
      return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
    }
    return <AdminShell onLogout={handleLogout} />;
  }, [session, checkSession, handleLogout, location.pathname]);

  return (
    <div style={ADMIN_THEME} className="min-h-screen bg-[#0C0B0A] font-sans text-ink-light">
      <Routes>
        <Route
          path="login"
          element={
            session === 'in' ? <Navigate to="/admin" replace /> : <AdminLoginPage reason={reason} onLoggedIn={handleLoggedIn} />
          }
        />
        <Route path="*" element={guarded} />
      </Routes>
    </div>
  );
};

export default AdminApp;
