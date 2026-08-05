import type { FormControlSnapshot, FormSnapshot, SerializedValue, SignalFormSnapshot } from '@agent-devtools/protocol';

export interface SignalFormMigrationField { path: string; initialValue: SerializedValue; disabled: boolean; observedErrorCodes: string[] }
export interface SignalFormMigrationPlan { sourceForm: string; model: SerializedValue; fields: SignalFormMigrationField[]; warnings: string[] }

const flattenControls = (control: FormControlSnapshot): FormControlSnapshot[] => [control, ...control.children.flatMap(flattenControls)];

export function createSignalFormMigrationPlan(form: FormSnapshot): SignalFormMigrationPlan {
  const fields = flattenControls(form.root).filter(control => control.controlType === 'control');
  return {
    sourceForm: form.ref.id,
    model: form.root.rawValue ?? form.root.value,
    fields: fields.map(field => ({ path: field.path, initialValue: field.rawValue ?? field.value, disabled: field.disabled, observedErrorCodes: field.errors.map(error => error.code) })),
    warnings: ['Validator functions and async behavior cannot be reconstructed from runtime values alone.', 'Review cross-field dependencies and conditional fields before replacing the original form.'],
  };
}

export function generateSignalFormAssertions(form: SignalFormSnapshot, expression = 'signalForm'): string {
  const lines = [`expect(${expression}.ref.id).toBe(${JSON.stringify(form.ref.id)});`, `expect(${expression}.valid).toBe(${String(form.valid)});`, `expect(${expression}.pending).toBe(${String(form.pending)});`];
  for (const field of form.fields) {
    const lookup = `${expression}.fields.find(field => field.path === ${JSON.stringify(field.path)})!`;
    lines.push(`expect(${lookup}.value).toEqual(${JSON.stringify(field.value)});`, `expect(${lookup}.valid).toBe(${String(field.valid)});`);
    if (field.errors.length) lines.push(`expect(${lookup}.errors.map(error => error.code)).toEqual(${JSON.stringify(field.errors.map(error => error.code))});`);
  }
  return lines.join('\n');
}
