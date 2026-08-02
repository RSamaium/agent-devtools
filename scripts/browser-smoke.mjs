import { connectBrowser } from '../packages/browser/dist/index.js';

const url = process.env.NG_AGENT_TEST_URL ?? 'http://127.0.0.1:4200';
const requested = (process.env.NG_AGENT_TEST_BROWSERS ?? 'chromium,firefox,webkit').split(',');

for (const browserName of requested) {
  const client = await connectBrowser({ url, browserName, headless: true, timeoutMs: 30_000 });
  try {
    const status = await client.status();
    const snapshot = await client.snapshot({ compact: true });
    if (!status.angular.detected || !status.angular.devMode || snapshot.components.length === 0) throw new Error(`${browserName}: Angular development runtime was not discovered`);
    process.stdout.write(`${JSON.stringify({ browserName, angular: status.angular.version, components: snapshot.components.length, signalForms: snapshot.signalForms.length })}\n`);
  } finally {
    await client.close();
  }
}
