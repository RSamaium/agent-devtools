import { FunctionTransport, AgentDevToolsClient } from '@adp-devtools/core';
import type { DomainId, RpcRequest, RpcResponse, RuntimeKind, RuntimeRef, Snapshot } from '@adp-devtools/protocol';

export const createEmptySnapshot = (overrides: Partial<Snapshot> = {}): Snapshot => ({
  id: 'snapshot-1', generation: 1,
  runtime: { environment: 'web', url: 'http://localhost:4200', title: 'Test application', capturedAt: Date.now() },
  adapters: [], domains: {}, warnings: [], truncations: [],
  ...overrides,
});

export const runtimeRef = (id: string, domain: DomainId, kind: RuntimeKind, generation = 1): RuntimeRef => ({ id, domain, kind, generation });

export function createMockClient(handler: (request: RpcRequest) => RpcResponse | Promise<RpcResponse>): AgentDevToolsClient {
  return new AgentDevToolsClient(new FunctionTransport(async request => handler(request)));
}

export function expectFreshRef(ref: RuntimeRef, snapshot: Snapshot): void {
  if (ref.generation !== snapshot.generation) throw new Error(`Stale reference ${ref.id}: generation ${ref.generation}, expected ${snapshot.generation}`);
}

export class SnapshotHarness {
  constructor(readonly snapshot: Snapshot) {}
  domain<T = unknown>(id: DomainId): T {
    const captured = this.snapshot.domains[id];
    if (!captured) throw new Error(`Domain not found: ${id}`);
    return captured.data as T;
  }
  resource<T = unknown>(domain: DomainId, resource: string): T[] {
    const data = this.domain<Record<string, unknown>>(domain)[resource];
    if (!Array.isArray(data)) throw new Error(`Resource not found: ${domain}.${resource}`);
    return data as T[];
  }
}
