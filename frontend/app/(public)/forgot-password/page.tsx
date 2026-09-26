'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { authApi } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(''); const [pending, setPending] = useState(false); const [sent, setSent] = useState(false);
  const submit = async (e: FormEvent) => { e.preventDefault(); setPending(true); try { await authApi.forgotPassword(email); setSent(true); } finally { setPending(false); } };
  return <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h1 className="font-display text-2xl font-bold">Reset your password</h1><p className="mt-2 text-sm text-slate-500">Enter your account email. If it exists, we will send a secure reset link.</p>{sent ? <div className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Check your email for the password reset link.</div> : <form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-xs font-semibold">Email address<input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-base mt-1 w-full" /></label><button disabled={pending} className="w-full rounded-xl bg-[var(--color-gold)] py-3 text-sm font-semibold text-[var(--color-navy)] disabled:opacity-50">{pending ? 'Sending…' : 'Send reset link'}</button></form>}<Link href="/login" className="mt-5 block text-center text-sm text-[var(--color-navy)]">Back to sign in</Link></div>;
}
