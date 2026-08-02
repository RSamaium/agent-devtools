import { describe, expect, it } from 'vitest';
import { protocolEnvelopeSchema, rpcRequestSchema, runtimeEventSchema, runtimeRefSchema, snapshotSchema } from './schema.js';

describe('protocol schemas', () => {
  it('accepts additive envelope fields and validates references', () => {
    const schema = protocolEnvelopeSchema(runtimeRefSchema);
    expect(schema.parse({ protocolVersion: '1.0.0', requestId: 'r1', sessionId: 's1', timestamp: 1, payload: { id: 'cmp-1', kind: 'component', generation: 1 }, future: true }).payload.kind).toBe('component');
  });

  it('rejects unsupported RPC methods', () => {
    expect(() => rpcRequestSchema.parse({ jsonrpc: '2.0', id: '1', protocolVersion: '1.0.0', sessionId: 's1', timestamp: 1, method: 'unsafeEval', params: {} })).toThrow();
  });

  it('validates snapshots and normalized events at runtime', () => {
    const snapshot = { id: 'snapshot-1', generation: 1, page: { url: 'http://localhost', title: 'App', capturedAt: 1 }, angular: { detected: true, devMode: true, roots: [], discovery: 'partial' }, components: [], directives: [], injectors: [], providers: [], signals: [], forms: [], signalForms: [], stores: [], warnings: [], truncations: [] };
    expect(snapshotSchema.parse(snapshot).id).toBe('snapshot-1');
    expect(runtimeEventSchema.parse({ id: 'event-1', sequence: 1, type: 'signal-form-submission', timestamp: 1, data: {}, confidence: 'instrumented' }).type).toBe('signal-form-submission');
  });
});
