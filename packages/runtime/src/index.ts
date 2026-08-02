export * from './adapter.js';
export * from './discovery.js';
export * from './engine.js';
export * from './instrumentation.js';
export * from './refs.js';
export * from './serializer.js';

declare global { interface Window { __NG_AGENT__?: RuntimeBridge } }
import type { RuntimeBridge } from './engine.js';
