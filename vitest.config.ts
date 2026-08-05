import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const workspace = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@agent-devtools/angular/browser': workspace('./packages/angular/src/browser.ts'),
      '@agent-devtools/angular/runtime': workspace('./packages/angular/src/runtime.ts'),
      '@agent-devtools/angular': workspace('./packages/angular/src/index.ts'),
      '@agent-devtools/pixi/browser': workspace('./packages/pixi/src/browser.ts'),
      '@agent-devtools/pixi/runtime': workspace('./packages/pixi/src/runtime.ts'),
      '@agent-devtools/pixi': workspace('./packages/pixi/src/index.ts'),
      '@agent-devtools/protocol': workspace('./packages/protocol/src/index.ts'),
      '@agent-devtools/core': workspace('./packages/core/src/index.ts'),
      '@agent-devtools/runtime': workspace('./packages/runtime/src/index.ts'),
      '@agent-devtools/browser': workspace('./packages/browser/src/index.ts'),
    },
  },
  test: {
    include: ['packages/**/*.test.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'json', 'html'] },
  },
});
