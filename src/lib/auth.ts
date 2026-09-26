import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { supabaseConfigured } from './env';
import { createClient } from './supabase/server';

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: 'member' | 'admin';
  permit_status: 'none' | 'pending' | 'approved' | 'rejected';
  permit_path: string | null;
  permit_note: string | null;
  created_at: string;
};

export type Me = { id: string; email: string | null; profile: Profile };

// The signed-in member, or null. Cached per request.
export const getMe = cache(async (): Promise<Me | null> => {
  if (!supabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, phone, role, permit_status, permit_path, permit_note, created_at')
    .eq('id', data.user.id)
    .single();
  if (!profile) return null;
  return { id: data.user.id, email: data.user.email ?? null, profile: profile as Profile };
});

export async function requireMe(next = '/'): Promise<Me> {
  const me = await getMe();
  if (!me) redirect(`/login?next=${encodeURIComponent(next)}`);
  return me;
}

export async function requireAdmin(): Promise<Me> {
  const me = await requireMe('/admin');
  if (me.profile.role !== 'admin') redirect('/');
  return me;
}

// For server actions: the same checks, but return instead of redirecting.
export async function actionMe(): Promise<Me | null> {
  return getMe();
}
