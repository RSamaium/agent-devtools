import { describe, expect, it } from 'vitest';
import type { FormSnapshot, SignalFormSnapshot } from '@adp-devtools/protocol';
import { createSignalFormMigrationPlan, generateSignalFormAssertions } from './assistance.js';

const ref = (id: string, kind: 'form' | 'field') => ({ id, domain: 'forms', kind, generation: 1 } as const);

describe('Angular form assistance', () => {
  it('creates a deterministic Reactive Forms migration plan', () => {
    const form: FormSnapshot = { ref: ref('form-1', 'form'), formType: 'reactive', root: { ref: ref('fld-1', 'field'), name: 'root', path: '', controlType: 'group', value: { email: 'a@b.test' }, valid: true, invalid: false, pending: false, disabled: false, dirty: false, touched: false, errors: [], children: [{ ref: ref('fld-2', 'field'), name: 'email', path: 'email', controlType: 'control', value: 'a@b.test', valid: true, invalid: false, pending: false, disabled: false, dirty: false, touched: false, errors: [], children: [] }] } };
    expect(createSignalFormMigrationPlan(form)).toMatchObject({ fields: [{ path: 'email', initialValue: 'a@b.test' }] });
  });
  it('generates stable Signal Forms assertions', () => {
    const form: SignalFormSnapshot = { ref: ref('form-1', 'form'), model: { email: '' }, valid: false, invalid: true, pending: false, errors: [], discovery: 'instrumented', fields: [{ ref: ref('fld-1', 'field'), path: 'email', value: '', valid: false, invalid: true, pending: false, disabled: false, dirty: true, touched: true, errors: [{ code: 'required' }] }] };
    expect(generateSignalFormAssertions(form)).toContain('["required"]');
  });
});
