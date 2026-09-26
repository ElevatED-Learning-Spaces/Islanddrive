import { NextResponse } from 'next/server';
import { supabaseConfigured } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Uptime check: 503 when the database can't be reached.
export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json({ ok: true, mode: 'demo' });
  const { error } = await createAdminClient().from('areas').select('slug').limit(1);
  return error
    ? NextResponse.json({ ok: false }, { status: 503 })
    : NextResponse.json({ ok: true });
}
