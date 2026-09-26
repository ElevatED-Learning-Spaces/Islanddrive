'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setBusy(false);
    if (error) setError(error.status === 429 ? 'Too many tries — wait a minute and try again.' : 'We couldn’t send a code to that email.');
    else setStep('code');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) return setError('That code is wrong or has expired.');
    router.replace(next);
    router.refresh();
  }

  return step === 'email' ? (
    <form onSubmit={sendCode} className="mt-6 space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" type="email" required autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {error ? <p role="alert" className="text-sm text-coral">{error}</p> : null}
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Sending…' : 'Email me a code'}</button>
    </form>
  ) : (
    <form onSubmit={verify} className="mt-6 space-y-4">
      <p className="text-sm">Code sent to <strong>{email}</strong>. You can also tap the link in the email.</p>
      <div>
        <label className="label" htmlFor="code">6-digit code</label>
        <input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" required className="input text-center text-lg tracking-[0.4em]"
          value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
      </div>
      {error ? <p role="alert" className="text-sm text-coral">{error}</p> : null}
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
      <button type="button" className="w-full text-sm text-ink-soft underline" onClick={() => { setStep('email'); setCode(''); }}>Use a different email</button>
    </form>
  );
}
