import type { RuntimeRef, StandardCaptureSnapshot } from '@adp-devtools/protocol';
import { getInstrumentation, serialize, type CaptureAdapter, type RuntimeContext } from '@adp-devtools/runtime';

interface AngularDebugApi { getComponent?(element: Element): object | null }
type StoreObject = Record<string, unknown>;

const isSignal = (value: unknown): value is (() => unknown) => {
  if (typeof value !== 'function') return false;
  try { return 'set' in value || 'asReadonly' in value || Object.prototype.hasOwnProperty.call(value, 'toString') || String(value).includes('[SIGNAL]'); }
  catch { return false; }
};

const readSignal = (value: () => unknown): unknown => {
  try { return value(); }
  catch (error) { return error instanceof Error ? `[Signal error: ${error.message}]` : '[Signal error]'; }
};

const describeStore = (
  store: StoreObject,
  name: string,
  owner: RuntimeRef | undefined,
  injector: RuntimeRef | undefined,
  discovery: 'partial' | 'instrumented',
  snapshot: StandardCaptureSnapshot,
  context: RuntimeContext,
): void => {
  const signalEntries = Object.entries(store).filter(([, value]) => isSignal(value));
  if (signalEntries.length === 0) return;
  const ref = context.refs.ref(store, 'store');
  const state: Record<string, unknown> = {};
  const signals: RuntimeRef[] = [];
  for (const [property, signal] of signalEntries) {
    const signalFunction = signal as (() => unknown) & { set?: unknown };
    state[property] = readSignal(signalFunction);
    const signalRef = context.refs.ref(signalFunction, 'signal');
    signals.push(signalRef);
    if (!snapshot.signals.some(item => item.ref.id === signalRef.id)) {
      const result = serialize(state[property], context.options.budget, `${name}.${property}`);
      snapshot.signals.push({
        ref: signalRef,
        signalType: 'set' in signalFunction ? 'signal' : 'computed',
        name: property,
        owner: ref,
        value: result.value,
        writable: 'set' in signalFunction,
        discovery,
      });
      snapshot.truncations.push(...result.truncations);
    }
  }
  const methods = Object.entries(store)
    .filter(([, value]) => typeof value === 'function' && !isSignal(value))
    .map(([property]) => property);
  const result = serialize(state, context.options.budget, name);
  snapshot.truncations.push(...result.truncations);
  snapshot.stores.push({
    ref, name, storeType: 'signal-store', state: result.value, signals, methods,
    ...(owner ? { owner } : {}), ...(injector ? { injector } : {}), discovery,
  });
};

export class NgrxSignalStoreAdapter implements CaptureAdapter<StandardCaptureSnapshot> {
  readonly name = 'ngrx-signal-store';
  readonly priority = 61;

  isAvailable(context: RuntimeContext): boolean {
    return !!getInstrumentation(context.window) || !!(context.window as unknown as { ng?: AngularDebugApi }).ng;
  }

  capture(snapshot: StandardCaptureSnapshot, context: RuntimeContext): void {
    const visited = new WeakSet<object>();
    for (const record of getInstrumentation(context.window)?.records.values() ?? []) {
      if (record.kind !== 'store' || record.metadata?.['type'] !== 'signal-store' || !record.value || typeof record.value !== 'object') continue;
      visited.add(record.value);
      describeStore(record.value as StoreObject, record.name, undefined, undefined, 'instrumented', snapshot, context);
    }

    const api = (context.window as unknown as { ng?: AngularDebugApi }).ng;
    if (!api) return;
    for (const element of context.document.querySelectorAll('*')) {
      let component: object | null = null;
      try { component = api.getComponent?.(element) ?? null; } catch { continue; }
      if (!component) continue;
      const componentSnapshot = snapshot.components.find(item => context.refs.resolve(item.ref) === component);
      for (const [property, candidate] of Object.entries(component as Record<string, unknown>)) {
        if (!candidate || typeof candidate !== 'object' || visited.has(candidate)) continue;
        const constructorName = candidate.constructor?.name ?? '';
        if (!property.toLocaleLowerCase().endsWith('store') && !constructorName.toLocaleLowerCase().endsWith('store')) continue;
        if (!Object.values(candidate).some(isSignal)) continue;
        visited.add(candidate);
        describeStore(
          candidate as StoreObject,
          constructorName && constructorName !== 'Object' ? constructorName : property,
          componentSnapshot?.ref,
          componentSnapshot?.injector,
          'partial', snapshot, context,
        );
      }
    }
  }
}

export const ngrxSignalStoreAdapter = (): NgrxSignalStoreAdapter => new NgrxSignalStoreAdapter();
