// Without Supabase keys the app runs in demo mode: the public catalogue shows
// sample cars and every write is disabled. Lets the UI be previewed before
// the Supabase project exists.
export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export function bankDetails() {
  return {
    bank: process.env.BANK_NAME || 'Bank details not set',
    accountName: process.env.BANK_ACCOUNT_NAME || 'IslandDrive',
    accountNumber: process.env.BANK_ACCOUNT_NUMBER || '—',
    branch: process.env.BANK_BRANCH || '',
  };
}

// Card payments go live once a WiPay account exists (DECISIONS.md #4).
export function wipayConfigured(): boolean {
  return Boolean(process.env.WIPAY_ACCOUNT_NUMBER && process.env.WIPAY_API_KEY);
}

export function supportWhatsapp(): string | null {
  return process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || null;
}
