import { describe, it, expect } from 'vitest';
import { allowedActions, canTransition } from './booking-status';
import { labelFor } from './labels';
import { toE164, waLink } from './phone';

const today = '2030-01-10';

describe('booking state machine', () => {
  it('matches the SQL edges', () => {
    expect(canTransition('requested', 'approved')).toBe(true);
    expect(canTransition('approved', 'completed')).toBe(false);
    expect(canTransition('completed', 'cancelled')).toBe(false);
    expect(canTransition('paid', 'active')).toBe(true);
  });
  it('hosts decide requests; guests can only cancel before paying', () => {
    expect(allowedActions({ status: 'requested', start_date: '2030-02-01' }, 'host', today)).toEqual(['approve', 'decline']);
    expect(allowedActions({ status: 'requested', start_date: '2030-02-01' }, 'guest', today)).toEqual(['cancel']);
    expect(allowedActions({ status: 'paid', start_date: '2030-02-01' }, 'guest', today)).toEqual([]);
  });
  it('a trip starts only on or after pickup day', () => {
    expect(allowedActions({ status: 'paid', start_date: '2030-01-11' }, 'host', today)).toEqual([]);
    expect(allowedActions({ status: 'paid', start_date: '2030-01-10' }, 'host', today)).toEqual(['start']);
  });
  it('only admins confirm payments', () => {
    expect(allowedActions({ status: 'approved', start_date: '2030-02-01' }, 'host', today)).not.toContain('confirm_payment');
    expect(allowedActions({ status: 'approved', start_date: '2030-02-01' }, 'admin', today)).toContain('confirm_payment');
  });
});

describe('labels never leak raw codes', () => {
  it('maps known and humanises unknown codes', () => {
    expect(labelFor('booking', 'paid').label).toBe('Confirmed');
    expect(labelFor('car', 'pending_review').label).toBe('In review');
    expect(labelFor('booking', 'some_new_state').label).toBe('Some new state');
    expect(labelFor('booking', null).label).toBe('—');
  });
});

describe('phones', () => {
  it('normalises T&T formats to E.164', () => {
    expect(toE164('700-1234')).toBe('+18687001234');
    expect(toE164('868 700 1234')).toBe('+18687001234');
    expect(toE164('1 (868) 700-1234')).toBe('+18687001234');
    expect(toE164('+44 7700 900123')).toBe('+447700900123');
    expect(toE164('will add later')).toBeNull();
    expect(toE164('12')).toBeNull();
  });
  it('builds wa.me links', () => {
    expect(waLink('+18687001234', 'Hi there')).toBe('https://wa.me/18687001234?text=Hi%20there');
  });
});
