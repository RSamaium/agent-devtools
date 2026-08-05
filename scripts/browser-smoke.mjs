import { connectAngularBrowser } from '../packages/angular/dist/browser.js';

const url = process.env.AGENT_DEVTOOLS_TEST_URL ?? 'http://127.0.0.1:4200';
const requested = (process.env.AGENT_DEVTOOLS_TEST_BROWSERS ?? 'chromium,firefox,webkit').split(',');

for (const browserName of requested) {
  const client = await connectAngularBrowser({ url, browserName, headless: true, timeoutMs: 30_000 });
  try {
    const status = await client.status();
    const snapshot = await client.snapshot({ compact: true });
    const application = snapshot.domains.application?.data;
    const components = snapshot.domains.components?.data?.components ?? [];
    const signalForms = snapshot.domains.forms?.data?.signalForms ?? [];
    if (!status.adapters.some(adapter => adapter.id === 'angular') || !application?.devMode || components.length === 0) throw new Error(`${browserName}: Angular development runtime was not discovered`);
    process.stdout.write(`${JSON.stringify({ browserName, angular: application.version, components: components.length, signalForms: signalForms.length })}\n`);
  } finally {
    await client.close();
  }
}
