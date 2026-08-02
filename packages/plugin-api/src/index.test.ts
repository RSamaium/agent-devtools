import { describe, expect, it, vi } from 'vitest';
import { defineNgAgentPlugin, installNgAgentPlugin } from './index.js';

describe('plugin installation', () => {
  it('registers and unregisters adapters for a compatible protocol', () => {
    const registerAdapter = vi.fn(); const unregisterAdapter = vi.fn();
    const target = { __NG_AGENT__: { protocolVersion: '1.0.0', registerAdapter, unregisterAdapter } } as unknown as Window;
    const plugin = defineNgAgentPlugin({ name: 'test', protocolRange: '^1.0.0', adapters: [{ name: 'test-adapter', isAvailable: () => true, capture: () => undefined }] });
    const uninstall = installNgAgentPlugin(plugin, target);
    expect(registerAdapter).toHaveBeenCalledOnce();
    uninstall();
    expect(unregisterAdapter).toHaveBeenCalledWith('test-adapter');
  });

  it('does not confuse protocol major 1 with a range for major 10', () => {
    const target = { __NG_AGENT__: { protocolVersion: '1.0.0', registerAdapter: vi.fn(), unregisterAdapter: vi.fn() } } as unknown as Window;
    const plugin = defineNgAgentPlugin({ name: 'future', protocolRange: '^10.0.0', adapters: [] });
    expect(() => installNgAgentPlugin(plugin, target)).toThrow('does not support');
  });
});
