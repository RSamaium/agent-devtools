import { describe, expect, it } from 'vitest';
import type { Snapshot } from '@adp-devtools/protocol';
import { querySnapshot } from './query.js';

const snapshot: Snapshot = {
  id: 'snapshot-1', generation: 1,
  runtime: { environment: 'web', capturedAt: 1 }, adapters: [],
  domains: { components: { id: 'components', version: '1.0.0', data: { components: [{ name: 'CheckoutComponent', invalid: true }, { name: 'CartComponent', invalid: false }] } } },
  warnings: [], truncations: [],
};

describe('querySnapshot', () => {
  it('filters a domain resource and paginates deterministically', () => {
    const result = querySnapshot(snapshot, { domain: 'components', resource: 'components', where: { invalid: true }, limit: 1 });
    expect(result.total).toBe(1); expect(result.items).toHaveLength(1); expect(result.nextCursor).toBeUndefined();
  });
});
