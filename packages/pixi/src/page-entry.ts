import { installRuntimeBridge } from '@agent-devtools/runtime';
import { pixiRuntimeAdapter } from './runtime.js';

const target = typeof window === 'undefined' ? undefined : window as Window & { __AGENT_DEVTOOLS_PIXI__?: boolean };

if (target && !target.__AGENT_DEVTOOLS_PIXI__) {
  const adapter = pixiRuntimeAdapter();
  if (target.__AGENT_DEVTOOLS__) target.__AGENT_DEVTOOLS__.registerAdapter(adapter);
  else installRuntimeBridge(target, { adapters: [adapter] });
  Object.defineProperty(target, '__AGENT_DEVTOOLS_PIXI__', { value: true, configurable: true });
}
