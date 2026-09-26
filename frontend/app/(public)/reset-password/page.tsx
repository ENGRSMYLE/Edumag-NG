'use client';
import Link from 'next/link';
import { FormEvent, Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api';

function ResetForm() {
  const token = useSearchParams().get('token') ?? ''; const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [pending, setPending] = useState(false); const [done, setDone] = useState(false); const [error, setError] = useState('');
  const submit = async (e: FormEvent) => { e.preventDefault(); if (password.length < 8) return setError('Password must contain at least 8 characters.'); if (password !== confirm) return setError('Passwords do not match.'); if (!token) return setError('This reset link is invalid.'); setPending(true); setError(''); try { await authApi.resetPassword(token, password); setDone(true); } catch { setError('This reset link is invalid or has expired.'); } finally { setPending(false); } };
  return <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h1 className="font-display text-2xl font-bold">Choose a new password</h1>{done ? <><p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Your password has been reset. Existing sessions were signed out.</p><Link href="/login" className="mt-5 block text-center font-semibold">Sign in</Link></> : <form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-xs font-semibold">New password<input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-base mt-1 w-full" /></label><label className="block text-xs font-semibold">Confirm password<input required type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="input-base mt-1 w-full" /></label>{error && <p className="text-sm text-red-600">{error}</p>}<button disabled={pending} className="w-full rounded-xl bg-[var(--color-gold)] py-3 text-sm font-semibold text-[var(--color-navy)] disabled:opacity-50">{pending ? 'Resetting…' : 'Reset password'}</button></form>}</div>;
}
export default function ResetPasswordPage() { return <Suspense><ResetForm /></Suspense>; }
