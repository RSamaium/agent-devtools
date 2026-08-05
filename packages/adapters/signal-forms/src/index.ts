import { getInstrumentation, serialize, type CaptureAdapter, type RuntimeContext } from '@agent-devtools/runtime';
import type { FormErrorSnapshot, SignalFormFieldSnapshot, StandardCaptureSnapshot } from '@agent-devtools/protocol';

type Readable<T> = T | (() => T);
interface FieldStateLike { value?: Readable<unknown>; valid?: Readable<boolean>; invalid?: Readable<boolean>; pending?: Readable<boolean>; submitting?: Readable<boolean>; disabled?: Readable<boolean>; dirty?: Readable<boolean>; touched?: Readable<boolean>; errors?: Readable<Array<{ kind?: string; code?: string; message?: string; source?: string; dependsOn?: string[] }>> }
interface DebugApi { getDirectives?(element: Element): object[]; getComponent?(element: Element): object | null }

const read = <T>(value: Readable<T> | undefined, fallback: T): T => { try { return typeof value === 'function' ? (value as () => T)() : value ?? fallback; } catch { return fallback; } };
const errors = (state: FieldStateLike): FormErrorSnapshot[] => read(state.errors, []).map(error => ({ code: error.kind ?? error.code ?? 'validation', ...(error.message ? { message: error.message } : {}), ...(error.source ? { source: error.source } : {}), ...(error.dependsOn ? { dependsOn: error.dependsOn, kind: 'cross-field' as const } : {}) }));
const captureField = (value: object, path: string, context: RuntimeContext, snapshot: StandardCaptureSnapshot): SignalFormFieldSnapshot => {
  let state: FieldStateLike = value as FieldStateLike; try { if (typeof value === 'function') state = (value as () => FieldStateLike)(); } catch { /* retain object */ }
  const serialized = serialize(read(state.value, undefined), context.options.budget, path); snapshot.truncations.push(...serialized.truncations);
  return { ref: context.refs.ref(value, 'field'), path, value: serialized.value, valid: read(state.valid, false), invalid: read(state.invalid, false), pending: read(state.pending, false), disabled: read(state.disabled, false), dirty: read(state.dirty, false), touched: read(state.touched, false), errors: errors(state) };
};
const objectValuesWithoutGetters = (value: object): object[] => Object.keys(value).flatMap(key => {
  try { const descriptor = Object.getOwnPropertyDescriptor(value, key); const item: unknown = descriptor && 'value' in descriptor ? descriptor.value : undefined; return item && (typeof item === 'object' || typeof item === 'function') ? [item as object] : []; }
  catch { return []; }
});
const isSignal = (value: object): value is (() => unknown) => {
  if (typeof value !== 'function') return false;
  try { return 'set' in value || 'asReadonly' in value || Object.prototype.hasOwnProperty.call(value, 'toString') || String(value).includes('[SIGNAL]'); } catch { return false; }
};
const unwrapSignal = (value: object): object | undefined => {
  if (!isSignal(value)) return undefined;
  try { const result = value(); return result && (typeof result === 'object' || typeof result === 'function') ? result as object : undefined; } catch { return undefined; }
};

export class SignalFormsAdapter implements CaptureAdapter<StandardCaptureSnapshot> {
  readonly name = 'signal-forms'; readonly priority = 50;
  isAvailable(context: RuntimeContext) { return !!getInstrumentation(context.window) || typeof (context.window as unknown as { ng?: { getDirectives?: unknown } }).ng?.getDirectives === 'function'; }
  capture(snapshot: StandardCaptureSnapshot, context: RuntimeContext): void {
    const registry = getInstrumentation(context.window); const fieldsByObject = new Map<object, SignalFormFieldSnapshot>();
    for (const record of registry?.records.values() ?? []) if (record.kind === 'signal-form') {
      const root = record.value as FieldStateLike & Record<string, unknown>; let rootState: FieldStateLike = root;
      try { if (typeof record.value === 'function') rootState = (record.value as () => FieldStateLike)(); } catch { /* preserve fallback */ }
      const paths = Array.isArray(record.metadata?.['fields']) ? record.metadata['fields'] as Array<{ path: string; field: object }> : [];
      const fields = paths.map(item => captureField(item.field, item.path, context, snapshot));
      paths.forEach((item, index) => { const captured = fields[index]; if (captured) fieldsByObject.set(item.field, captured); });
      const serializedModel = serialize(read(rootState.value, record.metadata?.['model']), context.options.budget, record.name); snapshot.truncations.push(...serializedModel.truncations);
      snapshot.signalForms.push({ ref: context.refs.ref(record.value as object, 'form'), name: record.name, ...(record.owner ? { owner: context.refs.ref(record.owner, 'component') } : {}), model: serializedModel.value, fields, valid: read(rootState.valid, fields.every(item => item.valid)), invalid: read(rootState.invalid, fields.some(item => item.invalid)), pending: read(rootState.pending, fields.some(item => item.pending)), ...(rootState.submitting === undefined ? {} : { submitting: read(rootState.submitting, false) }), errors: errors(rootState), discovery: 'instrumented', ...(record.metadata?.['schema'] === undefined ? {} : { schema: serialize(record.metadata['schema'], context.options.budget).value }) });
    }

    const api = (context.window as unknown as { ng?: DebugApi }).ng; const partial = new Map<object, SignalFormFieldSnapshot[]>();
    if (api) for (const element of context.document.querySelectorAll('*')) {
      let directives: object[] = []; try { directives = api.getDirectives?.(element) ?? []; } catch { continue; }
      for (const directive of directives) {
        if (!directive.constructor?.name.includes('FormField')) continue;
        const candidates = objectValuesWithoutGetters(directive); const unwrapped = candidates.flatMap(candidate => { const value = unwrapSignal(candidate); return value ? [value] : []; });
        const known = [...candidates, ...unwrapped].map(candidate => fieldsByObject.get(candidate)).find(Boolean);
        const candidate = known ? undefined : unwrapped.find(item => typeof item === 'function' || Object.keys(item).some(key => ['value', 'valid', 'errors'].includes(key)));
        const captured = known ?? (candidate ? captureField(candidate, element.getAttribute('name') || `field-${fieldsByObject.size + 1}`, context, snapshot) : undefined);
        if (!captured) continue;
        captured.element = context.refs.ref(element, 'element');
        let component: object | null = null; try { component = api.getComponent?.(element) ?? null; } catch { /* no component */ }
        if (component) {
          captured.controlComponent = context.refs.ref(component, 'component');
          const owner = snapshot.components.find(item => item.ref.id === captured.controlComponent?.id); if (owner && !owner.formFields.some(ref => ref.id === captured.ref.id)) owner.formFields.push(captured.ref);
        }
        if (candidate) { const group = element.closest('form') ?? context.document; partial.set(group, [...(partial.get(group) ?? []), captured]); }
      }
    }
    for (const [owner, fields] of partial) snapshot.signalForms.push({ ref: context.refs.ref(owner, 'form'), model: Object.fromEntries(fields.map(item => [item.path, item.value])), fields, valid: fields.every(item => item.valid), invalid: fields.some(item => item.invalid), pending: fields.some(item => item.pending), errors: fields.flatMap(item => item.errors), discovery: 'partial' });
    if (partial.size) context.warn('SIGNAL_FORMS_PARTIAL', 'Signal Forms were reconstructed from DOM bindings; add explicit instrumentation for schemas and stable names.', 'signal-forms');
  }
}
export const signalFormsAdapter = () => new SignalFormsAdapter();
