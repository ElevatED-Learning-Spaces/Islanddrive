import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { supabaseConfigured } from '@/lib/env';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

function safeNext(n: string | undefined): string {
  return n && n.startsWith('/') && !n.startsWith('//') ? n : '/';
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getMe()) redirect(next);
  return (
    <div className="page max-w-md">
      <div className="card p-6 sm:p-8">
        <h1 className="h1">Sign in or join</h1>
        <p className="muted mt-1">We’ll email you a 6-digit code. No password needed.</p>
        {sp.error ? <p className="notice mt-4 border-red-200 bg-red-50 text-red-800">That sign-in link didn’t work. Ask for a new code.</p> : null}
        {supabaseConfigured() ? (
          <LoginForm next={next} />
        ) : (
          <p className="notice mt-6 border-amber-200 bg-amber-50 text-amber-900">Sign-in is off in demo mode.</p>
        )}
      </div>
    </div>
  );
}
