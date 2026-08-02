import type { RuntimeAdapter } from '@ng-agent/runtime';

export interface NgAgentPlugin {
  name: string;
  version?: string;
  protocolRange: string;
  adapters: RuntimeAdapter[];
  queries?: Record<string, (params: unknown) => unknown>;
}

export function defineNgAgentPlugin(plugin: NgAgentPlugin): NgAgentPlugin {
  if (!plugin.name.trim()) throw new Error('Plugin name must not be empty');
  if (!plugin.protocolRange.trim()) throw new Error('Plugin protocolRange must not be empty');
  return Object.freeze(plugin);
}

export function installNgAgentPlugin(plugin: NgAgentPlugin, target: Window = window): () => void {
  const bridge = target.__NG_AGENT__;
  if (!bridge) throw new Error('ng-agent runtime bridge is not installed');
  const major = bridge.protocolVersion.split('.')[0];
  const acceptedMajor = plugin.protocolRange === '*' ? major : /\d+/.exec(plugin.protocolRange)?.[0];
  if (!major || acceptedMajor !== major) throw new Error(`Plugin ${plugin.name} does not support protocol ${bridge.protocolVersion}`);
  for (const adapter of plugin.adapters) bridge.registerAdapter(adapter);
  return () => { for (const adapter of plugin.adapters) bridge.unregisterAdapter(adapter.name); };
}
