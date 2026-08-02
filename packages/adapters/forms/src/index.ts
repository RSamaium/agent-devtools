import { getInstrumentation, serialize, type RuntimeAdapter, type RuntimeContext } from '@ng-agent/runtime';
import type { FormControlSnapshot, FormErrorSnapshot, Snapshot } from '@ng-agent/protocol';

interface AbstractControlLike { value?: unknown; valid?: boolean; invalid?: boolean; pending?: boolean; disabled?: boolean; dirty?: boolean; touched?: boolean; errors?: Record<string, unknown> | null; controls?: Record<string, AbstractControlLike> | AbstractControlLike[]; getRawValue?(): unknown }
const errorsOf = (errors: Record<string, unknown> | null | undefined, context: RuntimeContext): FormErrorSnapshot[] => Object.entries(errors ?? {}).map(([code, value]) => ({ code, value: serialize(value, context.options.budget).value }));
const captureControl = (control: AbstractControlLike, name: string, path: string, context: RuntimeContext): FormControlSnapshot => {
  const children = Array.isArray(control.controls) ? control.controls.map((child, index) => captureControl(child, String(index), `${path}.${index}`, context)) : Object.entries(control.controls ?? {}).map(([key, child]) => captureControl(child, key, path ? `${path}.${key}` : key, context));
  let rawValue: unknown; try { rawValue = control.getRawValue?.(); } catch { rawValue = undefined; }
  return { ref: context.refs.ref(control as object, 'field'), name, path, controlType: Array.isArray(control.controls) ? 'array' : control.controls ? 'group' : 'control', value: serialize(control.value, context.options.budget, path).value, ...(rawValue === undefined ? {} : { rawValue: serialize(rawValue, context.options.budget, path).value }), valid: !!control.valid, invalid: !!control.invalid, pending: !!control.pending, disabled: !!control.disabled, dirty: !!control.dirty, touched: !!control.touched, errors: errorsOf(control.errors, context), children };
};
export class FormsAdapter implements RuntimeAdapter {
  readonly name = 'forms'; readonly priority = 40;
  isAvailable(context: RuntimeContext) { return typeof (context.window as unknown as { ng?: { getDirectives?: unknown } }).ng?.getDirectives === 'function' || [...(getInstrumentation(context.window)?.records.values() ?? [])].some(item => item.kind === 'form'); }
  capture(snapshot: Snapshot, context: RuntimeContext): void {
    const api = (context.window as unknown as { ng?: { getDirectives(element: Element): object[] } }).ng;
    const seen = new Set<object>();
    if (api) for (const element of context.document.querySelectorAll('form,[formGroup],[ngForm]')) {
      let directives: object[] = []; try { directives = api.getDirectives(element); } catch { continue; }
      for (const directive of directives) {
        const name = directive.constructor?.name; if (name !== 'FormGroupDirective' && name !== 'NgForm') continue;
        const control = (directive as { control?: AbstractControlLike; form?: AbstractControlLike }).control ?? (directive as { form?: AbstractControlLike }).form;
        if (!control || seen.has(control as object)) continue; seen.add(control as object);
        snapshot.forms.push({ ref: context.refs.ref(control as object, 'form'), formType: name === 'NgForm' ? 'template-driven' : 'reactive', root: { ...captureControl(control, 'root', '', context), element: context.refs.ref(element, 'element') } });
      }
    }
    for (const record of getInstrumentation(context.window)?.records.values() ?? []) {
      if (record.kind !== 'form' || !record.value || typeof record.value !== 'object' || seen.has(record.value)) continue;
      seen.add(record.value);
      snapshot.forms.push({ ref: context.refs.ref(record.value, 'form'), ...(record.owner ? { owner: context.refs.ref(record.owner, 'component') } : {}), formType: record.metadata?.['type'] === 'template-driven' ? 'template-driven' : 'reactive', root: captureControl(record.value as AbstractControlLike, record.name, '', context) });
    }
  }
}
export const formsAdapter = () => new FormsAdapter();
