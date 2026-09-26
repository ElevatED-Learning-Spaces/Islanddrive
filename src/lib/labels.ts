// The one place a stored code becomes words on a screen. Lists and detail
// views both import from here so they can never drift apart.
export type Tone = 'neutral' | 'info' | 'good' | 'warn' | 'bad';
type Label = { label: string; tone: Tone };

const MAPS = {
  booking: {
    requested: { label: 'Waiting for host', tone: 'info' },
    approved: { label: 'Approved — awaiting payment', tone: 'warn' },
    declined: { label: 'Declined', tone: 'bad' },
    cancelled: { label: 'Cancelled', tone: 'neutral' },
    expired: { label: 'Expired', tone: 'neutral' },
    paid: { label: 'Confirmed', tone: 'good' },
    active: { label: 'On trip', tone: 'good' },
    completed: { label: 'Completed', tone: 'neutral' },
  },
  car: {
    draft: { label: 'Draft', tone: 'neutral' },
    pending_review: { label: 'In review', tone: 'info' },
    listed: { label: 'Listed', tone: 'good' },
    paused: { label: 'Paused', tone: 'warn' },
    rejected: { label: 'Changes needed', tone: 'bad' },
  },
  permit: {
    none: { label: 'Not uploaded', tone: 'neutral' },
    pending: { label: 'In review', tone: 'info' },
    approved: { label: 'Verified driver', tone: 'good' },
    rejected: { label: 'Needs a new photo', tone: 'bad' },
  },
  payment: {
    submitted: { label: 'Checking payment', tone: 'info' },
    confirmed: { label: 'Payment received', tone: 'good' },
    rejected: { label: 'Payment not found', tone: 'bad' },
  },
  paymentMethod: {
    bank_transfer: { label: 'Bank transfer', tone: 'neutral' },
    wipay: { label: 'Card (WiPay)', tone: 'neutral' },
  },
  transmission: {
    automatic: { label: 'Automatic', tone: 'neutral' },
    manual: { label: 'Manual', tone: 'neutral' },
  },
  fuel: {
    gasoline: { label: 'Gasoline', tone: 'neutral' },
    diesel: { label: 'Diesel', tone: 'neutral' },
    hybrid: { label: 'Hybrid', tone: 'neutral' },
    electric: { label: 'Electric', tone: 'neutral' },
  },
} satisfies Record<string, Record<string, Label>>;

export type LabelKind = keyof typeof MAPS;

// Unknown codes are humanised ("pending_review" → "Pending review"), never shown raw.
export function labelFor(kind: LabelKind, code: string | null | undefined): Label {
  const hit = (MAPS[kind] as Record<string, Label>)[code ?? ''];
  if (hit) return hit;
  const words = (code ?? '').replace(/[_-]+/g, ' ').trim();
  return { label: words ? words[0].toUpperCase() + words.slice(1) : '—', tone: 'neutral' };
}

export function options(kind: LabelKind): { value: string; label: string }[] {
  return Object.entries(MAPS[kind]).map(([value, l]) => ({ value, label: (l as Label).label }));
}
