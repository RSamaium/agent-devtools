import { installRuntimeBridge } from './engine.js';
if (typeof window !== 'undefined' && !window.__AGENT_DEVTOOLS__) installRuntimeBridge(window);
