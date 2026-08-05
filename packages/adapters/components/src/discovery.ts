import type { ComponentSnapshot, DirectiveSnapshot, PropertySnapshot, SignalSnapshot, StandardCaptureSnapshot } from '@agent-devtools/protocol';
import { serialize, type CaptureAdapter, type RuntimeContext } from '@agent-devtools/runtime';

interface AngularDebugApi {
  getComponent?(element: Element): object | null;
  getDirectives?(element: Element): object[];
  getInjector?(element: Element): object | null;
}

const publicProperties = (instance: object, context: RuntimeContext, snapshot: StandardCaptureSnapshot): PropertySnapshot[] => {
  const properties: PropertySnapshot[] = [];
  for (const name of Object.keys(instance).filter(name => !name.startsWith('_')).slice(0, 100)) {
    let current: unknown;
    try {
      const descriptor = Object.getOwnPropertyDescriptor(instance, name);
      if (descriptor?.get) continue;
      current = descriptor && 'value' in descriptor ? descriptor.value : undefined;
    } catch { continue; }
    if (typeof current === 'function' && !isSignal(current)) continue;
    const serialized = serialize(isSignal(current) ? safeCall(current) : current, context.options.budget, name);
    snapshot.truncations.push(...serialized.truncations);
    properties.push({ name, value: serialized.value, category: 'property' });
  }
  return properties;
};

const isSignal = (value: unknown): value is (() => unknown) => {
  if (typeof value !== 'function') return false;
  try { return 'set' in value || 'asReadonly' in value || Object.prototype.hasOwnProperty.call(value, 'toString') || String(value).includes('[SIGNAL]'); }
  catch { return false; }
};
const safeCall = (signal: () => unknown): unknown => { try { return signal(); } catch (error) { return error instanceof Error ? `[Signal error: ${error.message}]` : '[Signal error]'; } };

export class AngularDiscoveryAdapter implements CaptureAdapter<StandardCaptureSnapshot> {
  readonly name = 'angular-discovery';
  readonly priority = 0;
  isAvailable(context: RuntimeContext): boolean { return !!(context.window as unknown as { ng?: AngularDebugApi }).ng; }
  capture(snapshot: StandardCaptureSnapshot, context: RuntimeContext): void {
    const api = (context.window as unknown as { ng: AngularDebugApi }).ng;
    const componentByHost = new Map<Element, ComponentSnapshot>();
    for (const element of context.document.querySelectorAll('*')) {
      let component: object | null = null;
      try { component = api.getComponent?.(element) ?? null; } catch { /* detached node */ }
      const hostRef = context.refs.ref(element, 'element');
      if (component) {
        const ref = context.refs.ref(component, 'component');
        const injector = safeObject(() => api.getInjector?.(element));
        const entry: ComponentSnapshot = {
          ref, name: (component.constructor?.name || 'AnonymousComponent').replace(/^_/, ''), host: hostRef,
          children: [], directives: [], properties: publicProperties(component, context, snapshot), destroyed: false,
          formFields: [], ...(injector ? { injector: context.refs.ref(injector, 'injector') } : {}),
        };
        componentByHost.set(element, entry); snapshot.components.push(entry);
        for (const [name, value] of Object.entries(component)) if (isSignal(value)) {
          const result = serialize(safeCall(value), context.options.budget);
          const signal: SignalSnapshot = { ref: context.refs.ref(value, 'signal'), signalType: 'signal', name, owner: ref, value: result.value, writable: 'set' in value, discovery: 'partial' };
          snapshot.signals.push(signal); snapshot.truncations.push(...result.truncations);
        }
      }
      const directives = safeArray(() => api.getDirectives?.(element));
      for (const directive of directives) {
        if (directive === component) continue;
        const entry: DirectiveSnapshot = {
          ref: context.refs.ref(directive, 'directive'), name: (directive.constructor?.name || 'AnonymousDirective').replace(/^_/, ''),
          host: hostRef, properties: publicProperties(directive, context, snapshot),
        };
        snapshot.directives.push(entry);
        if (component) componentByHost.get(element)?.directives.push(entry.ref);
      }
    }
    for (const [host, component] of componentByHost) {
      let parent = host.parentElement;
      while (parent) {
        const parentComponent = componentByHost.get(parent);
        if (parentComponent) { component.parent = parentComponent.ref; parentComponent.children.push(component.ref); break; }
        parent = parent.parentElement;
      }
    }
    snapshot.application.roots = snapshot.components.filter(component => !component.parent).map(component => component.ref);
  }
}

const safeObject = (read: () => object | null | undefined): object | undefined => { try { return read() ?? undefined; } catch { return undefined; } };
const safeArray = (read: () => object[] | undefined): object[] => { try { return read() ?? []; } catch { return []; } };
