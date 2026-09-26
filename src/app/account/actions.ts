'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { toE164 } from '@/lib/phone';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { checkUpload } from '@/lib/uploads';

function back(key: 'ok' | 'error', msg: string): never {
  redirect(`/account?${key}=${encodeURIComponent(msg)}`);
}

export async function saveProfile(form: FormData) {
  const me = await getMe();
  if (!me) redirect('/login?next=/account');
  const name = String(form.get('full_name') ?? '').trim().replace(/\s+/g, ' ');
  const phoneRaw = String(form.get('phone') ?? '');
  if (name.length < 2 || name.length > 120) back('error', 'Enter your full name.');
  const phone = toE164(phoneRaw);
  if (!phone) back('error', 'Enter a WhatsApp number, e.g. 868 700 1234.');
  // Member's own client: RLS + column grants limit this to name and phone.
  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({ full_name: name, phone }).eq('id', me.id);
  if (error) back('error', 'Could not save your details.');
  revalidatePath('/', 'layout');
  back('ok', 'Details saved.');
}

export async function uploadPermit(form: FormData) {
  const me = await getMe();
  if (!me) redirect('/login?next=/account');
  if (me.profile.permit_status === 'approved') back('error', 'Your permit is already verified.');
  const up = checkUpload(form.get('permit'), me.id, { allowPdf: true });
  if (!up.ok) back('error', up.error);
  const admin = createAdminClient();
  const { error: upErr } = await admin.storage.from('permits').upload(up.path, up.file, { contentType: up.file.type });
  if (upErr) back('error', 'Upload failed — please try again.');
  const old = me.profile.permit_path;
  const { error } = await admin
    .from('profiles')
    .update({ permit_path: up.path, permit_status: 'pending', permit_note: null })
    .eq('id', me.id);
  if (error) back('error', 'Upload failed — please try again.');
  if (old && old !== up.path) await admin.storage.from('permits').remove([old]);
  revalidatePath('/account');
  back('ok', 'Permit uploaded. We’ll verify it shortly.');
}
