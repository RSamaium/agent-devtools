import { installRuntimeBridge } from '@adp-devtools/runtime';

if (typeof window !== 'undefined' && !window.__AGENT_DEVTOOLS__) {
  installRuntimeBridge(window);
}
