// Sample catalogue shown only when Supabase is not configured (demo mode).
import type { Area, Car } from './types';

export const DEMO_AREAS: Area[] = [
  { slug: 'port-of-spain', name: 'Port of Spain', island: 'trinidad' },
  { slug: 'piarco', name: 'Piarco Airport', island: 'trinidad' },
  { slug: 'chaguanas', name: 'Chaguanas', island: 'trinidad' },
  { slug: 'san-fernando', name: 'San Fernando', island: 'trinidad' },
  { slug: 'arima', name: 'Arima', island: 'trinidad' },
  { slug: 'diego-martin', name: 'Diego Martin & Westmoorings', island: 'trinidad' },
  { slug: 'couva', name: 'Couva & Point Lisas', island: 'trinidad' },
  { slug: 'sangre-grande', name: 'Sangre Grande', island: 'trinidad' },
  { slug: 'point-fortin', name: 'Point Fortin', island: 'trinidad' },
  { slug: 'scarborough', name: 'Scarborough', island: 'tobago' },
  { slug: 'crown-point', name: 'Crown Point (ANR Robinson Airport)', island: 'tobago' },
];

const base = {
  host_id: 'demo-host',
  pickup_notes: null,
  cleaning_fee_cents: 5000,
  deposit_cents: 100000,
  weekly_discount_pct: 10,
  min_days: 1,
  max_days: 30,
  status: 'listed' as const,
  review_note: null,
  created_at: '2026-09-01T00:00:00Z',
};

export const DEMO_CARS: Car[] = [
  { ...base, id: 'demo-aqua', make: 'Toyota', model: 'Aqua', year: 2017, transmission: 'automatic', seats: 5, fuel: 'hybrid', area: 'port-of-spain', daily_rate_cents: 32500, delivery_available: true, description: 'Fuel-sipping hybrid, perfect for getting around town. Aux + Bluetooth, cold AC.', pickup_notes: 'Pickup at Woodbrook, near the Oval.' },
  { ...base, id: 'demo-tiida', make: 'Nissan', model: 'Tiida', year: 2016, transmission: 'automatic', seats: 5, fuel: 'gasoline', area: 'piarco', daily_rate_cents: 30000, delivery_available: true, description: 'Meet-and-greet at Piarco arrivals. Roomy boot for luggage.' },
  { ...base, id: 'demo-hilux', make: 'Toyota', model: 'Hilux', year: 2020, transmission: 'manual', seats: 5, fuel: 'diesel', area: 'san-fernando', daily_rate_cents: 65000, deposit_cents: 250000, delivery_available: false, description: 'Double-cab 4x4 for the beach, the bush or moving house.' },
  { ...base, id: 'demo-vezel', make: 'Honda', model: 'Vezel', year: 2019, transmission: 'automatic', seats: 5, fuel: 'hybrid', area: 'chaguanas', daily_rate_cents: 45000, delivery_available: true, description: 'Compact SUV with reverse camera and Apple CarPlay.' },
  { ...base, id: 'demo-noah', make: 'Toyota', model: 'Noah', year: 2018, transmission: 'automatic', seats: 8, fuel: 'gasoline', area: 'arima', daily_rate_cents: 55000, delivery_available: false, description: 'Eight seats for the whole family — Maracas run, Carnival, airport pickup.' },
  { ...base, id: 'demo-swift', make: 'Suzuki', model: 'Swift', year: 2021, transmission: 'automatic', seats: 5, fuel: 'gasoline', area: 'crown-point', daily_rate_cents: 35000, delivery_available: true, description: 'Easy to park in Store Bay traffic. Delivered to the Tobago airport.' },
];
