// Service-role client — BYPASSES Row-Level Security. Server-only.
// Every caller must check who the user is and what they own first
// (requireUser / requireAdmin + an ownership check) before touching data.
import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
