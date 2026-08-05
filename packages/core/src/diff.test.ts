import { describe, expect, it } from 'vitest';
import type { Snapshot } from '@agent-devtools/protocol';
import { diffSnapshots } from './diff.js';

const base = (id: string): Snapshot => ({ id, generation: 1, runtime: { environment: 'web', capturedAt: 1 }, adapters: [], domains: {}, warnings: [], truncations: [] });

describe('diffSnapshots', () => {
  it('reports a newly captured domain', () => {
    const before = base('a'); const after = base('b');
    after.domains.state = { id: 'state', version: '1.0.0', data: { signals: [] } };
    expect(diffSnapshots(before, after).entries).toEqual([expect.objectContaining({ operation: 'added', path: 'domains.state' })]);
  });
});
