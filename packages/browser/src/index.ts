import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { NgAgentClient, type Transport } from '@ng-agent/core';
import type { Browser, Page } from 'playwright-core';
import { chromium, firefox, webkit } from 'playwright-core';
import type { CommandMap, CommandName, RpcRequest, RpcResponse } from '@ng-agent/protocol';

export interface BrowserConnectOptions {
  url?: string;
  cdpUrl?: string;
  headless?: boolean;
  timeoutMs?: number;
  executablePath?: string;
  allowMutations?: boolean;
  browserName?: 'chromium' | 'firefox' | 'webkit';
}

export class PageTransport implements Transport {
  constructor(private readonly page: Page, private readonly cleanup?: () => Promise<void>) {}
  async request<C extends CommandName>(request: RpcRequest<C>, timeoutMs: number): Promise<RpcResponse<CommandMap[C]['result']>> {
    try {
      const rawRequest = JSON.stringify(request);
      const response: unknown = await this.page.evaluate(async ({ raw, timeout }: { raw: string; timeout: number }) => {
        const bridge = (window as unknown as { __NG_AGENT__?: { request(request: unknown): Promise<unknown> } }).__NG_AGENT__;
        if (!bridge) throw new Error('ng-agent runtime bridge is not installed');
        return Promise.race([
          bridge.request(JSON.parse(raw) as unknown),
          new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error(`ng-agent request timed out after ${timeout}ms`)), timeout)),
        ]);
      }, { raw: rawRequest, timeout: timeoutMs });
      return response as RpcResponse<CommandMap[C]['result']>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { jsonrpc: '2.0', id: request.id, error: { code: message.includes('timed out') ? 'TIMEOUT' : 'NOT_CONNECTED', message, retryable: true } };
    }
  }
  async close(): Promise<void> { await this.cleanup?.(); }
}

const runtimeScript = async (): Promise<string> => readFile(fileURLToPath(new URL('./page/page-entry.global.js', import.meta.url)), 'utf8');

export async function connectBrowser(options: BrowserConnectOptions): Promise<NgAgentClient> {
  let browser: Browser;
  const browserType = options.browserName === 'firefox' ? firefox : options.browserName === 'webkit' ? webkit : chromium;
  if (options.cdpUrl) {
    if (browserType !== chromium) throw new Error('CDP connections are only supported by Chromium');
    browser = await chromium.connectOverCDP(options.cdpUrl, options.timeoutMs === undefined ? {} : { timeout: options.timeoutMs });
  }
  else {
    browser = await browserType.launch({ headless: options.headless ?? true, ...(options.executablePath ? { executablePath: options.executablePath } : {}) });
  }
  const context = browser.contexts()[0] ?? await browser.newContext();
  const page = context.pages()[0] ?? await context.newPage();
  const content = await runtimeScript();
  await context.addInitScript({ content });
  if (options.url) await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs ?? 30_000 });
  const installed = await page.evaluate(() => !!(window as unknown as { __NG_AGENT__?: unknown }).__NG_AGENT__);
  if (!installed) await page.addScriptTag({ content });
  return new NgAgentClient(new PageTransport(page, async () => browser.close()), { ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }), ...(options.allowMutations === undefined ? {} : { allowMutations: options.allowMutations }) });
}
