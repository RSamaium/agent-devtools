import { describe, expect, it } from 'vitest';
import type { Snapshot } from '@ng-agent/protocol';
import { querySnapshot } from './query.js';

const createEmptySnapshot = (overrides: Partial<Snapshot> = {}): Snapshot => ({ id: 'snapshot-1', generation: 1, page: { url: 'http://localhost', title: '', capturedAt: 1 }, angular: { detected: true, devMode: true, roots: [], discovery: 'instrumented' }, components: [], directives: [], injectors: [], providers: [], signals: [], forms: [], signalForms: [], stores: [], warnings: [], truncations: [], ...overrides });

describe('querySnapshot', () => {
  it('filters nested Signal Form fields and paginates deterministically', () => {
    const snapshot = createEmptySnapshot({ signalForms: [{ ref: { id: 'form-1', kind: 'form', generation: 1 }, model: {}, fields: [{ ref: { id: 'fld-1', kind: 'field', generation: 1 }, path: 'user', value: {}, valid: false, invalid: true, pending: false, disabled: false, dirty: false, touched: false, errors: [], children: [{ ref: { id: 'fld-2', kind: 'field', generation: 1 }, path: 'user.email', value: '', valid: false, invalid: true, pending: false, disabled: false, dirty: true, touched: true, errors: [] }] }], valid: false, invalid: true, pending: false, errors: [], discovery: 'instrumented' }] });
    const result = querySnapshot(snapshot, { domain: 'fields', where: { invalid: true }, limit: 1 });
    expect(result.total).toBe(2); expect(result.items).toHaveLength(1); expect(result.nextCursor).toBe('1');
  });
});
