import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react';
import { api, ApiError, setToken } from '@/lib/api';
import { useSiteData } from '@/context/SiteDataContext';
import { Button, inputClass } from './ui';
import type { SignedOutReason } from './AdminApp';

interface LoginResponse {
  ok: boolean;
  token: string;
  expiresAt?: number;
}

const REASON_TEXT: Record<Exclude<SignedOutReason, null>, string> = {
  expired: 'Your session has ended. Please sign in again.',
  logout: 'You have signed out.',
  'logout-offline':
    'You are signed out on this screen, but the server could not be reached to end the session. Close the browser if this is a shared computer.',
};

export const AdminLoginPage: React.FC<{ reason: SignedOutReason; onLoggedIn: (expiresAt: number | null) => void }> = ({
  reason,
  onLoggedIn,
}) => {
  const { settings } = useSiteData();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter the admin password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api<LoginResponse>('/api/auth/login', { method: 'POST', body: { password } });
      if (!res || !res.token) throw new ApiError('Sign-in failed. Please try again.', 500);
      setToken(res.token);
      setPassword('');
      onLoggedIn(typeof res.expiresAt === 'number' ? res.expiresAt : null);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setError('That password is not correct.');
        else if (err.status === 429)
          setError(err.message && !/^Request failed/.test(err.message) ? err.message : 'Too many attempts. Please wait 15 minutes and try again.');
        else if (err.status === 503) setError(err.message || 'Admin sign-in is not set up on the server yet.');
        else setError(/^Request failed/.test(err.message) ? 'The server had a problem. Please try again.' : err.message);
      } else {
        setError('Could not reach the server. Check your internet connection and try again.');
      }
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <div className="p-4 sm:p-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-ink-faint hover:text-accent">
          <ArrowLeft size={14} aria-hidden />
          Back to the website
        </Link>
      </div>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded border border-hairline-strong bg-canvas-elevated p-1.5">
              <img src="/brand/logo-badge.png" alt="" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="font-serif text-lg leading-tight">{settings.studio_profile.name || 'Studio'}</p>
              <p className="text-xs text-ink-faint">Website admin</p>
            </div>
          </div>

          <h1 className="font-serif text-3xl">Sign in</h1>

          {reason && !error && (
            <p className="rounded-md border border-hairline-strong bg-canvas-elevated p-3 text-sm text-ink-faint" role="status">
              {REASON_TEXT[reason]}
            </p>
          )}

          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            {error && (
              <p role="alert" className="rounded-md border border-red-800/70 bg-red-950/40 p-3 text-sm text-red-200">
                {error}
              </p>
            )}

            <div className="space-y-1">
              <label htmlFor="admin-password" className="block text-xs font-medium uppercase tracking-wide text-ink-faint">
                Admin password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  ref={inputRef}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-11 py-3`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-faint hover:text-ink-light"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button type="submit" variant="primary" busy={loading} className="w-full py-3">
              <Lock size={14} aria-hidden />
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
};
