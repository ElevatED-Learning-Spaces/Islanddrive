// T&T numbers to E.164 (+1868…) and WhatsApp click-to-send links.
export function toE164(raw: string): string | null {
  const t = raw.trim();
  if (!t || /[a-z]/i.test(t)) return null;
  const digits = t.replace(/[^\d]/g, '');
  let out: string;
  if (t.startsWith('+')) out = '+' + digits;
  else if (digits.length === 7) out = '+1868' + digits;
  else if (digits.length === 10) out = '+1' + digits;
  else if (digits.length === 11 && digits.startsWith('1')) out = '+' + digits;
  else out = '+' + digits;
  const n = out.length - 1;
  return n >= 7 && n <= 15 ? out : null;
}

export function waLink(e164: string, message: string): string {
  return `https://wa.me/${e164.replace(/[^\d]/g, '')}?text=${encodeURIComponent(message)}`;
}

// "+1 868 700 1234" for display.
export function prettyPhone(e164: string): string {
  const m = /^\+1(868)(\d{3})(\d{4})$/.exec(e164);
  return m ? `+1 ${m[1]} ${m[2]} ${m[3]}` : e164;
}
