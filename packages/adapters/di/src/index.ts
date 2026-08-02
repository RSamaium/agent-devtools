import { getInstrumentation, serialize, type RuntimeAdapter, type RuntimeContext } from '@ng-agent/runtime';
import type { InjectorSnapshot, Snapshot } from '@ng-agent/protocol';

interface ProviderRecord { token: unknown; provider: unknown; isViewProvider?: boolean }
interface InjectorMetadata { type: 'element' | 'environment' | 'null'; source: unknown }
interface AngularDebugApi {
  getInjector(element: Element): object | null;
  ɵgetInjectorMetadata?(injector: object): InjectorMetadata | null;
  ɵgetInjectorResolutionPath?(injector: object): object[];
  ɵgetInjectorProviders?(injector: object): ProviderRecord[];
}

export class DiAdapter implements RuntimeAdapter {
  readonly name = 'di'; readonly priority = 20;
  isAvailable(context: RuntimeContext) {
    return typeof (context.window as unknown as { ng?: { getInjector?: unknown } }).ng?.getInjector === 'function' || !!getInstrumentation(context.window);
  }

  capture(snapshot: Snapshot, context: RuntimeContext): void {
    const registry = getInstrumentation(context.window);
    const environmentByObject = new Map<object, InjectorSnapshot>();
    for (const record of registry?.records.values() ?? []) {
      if (record.kind !== 'injector' || record.metadata?.['type'] !== 'environment-injector' || !record.value || typeof record.value !== 'object') continue;
      const entry: InjectorSnapshot = {
        ref: context.refs.ref(record.value, 'injector'), injectorType: 'environment', name: record.name,
        children: [], providers: [],
      };
      environmentByObject.set(record.value, entry); snapshot.injectors.push(entry);
    }
    for (const record of registry?.records.values() ?? []) {
      if (record.kind !== 'injector' || !record.value || typeof record.value !== 'object') continue;
      const entry = environmentByObject.get(record.value); const parent = record.metadata?.['parent'];
      if (entry && parent && typeof parent === 'object') {
        const parentEntry = environmentByObject.get(parent);
        if (parentEntry) { entry.parent = parentEntry.ref; parentEntry.children.push(entry.ref); }
      }
    }

    const api = (context.window as unknown as { ng?: AngularDebugApi }).ng;
    const byObject = new Map<object, InjectorSnapshot>(environmentByObject); const byElement = new Map<Element, InjectorSnapshot>();
    const interestingHosts = new Set([...snapshot.components, ...snapshot.directives].flatMap(item => item.host ? [item.host.id] : []));
    if (api) for (const element of context.document.querySelectorAll('*')) {
      const host = context.refs.ref(element, 'element'); if (!interestingHosts.has(host.id)) continue;
      let injector: object | null; try { injector = api.getInjector(element); } catch { continue; }
      if (!injector) continue;
      let entry = byObject.get(injector);
      if (!entry) {
        const component = snapshot.components.find(item => item.host?.id === host.id);
        entry = { ref: context.refs.ref(injector, 'injector'), injectorType: 'element', name: element.tagName.toLowerCase(), children: [], providers: [], ...(component ? { owner: component.ref } : {}) };
        byObject.set(injector, entry); snapshot.injectors.push(entry);
      }
      byElement.set(element, entry);
    }
    if (api?.ɵgetInjectorResolutionPath) for (const entry of [...byObject.values()]) {
      const injectorObject = context.refs.resolve(entry.ref); if (!injectorObject) continue;
      let path: object[] = []; try { path = api.ɵgetInjectorResolutionPath(injectorObject); } catch { continue; }
      let child = entry;
      for (const parentObject of path.slice(1)) {
        let metadata: InjectorMetadata | null = null; try { metadata = api.ɵgetInjectorMetadata?.(parentObject) ?? null; } catch { /* unavailable */ }
        if (metadata?.type === 'null') break;
        let parent = byObject.get(parentObject);
        if (!parent) {
          parent = { ref: context.refs.ref(parentObject, 'injector'), injectorType: metadata?.type === 'environment' ? 'environment' : 'element', ...(typeof metadata?.source === 'string' && metadata.source ? { name: metadata.source } : {}), children: [], providers: [] };
          byObject.set(parentObject, parent); snapshot.injectors.push(parent);
        }
        if (!child.parent) child.parent = parent.ref;
        if (!parent.children.some(ref => ref.id === child.ref.id)) parent.children.push(child.ref);
        child = parent;
      }
    }
    for (const [element, entry] of byElement) {
      if (entry.parent) continue;
      let parent = element.parentElement;
      while (parent) {
        const parentInjector = byElement.get(parent);
        if (parentInjector && parentInjector.ref.id !== entry.ref.id) { entry.parent = parentInjector.ref; parentInjector.children.push(entry.ref); break; }
        parent = parent.parentElement;
      }
    }

    if (api?.ɵgetInjectorProviders) for (const [injectorObject, injector] of byObject) {
      let records: ProviderRecord[] = []; try { records = api.ɵgetInjectorProviders(injectorObject); } catch { continue; }
      for (const record of records) {
        const ref = context.refs.ref(record, 'provider'); if (snapshot.providers.some(provider => provider.ref.id === ref.id)) continue;
        const provider = { ref, token: tokenName(record.token), providerType: providerType(record.provider), injector: injector.ref, observedConsumers: injector.owner ? [injector.owner] : [], possibleConsumers: [] };
        snapshot.providers.push(provider); if (!injector.providers.some(item => item.id === ref.id)) injector.providers.push(ref);
      }
    }

    const defaultEnvironment = [...environmentByObject.values()].find(item => !item.parent);
    for (const record of registry?.records.values() ?? []) {
      if (record.kind !== 'service' && record.kind !== 'store') continue;
      const explicitInjector = record.metadata?.['injector'];
      const injector = explicitInjector && typeof explicitInjector === 'object' ? environmentByObject.get(explicitInjector) : defaultEnvironment;
      if (!injector || !record.value || (typeof record.value !== 'object' && typeof record.value !== 'function')) continue;
      const provider = {
        ref: context.refs.ref(record.value as object, 'provider'), token: typeof record.metadata?.['token'] === 'string' ? record.metadata['token'] : record.name,
        providerType: 'value' as const, injector: injector.ref,
        ...(record.metadata?.['exposeInstance'] === true ? { instance: serialize(record.value, context.options.budget, record.name).value } : {}),
        observedConsumers: record.owner ? [context.refs.ref(record.owner, 'component')] : [], possibleConsumers: [],
      };
      snapshot.providers.push(provider); injector.providers.push(provider.ref);
    }
  }
}
export const diAdapter = () => new DiAdapter();

