import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { getMe } from '@/lib/auth';
import { supabaseConfigured } from '@/lib/env';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'IslandDrive — rent cars from locals in Trinidad & Tobago', template: '%s · IslandDrive' },
  description: 'Peer-to-peer car rental across Trinidad and Tobago. Book a car from a local host, or earn from yours.',
  manifest: '/manifest.webmanifest',
};

// Header shows who is signed in, so every page renders per request.
export const dynamic = 'force-dynamic';

export const viewport: Viewport = { themeColor: '#0c7f75', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  const demo = !supabaseConfigured();
  return (
    <html lang="en-TT">
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        {demo ? (
          <div className="bg-ink px-4 py-2 text-center text-xs text-white/90">
            Demo mode — sample cars only. Connect Supabase to enable sign-in and bookings.
          </div>
        ) : null}
        <header className="sticky top-0 z-30 border-b border-line/70 bg-sand/90 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:px-6">
            <Link href="/" className="mr-auto flex items-center gap-2 font-bold tracking-tight">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sea-600 text-sm text-white">ID</span>
              <span className="text-lg">IslandDrive</span>
            </Link>
            <Link href="/cars" className="hidden rounded-full px-3 py-2 text-sm font-medium hover:bg-white sm:block">Find a car</Link>
            <Link href="/host" className="whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium hover:bg-white">
              {me ? 'Host' : <><span className="sm:hidden">Host</span><span className="hidden sm:inline">Become a host</span></>}
            </Link>
            {me ? (
              <>
                <Link href="/trips" className="whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium hover:bg-white">Trips</Link>
                {me.profile.role === 'admin' ? (
                  <Link href="/admin" className="rounded-full px-3 py-2 text-sm font-medium hover:bg-white">Admin</Link>
                ) : null}
                <Link href="/account" aria-label="Account" className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-sm font-semibold">
                  {(me.profile.full_name || me.email || '?').trim()[0]?.toUpperCase()}
                </Link>
              </>
            ) : (
              <Link href="/login" className="btn-ghost whitespace-nowrap !px-4 !py-2">Sign in</Link>
            )}
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line/70 py-8 text-center text-xs text-ink-soft">
          <p>IslandDrive · Trinidad &amp; Tobago · Prices in TTD</p>
          <p className="mt-1">
            <Link href="/how-it-works" className="underline-offset-2 hover:underline">How it works</Link>
          </p>
        </footer>
      </body>
    </html>
  );
}
