import { installRuntimeBridge } from './engine.js';
if (typeof window !== 'undefined' && !window.__NG_AGENT__) installRuntimeBridge(window);
