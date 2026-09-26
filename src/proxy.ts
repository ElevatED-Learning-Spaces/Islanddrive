import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

// Next.js 16 "proxy" (formerly middleware): session refresh + member-area gate.
export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
