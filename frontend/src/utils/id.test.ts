import { describe, expect, it } from '@jest/globals';

import { generateId } from '@/utils/id';

describe('generateId', () => {
  it('prefixes the generated id with the given prefix', () => {
    expect(generateId('tkt')).toMatch(/^tkt_/);
  });

  it('generates unique ids across repeated calls, even in the same millisecond', () => {
    const ids = new Set(Array.from({ length: 500 }, () => generateId('id')));
    expect(ids.size).toBe(500);
  });

  it('uses a different prefix per call site without colliding', () => {
    const a = generateId('a');
    const b = generateId('b');
    expect(a).not.toBe(b);
    expect(a.startsWith('a_')).toBe(true);
    expect(b.startsWith('b_')).toBe(true);
  });
});
