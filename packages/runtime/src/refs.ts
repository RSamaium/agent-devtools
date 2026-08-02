import type { RuntimeKind, RuntimeRef } from '@ng-agent/protocol';

export class ReferenceRegistry {
  private readonly refs = new WeakMap<object, Map<RuntimeKind, RuntimeRef>>();
  private readonly objects = new Map<string, WeakRef<object>>();
  private counter = 0;
  constructor(readonly generation: number) {}

  ref(value: object, kind: RuntimeKind): RuntimeRef {
    const byKind = this.refs.get(value);
    const existing = byKind?.get(kind);
    if (existing) return existing;
    const prefix: Record<RuntimeKind, string> = { element: 'el', component: 'cmp', directive: 'dir', injector: 'inj', provider: 'prv', service: 'svc', signal: 'sig', computed: 'cpt', effect: 'eff', form: 'form', field: 'fld', route: 'route', store: 'store', selector: 'sel', 'network-request': 'net' };
    const ref = { id: `${prefix[kind]}-${++this.counter}`, kind, generation: this.generation };
    const refs = byKind ?? new Map<RuntimeKind, RuntimeRef>(); refs.set(kind, ref); this.refs.set(value, refs);
    this.objects.set(ref.id, new WeakRef(value)); return ref;
  }
  resolve(ref: RuntimeRef): object | undefined {
    if (ref.generation !== this.generation) return undefined;
    return this.objects.get(ref.id)?.deref();
  }
}
