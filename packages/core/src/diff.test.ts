import { describe, expect, it } from 'vitest';
import type { Snapshot } from '@ng-agent/protocol';
import { diffSnapshots } from './diff.js';

const base = (id: string): Snapshot => ({
  id, generation: 1, page: { url: 'http://localhost', title: '', capturedAt: 1 },
  angular: { detected: true, devMode: true, roots: [], discovery: 'partial' },
  components: [], directives: [], injectors: [], providers: [], signals: [], forms: [], signalForms: [], stores: [], warnings: [], truncations: [],
});

describe('diffSnapshots', () => {
  it('reports newly discovered signals', () => {
    const before = base('a'); const after = base('b');
    after.signals.push({ ref: { id: 'sig-1', kind: 'signal', generation: 1 }, signalType: 'signal', value: 1, writable: true, discovery: 'partial' });
    expect(diffSnapshots(before, after).entries).toEqual([expect.objectContaining({ operation: 'added', path: 'signals.sig-1' })]);
  });
});
