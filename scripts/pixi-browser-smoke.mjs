import { connectPixiBrowser } from '../packages/pixi/dist/browser.js';

const url = process.env.AGENT_DEVTOOLS_PIXI_TEST_URL ?? 'http://127.0.0.1:5173';
const requested = (process.env.AGENT_DEVTOOLS_TEST_BROWSERS ?? 'chromium').split(',');

for (const browserName of requested) {
  const client = await connectPixiBrowser({ url, browserName, headless: true, timeoutMs: 30_000 });
  try {
    const status = await client.status();
    const snapshot = await client.snapshot({ compact: true });
    const nodes = snapshot.domains['scene-graph']?.data?.nodes ?? [];
    const textures = snapshot.domains.assets?.data?.textures ?? [];
    if (!status.adapters.some(adapter => adapter.id === 'pixi') || nodes.length < 3 || textures.length === 0) throw new Error(`${browserName}: PixiJS runtime was not fully discovered`);
    process.stdout.write(`${JSON.stringify({ browserName, nodes: nodes.length, textures: textures.length })}\n`);
  } finally {
    await client.close();
  }
}
