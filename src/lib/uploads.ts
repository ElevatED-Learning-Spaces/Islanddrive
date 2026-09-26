import 'server-only';
import { randomUUID } from 'node:crypto';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

// Checks a file from a form. Returns the storage path to use or an error.
export function checkUpload(
  file: unknown,
  folder: string,
  opts: { allowPdf?: boolean } = {},
): { ok: true; file: File; path: string } | { ok: false; error: string } {
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Choose a file to upload.' };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: 'That file is over 8 MB — try a smaller photo.' };
  const ext = EXT[file.type];
  if (!ext || (ext === 'pdf' && !opts.allowPdf)) {
    return { ok: false, error: opts.allowPdf ? 'Upload a JPG, PNG, WebP or PDF.' : 'Upload a JPG, PNG or WebP photo.' };
  }
  return { ok: true, file, path: `${folder}/${randomUUID()}.${ext}` };
}
