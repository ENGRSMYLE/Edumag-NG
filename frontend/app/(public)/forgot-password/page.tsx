'use client';

import axios from 'axios';
import Link from 'next/link';
import { FormEvent, useState } from 'react';

import { authApi } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError('');

    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (requestError: unknown) {
      if (axios.isAxiosError(requestError) && requestError.response?.status === 429) {
        setError('Too many reset requests. Please wait before trying again.');
      } else if (axios.isAxiosError(requestError) && !requestError.response) {
        setError('Unable to reach the server. Check your connection and try again.');
      } else {
        setError('We could not process your request. Please try again.');
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
      <h1 className="font-display text-2xl font-bold">Reset your password</h1>
      <p className="mt-2 text-sm text-slate-500">
        Enter your account email. If it exists, we will send a secure reset link.
      </p>
      {sent ? (
        <div className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800" role="status">
          If an account exists for that email, a password reset link has been sent.
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-xs font-semibold">
            Email address
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input-base mt-1 w-full"
            />
          </label>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <button
            disabled={pending}
            className="w-full rounded-xl bg-[var(--color-gold)] py-3 text-sm font-semibold text-[var(--color-navy)] disabled:opacity-50"
          >
            {pending ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
      <Link href="/login" className="mt-5 block text-center text-sm text-[var(--color-navy)]">
        Back to sign in
      </Link>
    </div>
  );
}
