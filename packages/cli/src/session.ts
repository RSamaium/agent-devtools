import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

export interface StoredSession { cdpUrl: string; pid?: number; url?: string; createdAt: number; userDataDir?: string }
const sessionDirectory = join(tmpdir(), 'agent-devtools');
const sessionFile = join(sessionDirectory, 'session.json');

export async function loadSession(): Promise<StoredSession> {
  try { return JSON.parse(await readFile(sessionFile, 'utf8')) as StoredSession; }
  catch { throw new Error('No active agent-devtools session. Run `agent-devtools open <url>` or `agent-devtools connect --cdp <url>`.'); }
}
export async function saveSession(session: StoredSession): Promise<void> { await mkdir(sessionDirectory, { recursive: true }); await writeFile(sessionFile, JSON.stringify(session, null, 2)); }

const freePort = async (): Promise<number> => {
  const { createServer } = await import('node:net');
  return new Promise((resolve, reject) => { const server = createServer(); server.unref(); server.once('error', reject); server.listen(0, '127.0.0.1', () => { const address = server.address(); const port = typeof address === 'object' && address ? address.port : 0; server.close(() => resolve(port)); }); });
};

export async function openSession(url: string, headless: boolean): Promise<StoredSession> {
  const port = await freePort(); const userDataDir = join(sessionDirectory, `chromium-${Date.now()}`); await mkdir(userDataDir, { recursive: true });
  const playwrightExecutable = chromium.executablePath();
  const candidates = [process.env['CHROME_PATH'], playwrightExecutable, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  const executable = candidates.find(candidate => candidate && existsSync(candidate));
  if (!executable) throw new Error('No Chromium executable found. Install one with `npx playwright install chromium` or set CHROME_PATH.');
  const args = [`--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`, '--no-first-run', '--no-default-browser-check', ...(headless ? ['--headless=new'] : []), url];
  const child = spawn(executable, args, { detached: true, stdio: 'ignore' }); child.unref();
  const cdpUrl = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 50; attempt++) {
    try { const response = await fetch(`${cdpUrl}/json/version`); if (response.ok) { const session: StoredSession = { cdpUrl, ...(child.pid === undefined ? {} : { pid: child.pid }), url, createdAt: Date.now(), userDataDir }; await saveSession(session); return session; } }
    catch { /* browser is starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (child.pid) process.kill(child.pid, 'SIGTERM');
  throw new Error('Chromium did not expose its CDP endpoint. Install it with `npx playwright install chromium`.');
}

export async function closeSession(): Promise<void> {
  const session = await loadSession();
  if (session.pid) { try { process.kill(session.pid, 'SIGTERM'); } catch { /* already stopped */ } }
  await rm(sessionFile, { force: true });
  if (session.userDataDir) await rm(session.userDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
