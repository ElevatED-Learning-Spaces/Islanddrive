import { describe, it, expect } from 'vitest';
import { safeNext } from './safe-next';

describe('safeNext', () => {
  it('keeps same-site paths', () => {
    expect(safeNext('/trips')).toBe('/trips');
    expect(safeNext('/cars/abc?start=2030-01-01')).toBe('/cars/abc?start=2030-01-01');
  });
  it('rejects anything that could leave the site', () => {
    for (const bad of ['//evil.com', '/\\evil.com', '/\\/evil.com', 'https://evil.com', 'evil.com', '/\tevil', '', null, undefined]) {
      expect(safeNext(bad)).toBe('/');
    }
  });
});
