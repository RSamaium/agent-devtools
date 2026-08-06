import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { connectBrowser, type BrowserConnectOptions } from '@adp-devtools/browser';
export { createSignalFormMigrationPlan, generateSignalFormAssertions } from './assistance.js';

export const angularBrowserAdapterScript = async (): Promise<string> => readFile(fileURLToPath(new URL('./page/page-entry.global.js', import.meta.url)), 'utf8');

export async function connectAngularBrowser(options: BrowserConnectOptions) {
  return connectBrowser({ ...options, adapterScripts: [...(options.adapterScripts ?? []), await angularBrowserAdapterScript()] });
}
