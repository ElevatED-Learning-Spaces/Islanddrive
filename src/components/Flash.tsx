// Shows ?ok= / ?error= messages set by server-action redirects.
export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return error ? (
    <div role="alert" className="notice mb-6 border-red-200 bg-red-50 text-red-800">{error}</div>
  ) : (
    <div role="status" className="notice mb-6 border-sea-100 bg-sea-50 text-sea-700">{ok}</div>
  );
}
