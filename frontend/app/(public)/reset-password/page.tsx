'use client';

import axios from 'axios';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';

import { authApi } from '@/lib/api';

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must contain at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  if (new TextEncoder().encode(password).length > 72) return 'Password must not exceed 72 bytes.';
  return null;
}

function ResetForm() {
  const searchParams = useSearchParams();
  const [token] = useState(() => searchParams.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Keep the secret in component memory, not in browser history or referrer URLs.
    if (token && window.location.search) {
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }
  }, [token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const passwordError = validatePassword(password);
    if (passwordError) return setError(passwordError);
    if (password !== confirm) return setError('Passwords do not match.');
    if (!token) return setError('This reset link is invalid.');

    setPending(true);
    setError('');
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      setPassword('');
      setConfirm('');
    } catch (requestError: unknown) {
      if (axios.isAxiosError(requestError) && requestError.response?.status === 400) {
        setError('This reset link is invalid, expired, or has already been used.');
      } else if (axios.isAxiosError(requestError) && requestError.response?.status === 429) {
        setError('Too many reset attempts. Please wait before trying again.');
      } else if (axios.isAxiosError(requestError) && !requestError.response) {
        setError('Unable to reach the server. Check your connection and try again.');
      } else {
        setError('We could not reset your password. Please request a new link and try again.');
      }
    } finally {
      setPending(false);
    }
  };

  if (!token) {
    return (
      <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
        <h1 className="font-display text-2xl font-bold">Invalid reset link</h1>
        <p className="mt-3 text-sm text-slate-500">
          This link is incomplete. Request a new password reset link.
        </p>
        <Link href="/forgot-password" className="mt-5 block font-semibold text-[var(--color-navy)]">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
      <h1 className="font-display text-2xl font-bold">Choose a new password</h1>
      {done ? (
        <>
          <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800" role="status">
            Your password has been reset. Please sign in with your new password.
          </p>
          <Link href="/login" className="mt-5 block text-center font-semibold">Sign in</Link>
        </>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-xs font-semibold">
            New password
            <input
              required
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-base mt-1 w-full"
            />
          </label>
          <p className="text-xs text-slate-500">
            Use 8 or more characters with an uppercase letter and a number.
          </p>
          <label className="block text-xs font-semibold">
            Confirm password
            <input
              required
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className="input-base mt-1 w-full"
            />
          </label>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <button
            disabled={pending}
            className="w-full rounded-xl bg-[var(--color-gold)] py-3 text-sm font-semibold text-[var(--color-navy)] disabled:opacity-50"
          >
            {pending ? 'Resetting…' : 'Reset password'}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
