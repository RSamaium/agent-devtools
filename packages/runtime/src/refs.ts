import type { DomainId, RuntimeKind, RuntimeRef } from '@agent-devtools/protocol';

export class ReferenceRegistry {
  private readonly refs = new WeakMap<object, Map<RuntimeKind, RuntimeRef>>();
  private readonly objects = new Map<string, WeakRef<object>>();
  private counter = 0;
  constructor(readonly generation: number) {}

  ref(value: object, kind: RuntimeKind, domain: DomainId = domainForKind(kind)): RuntimeRef {
    const byKind = this.refs.get(value);
    const existing = byKind?.get(kind);
    if (existing) return existing;
    const prefix: Record<string, string> = { element: 'el', component: 'cmp', directive: 'dir', injector: 'inj', provider: 'prv', service: 'svc', signal: 'sig', computed: 'cpt', effect: 'eff', form: 'form', field: 'fld', route: 'route', store: 'store', selector: 'sel', 'network-request': 'net' };
    const ref = { id: `${prefix[kind] ?? 'ref'}-${++this.counter}`, domain, kind, generation: this.generation };
    const refs = byKind ?? new Map<RuntimeKind, RuntimeRef>(); refs.set(kind, ref); this.refs.set(value, refs);
    this.objects.set(ref.id, new WeakRef(value)); return ref;
  }
  resolve(ref: RuntimeRef): object | undefined {
    if (ref.generation !== this.generation) return undefined;
    return this.objects.get(ref.id)?.deref();
  }
}

const domainForKind = (kind: RuntimeKind): DomainId => ({
  element: 'application', component: 'components', directive: 'components', route: 'routing',
  injector: 'dependency-injection', provider: 'dependency-injection', service: 'dependency-injection',
  signal: 'state', computed: 'state', effect: 'state', store: 'state', selector: 'state',
  form: 'forms', field: 'forms', 'network-request': 'network',
} as Record<string, DomainId>)[kind] ?? 'application';
