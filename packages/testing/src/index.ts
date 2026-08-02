import { FunctionTransport, NgAgentClient } from '@ng-agent/core';
import type { RpcRequest, RpcResponse, RuntimeKind, RuntimeRef, Snapshot } from '@ng-agent/protocol';

export const createEmptySnapshot = (overrides: Partial<Snapshot> = {}): Snapshot => ({
  id: 'snapshot-1', generation: 1,
  page: { url: 'http://localhost:4200', title: 'Test application', capturedAt: Date.now() },
  angular: { detected: true, version: '21.0.0', devMode: true, roots: [], discovery: 'instrumented' },
  components: [], directives: [], injectors: [], providers: [], signals: [], forms: [], signalForms: [], stores: [], warnings: [], truncations: [],
  ...overrides,
});

export const runtimeRef = (id: string, kind: RuntimeKind, generation = 1): RuntimeRef => ({ id, kind, generation });

export function createMockClient(handler: (request: RpcRequest) => RpcResponse | Promise<RpcResponse>): NgAgentClient {
  return new NgAgentClient(new FunctionTransport(async request => handler(request)));
}

export function expectFreshRef(ref: RuntimeRef, snapshot: Snapshot): void {
  if (ref.generation !== snapshot.generation) throw new Error(`Stale reference ${ref.id}: generation ${ref.generation}, expected ${snapshot.generation}`);
}

export class SnapshotHarness {
  constructor(readonly snapshot: Snapshot) {}
  component(name: string) { const result = this.snapshot.components.find(item => item.name === name); if (!result) throw new Error(`Component not found: ${name}`); return result; }
  invalidSignalFields() { return this.snapshot.signalForms.flatMap(form => form.fields).filter(field => field.invalid); }
  provider(token: string) { return this.snapshot.providers.filter(item => item.token === token); }
}
