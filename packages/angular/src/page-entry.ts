import { installRuntimeBridge } from '@agent-devtools/runtime';
import { angularRuntimeAdapter } from './runtime.js';

const target = typeof window === 'undefined' ? undefined : window as Window & { __AGENT_DEVTOOLS_ANGULAR__?: boolean };

if (target && !target.__AGENT_DEVTOOLS_ANGULAR__) {
  const adapter = angularRuntimeAdapter();
  if (target.__AGENT_DEVTOOLS__) target.__AGENT_DEVTOOLS__.registerAdapter(adapter);
  else installRuntimeBridge(target, { adapters: [adapter] });
  Object.defineProperty(target, '__AGENT_DEVTOOLS_ANGULAR__', { value: true, configurable: true });
}
