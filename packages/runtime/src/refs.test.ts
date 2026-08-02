import { describe, expect, it } from 'vitest';
import { ReferenceRegistry } from './refs.js';

describe('ReferenceRegistry', () => {
  it('keeps separate semantic references for the same object', () => {
    const value = {}; const refs = new ReferenceRegistry(3);
    expect(refs.ref(value, 'service')).not.toEqual(refs.ref(value, 'provider'));
    expect(refs.ref(value, 'component').id).toMatch(/^cmp-/);
    expect(refs.resolve(refs.ref(value, 'service'))).toBe(value);
  });
});
