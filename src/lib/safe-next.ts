// Where to send someone after sign-in: same-site paths only. Rejects
// protocol-relative ("//x") and backslash ("/\x", read by browsers as "//x") forms.
export function safeNext(raw: string | null | undefined): string {
  const n = raw ?? '';
  if (!n.startsWith('/') || n.startsWith('//') || /[\\\s]/.test(n)) return '/';
  try {
    const u = new URL(n, 'http://local.invalid');
    return u.origin === 'http://local.invalid' ? u.pathname + u.search : '/';
  } catch {
    return '/';
  }
}
