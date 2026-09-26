export type Area = { slug: string; name: string; island: 'trinidad' | 'tobago' };

export type Car = {
  id: string;
  host_id: string;
  make: string;
  model: string;
  year: number;
  transmission: 'automatic' | 'manual';
  seats: number;
  fuel: 'gasoline' | 'diesel' | 'hybrid' | 'electric';
  area: string;
  pickup_notes: string | null;
  description: string | null;
  daily_rate_cents: number;
  cleaning_fee_cents: number;
  deposit_cents: number;
  weekly_discount_pct: number;
  min_days: number;
  max_days: number;
  delivery_available: boolean;
  status: 'draft' | 'pending_review' | 'listed' | 'paused' | 'rejected';
  review_note: string | null;
  created_at: string;
};

export type CarPhoto = { id: string; car_id: string; path: string; position: number };

export type CarCard = Car & { photo: string | null };

export type Booking = {
  id: string;
  car_id: string;
  guest_id: string;
  host_id: string;
  start_date: string;
  end_date: string;
  days: number;
  daily_rate_cents: number;
  discount_cents: number;
  rental_cents: number;
  cleaning_fee_cents: number;
  service_fee_cents: number;
  total_cents: number;
  deposit_cents: number;
  host_fee_cents: number;
  host_payout_cents: number;
  status: import('./booking-status').BookingStatus;
  guest_message: string | null;
  status_note: string | null;
  created_at: string;
};

export const CAR_COLUMNS =
  'id, host_id, make, model, year, transmission, seats, fuel, area, pickup_notes, description, daily_rate_cents, cleaning_fee_cents, deposit_cents, weekly_discount_pct, min_days, max_days, delivery_available, status, review_note, created_at';

export const BOOKING_COLUMNS =
  'id, car_id, guest_id, host_id, start_date, end_date, days, daily_rate_cents, discount_cents, rental_cents, cleaning_fee_cents, service_fee_cents, total_cents, deposit_cents, host_fee_cents, host_payout_cents, status, guest_message, status_note, created_at';