const tokenName = (token: unknown): string => {
  if (typeof token === 'function' && token.name) return token.name.replace(/^_/, '');
  if (token && typeof token === 'object') {
    const description = Object.getOwnPropertyDescriptor(token, 'description')?.value;
    if (typeof description === 'string' && description) return description;
    const name = Object.getOwnPropertyDescriptor(token, 'name')?.value;
    if (typeof name === 'string' && name) return name;
    const prototype: object | null = Object.getPrototypeOf(token) as object | null;
    const constructorValue: unknown = prototype ? Object.getOwnPropertyDescriptor(prototype, 'constructor')?.value : undefined;
    const constructorName = typeof constructorValue === 'function' ? constructorValue.name : undefined;
    if (typeof constructorName === 'string' && constructorName !== 'Object') return constructorName;
  }
  return typeof token === 'string' ? token : '[Anonymous token]';
};
const providerType = (provider: unknown): 'class' | 'value' | 'factory' | 'existing' | 'unknown' => {
  if (typeof provider === 'function') return 'class';
  if (!provider || typeof provider !== 'object') return 'value';
  if ('useFactory' in provider) return 'factory'; if ('useExisting' in provider) return 'existing'; if ('useValue' in provider) return 'value'; if ('useClass' in provider) return 'class'; return 'unknown';
};
