import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const workspace = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@adp-devtools/angular/browser': workspace('./packages/angular/src/browser.ts'),
      '@adp-devtools/angular/runtime': workspace('./packages/angular/src/runtime.ts'),
      '@adp-devtools/angular': workspace('./packages/angular/src/index.ts'),
      '@adp-devtools/pixi/browser': workspace('./packages/pixi/src/browser.ts'),
      '@adp-devtools/pixi/runtime': workspace('./packages/pixi/src/runtime.ts'),
      '@adp-devtools/pixi': workspace('./packages/pixi/src/index.ts'),
      '@adp-devtools/protocol': workspace('./packages/protocol/src/index.ts'),
      '@adp-devtools/core': workspace('./packages/core/src/index.ts'),
      '@adp-devtools/runtime': workspace('./packages/runtime/src/index.ts'),
      '@adp-devtools/browser': workspace('./packages/browser/src/index.ts'),
    },
  },
  test: {
    include: ['packages/**/*.test.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'json', 'html'] },
  },
});
