import { describe, expect, it } from 'vitest';
import type { CommandName, RpcRequest } from '@adp-devtools/protocol';
import type { RuntimeAdapter } from './adapter.js';
import { RuntimeEngine } from './engine.js';

const fakeWindow = (): Window => ({
  location: { href: 'https://example.test/', pathname: '/', hostname: 'example.test' },
  navigator: { userAgent: 'test' },
  document: { title: 'Test', querySelector: () => null, querySelectorAll: () => [] },
} as unknown as Window);

const adapter = (): RuntimeAdapter => ({
  descriptor: {
    id: 'test.adapter', name: 'Test Adapter', version: '1.0.0', protocolRange: '^1.0.0',
    domains: [{ id: 'company.example/state', version: '1.0.0', capabilities: ['read'], commands: [{ name: 'ping', description: 'Ping.' }] }], capabilities: ['snapshot', 'query'],
  },
  isAvailable: () => true,
  capture: context => ({ domains: { 'company.example/state': { id: 'company.example/state', version: '1.0.0', data: [{ ref: context.refs.ref({}, 'record', 'company.example/state'), name: 'ready' }] } } }),
  execute: (_domain, command) => command === 'ping' ? 'pong' : 'unknown',
});

describe('RuntimeEngine', () => {
  it('reports an empty generic runtime without an adapter', async () => {
    const response = await new RuntimeEngine(fakeWindow()).handle(request('snapshot', {}));
    expect('result' in response && response.result).toMatchObject({ adapters: [], warnings: [{ code: 'ADAPTER_NOT_FOUND' }] });
  });
  it('captures a namespaced domain through an adapter', async () => {
    const response = await new RuntimeEngine(fakeWindow(), { adapters: [adapter()] }).handle(request('snapshot', {}));
    expect('result' in response && response.result).toMatchObject({ adapters: [{ id: 'test.adapter' }], domains: { 'company.example/state': { version: '1.0.0' } } });
  });
  it('rejects incompatible protocol majors', async () => {
    const response = await new RuntimeEngine(fakeWindow()).handle({ ...request('status', {}), protocolVersion: '2.0.0' });
    expect('error' in response && response.error.code).toBe('UNSUPPORTED');
  });
  it('rejects stale query generations', async () => {
    const engine = new RuntimeEngine(fakeWindow(), { adapters: [adapter()] });
    await engine.handle(request('snapshot', {})); await engine.handle(request('snapshot', {}));
    const response = await engine.handle(request('query', { domain: 'company.example/state', generation: 1 }));
    expect('error' in response && response.error.code).toBe('STALE_REFERENCE');
  });
  it('routes generic commands to the domain owner', async () => {
    const response = await new RuntimeEngine(fakeWindow(), { adapters: [adapter()] }).handle(request('execute', { domain: 'company.example/state', command: 'ping' }));
    expect('result' in response && response.result).toBe('pong');
  });
  it('rejects adapters with incompatible protocol ranges', () => {
    const incompatible = adapter(); incompatible.descriptor.protocolRange = '^2.0.0';
    expect(() => new RuntimeEngine(fakeWindow(), { adapters: [incompatible] })).toThrow('does not support ADP');
  });
});

let sequence = 0;
const request = <C extends CommandName>(method: C, params: RpcRequest<C>['params']): RpcRequest<C> => ({ jsonrpc: '2.0', id: String(++sequence), protocolVersion: '1.0.0', sessionId: 'test', timestamp: Date.now(), method, params });
