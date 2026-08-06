import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { connectBrowser, type BrowserConnectOptions } from '@adp-devtools/browser';

export const pixiBrowserAdapterScript = async (): Promise<string> => readFile(fileURLToPath(new URL('./page/page-entry.global.js', import.meta.url)), 'utf8');

export async function connectPixiBrowser(options: BrowserConnectOptions) {
  return connectBrowser({ ...options, adapterScripts: [...(options.adapterScripts ?? []), await pixiBrowserAdapterScript()] });
}
