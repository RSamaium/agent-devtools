import { describe, expect, it } from 'vitest';
import { RuntimeEngine } from './engine.js';
import type { CommandName, RpcRequest } from '@ng-agent/protocol';

const fakeWindow = (): Window => ({
  addEventListener() {}, removeEventListener() {},
  location: { href: 'https://example.test/', hostname: 'example.test' },
  navigator: { userAgent: 'test' },
  document: {
    title: 'Test', querySelectorAll: () => [],
    querySelector: (selector: string) => selector === '[ng-version]' ? { getAttribute: () => '22.0.0' } : null,
  },
} as unknown as Window);

describe('RuntimeEngine', () => {
  it('reports a production Angular build explicitly', async () => {
    const response = await new RuntimeEngine(fakeWindow()).handle({ jsonrpc: '2.0', id: '1', protocolVersion: '1.0.0', sessionId: 'test', timestamp: 1, method: 'snapshot', params: {} });
    expect('result' in response && response.result).toMatchObject({ angular: { detected: true, devMode: false }, warnings: [{ code: 'PRODUCTION_BUILD' }] });
  });

  it('rejects incompatible protocol majors', async () => {
    const response = await new RuntimeEngine(fakeWindow()).handle({ jsonrpc: '2.0', id: '1', protocolVersion: '2.0.0', sessionId: 'test', timestamp: 1, method: 'status', params: {} });
    expect('error' in response && response.error.code).toBe('UNSUPPORTED');
  });

  it('rejects stale query generations', async () => {
    const engine = new RuntimeEngine(fakeWindow());
    await engine.handle(request('snapshot', {}));
    await engine.handle(request('snapshot', {}));
    const response = await engine.handle(request('query', { domain: 'components', generation: 1 }));
    expect('error' in response && response.error.code).toBe('STALE_REFERENCE');
  });

  it('retains the last completed profile in later snapshots', async () => {
    const engine = new RuntimeEngine(fakeWindow());
    await engine.handle(request('profileStart', { budgetMs: 100 }));
    const profile = await engine.handle(request('profileStop', {}));
    const snapshot = await engine.handle(request('snapshot', {}));
    expect('result' in profile && profile.result).toMatchObject({ budgetExceeded: false });
    expect('result' in snapshot && snapshot.result).toMatchObject({ profile: { budgetExceeded: false } });
  });

  it('captures Angular profiler change-detection hooks when available', async () => {
    const window = fakeWindow() as Window & { ng?: { ɵsetProfiler(callback: (event: number, instance?: object | null) => void): () => void } };
    let profiler: ((event: number, instance?: object | null) => void) | undefined;
    window.ng = { ɵsetProfiler: callback => { profiler = callback; return () => { profiler = undefined; }; } };
    const engine = new RuntimeEngine(window);
    await engine.handle(request('profileStart', {}));
    profiler?.(12); profiler?.(13);
    const response = await engine.handle(request('profileStop', {}));
    expect('result' in response && response.result).toMatchObject({ entries: [{ kind: 'cycle', name: 'change-detection' }] });
  });

  it('keeps applied replay restricted to local origins', async () => {
    const response = await new RuntimeEngine(fakeWindow()).handle(request('replay', { events: [], apply: true }));
    expect('error' in response && response.error.code).toBe('MUTATION_DENIED');
  });

  it('redacts logical field paths in instrumented event data', async () => {
    const window = fakeWindow() as Window & { __NG_AGENT_INSTRUMENTATION__?: unknown };
    const listeners = new Map<string, EventListener>();
    window.addEventListener = ((type: string, listener: EventListener) => listeners.set(type, listener)) as typeof window.addEventListener;
    window.__NG_AGENT_INSTRUMENTATION__ = { options: { redact: ['account.password'] }, records: new Map(), events: [] };
    const engine = new RuntimeEngine(window);
    listeners.get('__ng_agent_instrumentation_event__')?.({ detail: { type: 'signal-form-field-changed', timestamp: 1, source: 'account', value: [{ path: 'account.password', value: 'secret' }] } } as unknown as Event);
    const response = await engine.handle(request('events', {}));
    expect('result' in response && response.result).toMatchObject([{ data: [{ path: 'account.password', value: '[REDACTED]' }] }]);
  });
});

let sequence = 0;
const request = <C extends CommandName>(method: C, params: RpcRequest<C>['params']): RpcRequest<C> => ({
  jsonrpc: '2.0', id: String(++sequence), protocolVersion: '1.0.0', sessionId: 'test', timestamp: Date.now(), method, params,
});
