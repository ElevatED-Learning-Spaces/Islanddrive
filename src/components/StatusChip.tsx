import { labelFor, type LabelKind, type Tone } from '@/lib/labels';

const TONES: Record<Tone, string> = {
  neutral: 'bg-stone-100 text-stone-700',
  info: 'bg-sky-50 text-sky-700',
  good: 'bg-sea-50 text-sea-700',
  warn: 'bg-amber-50 text-amber-800',
  bad: 'bg-red-50 text-red-700',
};

export function StatusChip({ kind, code }: { kind: LabelKind; code: string }) {
  const l = labelFor(kind, code);
  return <span className={`chip ${TONES[l.tone]}`}>{l.label}</span>;
}
