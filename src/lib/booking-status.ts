// Booking state machine — mirrors public.booking_transition_ok() in SQL, which
// is the real guard; this copy decides which buttons each person sees.
export type BookingStatus =
  | 'requested' | 'approved' | 'declined' | 'cancelled' | 'expired' | 'paid' | 'active' | 'completed';

const EDGES: Record<BookingStatus, BookingStatus[]> = {
  requested: ['approved', 'declined', 'cancelled', 'expired'],
  approved: ['paid', 'cancelled', 'expired'],
  paid: ['active', 'cancelled'],
  active: ['completed'],
  declined: [],
  cancelled: [],
  expired: [],
  completed: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return EDGES[from]?.includes(to) ?? false;
}

export type Actor = 'guest' | 'host' | 'admin';
export type BookingAction = 'approve' | 'decline' | 'cancel' | 'start' | 'complete' | 'confirm_payment';

const TARGET: Record<BookingAction, BookingStatus> = {
  approve: 'approved',
  decline: 'declined',
  cancel: 'cancelled',
  start: 'active',
  complete: 'completed',
  confirm_payment: 'paid',
};

// Who may do what, from which state. Paid trips are cancelled by an admin
// (refunds are handled by hand — DECISIONS.md #5).
export function allowedActions(
  b: { status: BookingStatus; start_date: string },
  actor: Actor,
  today: string,
): BookingAction[] {
  const out: BookingAction[] = [];
  const s = b.status;
  if (actor === 'host') {
    if (s === 'requested') out.push('approve', 'decline');
    if (s === 'approved') out.push('cancel');
    if (s === 'paid' && b.start_date <= today) out.push('start');
    if (s === 'active') out.push('complete');
  }
  if (actor === 'guest') {
    if (s === 'requested' || s === 'approved') out.push('cancel');
  }
  if (actor === 'admin') {
    if (s === 'approved') out.push('confirm_payment');
    if (s === 'requested' || s === 'approved' || s === 'paid') out.push('cancel');
    if (s === 'paid' && b.start_date <= today) out.push('start');
    if (s === 'active') out.push('complete');
  }
  return out.filter((a) => canTransition(s, TARGET[a]));
}

export function targetStatus(a: BookingAction): BookingStatus {
  return TARGET[a];
}

// Statuses that hold the car's calendar.
export const HOLDING: BookingStatus[] = ['approved', 'paid', 'active', 'completed'];
