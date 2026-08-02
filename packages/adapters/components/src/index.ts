import type { RuntimeAdapter, RuntimeContext } from '@ng-agent/runtime';
import type { PropertySnapshot, Snapshot } from '@ng-agent/protocol';

interface Definition { onPush?: boolean; inputs?: Record<string, unknown>; outputs?: Record<string, unknown> }
interface AngularDebugApi { getComponent?(element: Element): object | null; getDirectives?(element: Element): object[] }

const classify = (properties: PropertySnapshot[], definition: Definition | undefined): void => {
  const inputs = new Set(Object.keys(definition?.inputs ?? {})); const outputs = new Set(Object.keys(definition?.outputs ?? {}));
  for (const property of properties) {
    if (inputs.has(property.name) && outputs.has(`${property.name}Change`)) property.category = 'model';
    else if (inputs.has(property.name)) property.category = 'input';
    else if (outputs.has(property.name)) property.category = 'output';
  }
};

export class ComponentsAdapter implements RuntimeAdapter {
  readonly name = 'components'; readonly priority = 10;
  isAvailable(context: RuntimeContext) { return !!(context.window as unknown as { ng?: unknown }).ng; }
  capture(snapshot: Snapshot, context: RuntimeContext): void {
    const api = (context.window as unknown as { ng?: AngularDebugApi }).ng;
    const components = new Map<string, object>(); const directives = new Map<string, object>();
    for (const element of context.document.querySelectorAll('*')) {
      try {
        const component = api?.getComponent?.(element); if (component) components.set(context.refs.ref(component, 'component').id, component);
        for (const directive of api?.getDirectives?.(element) ?? []) directives.set(context.refs.ref(directive, 'directive').id, directive);
      } catch { /* Ignore nodes detached during discovery. */ }
    }
    for (const component of snapshot.components) {
      const instance = components.get(component.ref.id); if (!instance) continue;
      const definition = (instance.constructor as unknown as { ɵcmp?: Definition }).ɵcmp;
      component.changeDetection = definition?.onPush ? 'on-push' : 'default'; classify(component.properties, definition);
    }
    for (const directive of snapshot.directives) {
      const instance = directives.get(directive.ref.id); if (!instance) continue;
      classify(directive.properties, (instance.constructor as unknown as { ɵdir?: Definition }).ɵdir);
    }
  }
}
export const componentsAdapter = () => new ComponentsAdapter();
