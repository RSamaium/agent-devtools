import { getInstrumentation, serialize, type CaptureAdapter, type RuntimeContext } from '@adp-devtools/runtime';
import type { StandardCaptureSnapshot } from '@adp-devtools/protocol';
export class NgrxStoreAdapter implements CaptureAdapter<StandardCaptureSnapshot> {
  readonly name = 'ngrx-store'; readonly priority = 60;
  isAvailable(context: RuntimeContext) { return [...(getInstrumentation(context.window)?.records.values() ?? [])].some(item => item.kind === 'store' && item.metadata?.['type'] === 'ngrx'); }
  capture(snapshot: StandardCaptureSnapshot, context: RuntimeContext): void {
    for (const record of getInstrumentation(context.window)?.records.values() ?? []) if (record.kind === 'store' && record.metadata?.['type'] === 'ngrx') {
      const stateReader = record.metadata?.['state']; const state = typeof stateReader === 'function' ? (stateReader as () => unknown)() : typeof record.value === 'function' ? (record.value as () => unknown)() : record.metadata?.['snapshot'] ?? {};
      const actions = getInstrumentation(context.window)?.events.filter(item => item.type === 'ngrx-action') ?? [];
      snapshot.stores.push({ ref: context.refs.ref(record.value as object, 'store'), name: record.name, storeType: 'ngrx', state: serialize(state, context.options.budget).value, ...(actions.length ? { lastAction: serialize(actions.at(-1)?.value, context.options.budget).value, actions: actions.slice(-20).map(action => serialize(action.value, context.options.budget).value) } : {}), discovery: 'instrumented' });
    }
  }
}
export const ngrxStoreAdapter = () => new NgrxStoreAdapter();
