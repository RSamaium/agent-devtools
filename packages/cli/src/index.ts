import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { connectAngularBrowser, createSignalFormMigrationPlan, generateSignalFormAssertions } from '@agent-devtools/angular/browser';
import { pixiBrowserAdapterScript } from '@agent-devtools/pixi/browser';
import type { PixiAssetsSnapshot, PixiRenderingSnapshot, PixiSceneGraphSnapshot } from '@agent-devtools/pixi';
import type { AgentDevToolsClient } from '@agent-devtools/core';
import { diffSnapshots, ProtocolRequestError } from '@agent-devtools/core';
import type { FormControlSnapshot, RuntimeRef, SerializedValue, Snapshot, StandardDomainData, StructuredQuery } from '@agent-devtools/protocol';
import { createHelpDocument, renderHelp, resolveContextualHelpPath } from './help.js';
import { closeSession, loadSession, openSession, saveSession } from './session.js';

export { CLI_COMMANDS, CLI_EXIT_CODES, CLI_GLOBAL_OPTIONS, createHelpDocument, renderHelp, resolveContextualHelpPath } from './help.js';
export type { CliHelpArgument, CliHelpCommand, CliHelpDocument, CliHelpOption } from './help.js';

export interface CliIo { stdout: Pick<NodeJS.WriteStream, 'write' | 'isTTY'>; stderr: Pick<NodeJS.WriteStream, 'write'> }
interface Flags { json: boolean; jsonl: boolean; quiet: boolean; help: boolean; headless: boolean; timeout: number; withDeps: boolean; filters: Record<string, SerializedValue>; output?: string; from?: string; name?: string; last?: number; scope?: string; compact?: boolean; cdp?: string; resource?: string }

const parse = (argv: string[]) => {
  const positional: string[] = []; const flags: Flags = { json: false, jsonl: false, quiet: false, help: false, headless: true, timeout: 10_000, withDeps: false, filters: {} };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--json') flags.json = true; else if (arg === '--jsonl') flags.jsonl = true; else if (arg === '--quiet') flags.quiet = true; else if (arg === '--help' || arg === '-h') flags.help = true; else if (arg === '--with-deps') flags.withDeps = true;
    else if (arg === '--headed') flags.headless = false; else if (arg === '--compact') flags.compact = true;
    else if (['--timeout', '--output', '--from', '--name', '--last', '--scope', '--cdp', '--resource'].includes(arg)) {
      const value = argv[++i]; if (!value) throw new Error(`${arg} requires a value`);
      if (arg === '--timeout') flags.timeout = Number(value); else if (arg === '--last') flags.last = Number(value); else flags[arg.slice(2) as 'output' | 'from' | 'name' | 'scope' | 'cdp' | 'resource'] = value;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2); const candidate = argv[i + 1];
      if (candidate && !candidate.startsWith('--')) { flags.filters[key] = parseValue(candidate); i++; } else flags.filters[key] = true;
    } else positional.push(arg);
  }
  return { positional, flags };
};

const print = (value: unknown, flags: Flags, io: CliIo) => {
  if (flags.quiet) return;
  if (flags.jsonl) { for (const item of Array.isArray(value) ? value : [value]) io.stdout.write(`${JSON.stringify(item)}\n`); return; }
  if (!flags.json && io.stdout.isTTY) { io.stdout.write(`${human(value)}\n`); return; }
  io.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};

const human = (value: unknown): string => {
  if (value && typeof value === 'object' && 'domains' in value && 'generation' in value) {
    const snapshot = value as Snapshot; const application = snapshot.domains['application']?.data as StandardDomainData['application'] | undefined;
    const runtime = application ? `${application.framework} ${application.version ?? 'unknown'} — ${application.discovery}` : `Adapters: ${snapshot.adapters.map(adapter => adapter.id).join(', ') || 'none'}`;
    return [`Snapshot ${snapshot.id} (generation ${snapshot.generation})`, runtime, `Domains: ${Object.keys(snapshot.domains).join(', ')}`, snapshot.warnings.length ? `Warnings: ${snapshot.warnings.map(item => item.code).join(', ')}` : 'No runtime warnings'].join('\n');
  }
  if (value && typeof value === 'object' && 'connected' in value && 'adapters' in value) {
    const status = value as Awaited<ReturnType<AgentDevToolsClient['status']>>;
    return `Connected: ${status.connected ? 'yes' : 'no'}\nAdapters: ${status.adapters.map(adapter => adapter.id).join(', ') || 'none'}\nDomains: ${status.domains.map(domain => domain.id).join(', ') || 'none'}`;
  }
  if (Array.isArray(value)) return value.length ? value.map((item, index) => `${index + 1}. ${item && typeof item === 'object' && 'name' in item ? String((item as { name: unknown }).name) : JSON.stringify(item)}`).join('\n') : 'No results.';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
};

const withClient = async <T>(flags: Flags, action: (client: AgentDevToolsClient) => Promise<T>): Promise<T> => {
  const session = await loadSession(); const client = await connectAngularBrowser({ cdpUrl: session.cdpUrl, timeoutMs: flags.timeout, adapterScripts: [await pixiBrowserAdapterScript()] });
  try { return await action(client); } finally { await client.close(); }
};

const watchClient = async (flags: Flags, client: AgentDevToolsClient, io: CliIo): Promise<{ stopped: true }> => {
  let stopped = false; let after = 0; const stop = () => { stopped = true; }; process.once('SIGINT', stop);
  try { while (!stopped) { await client.snapshot(); const events = await client.events(after, flags.last ?? 100); if (events.length) { after = events.at(-1)?.sequence ?? after; print(events, flags, io); } await new Promise(resolve => setTimeout(resolve, 250)); } }
  finally { process.removeListener('SIGINT', stop); }
  return { stopped: true };
};

const parseValue = (value: string): SerializedValue => { try { return JSON.parse(value) as SerializedValue; } catch { return value; } };
const domainData = <K extends keyof StandardDomainData>(snapshot: Snapshot, id: K): StandardDomainData[K] => {
  const domain = snapshot.domains[id]; if (!domain) throw new Error(`Domain not available: ${id}`); return domain.data as StandardDomainData[K];
};

export async function runCli(argv: string[], io: CliIo = { stdout: process.stdout, stderr: process.stderr }): Promise<number> {
  try {
    const { positional: p, flags } = parse(argv); const [command, subcommand, target] = p;
    if (!command || command === 'help' || command === 'commands' || flags.help) {
      const path = command === 'help' ? p.slice(1) : command === 'commands' || !command ? [] : resolveContextualHelpPath(p); const document = createHelpDocument(path);
      if (!flags.quiet) io.stdout.write(flags.json || flags.jsonl ? `${JSON.stringify(document, null, flags.json ? 2 : undefined)}\n` : renderHelp(document)); return 0;
    }
    let result: unknown;
    if (command === 'install') result = await installBrowsers(p.slice(1), flags.withDeps, flags.json || flags.jsonl);
    else if (command === 'open') { if (!subcommand) throw new Error('Usage: agent-devtools open <url>'); result = await openSession(subcommand, flags.headless); }
    else if (command === 'connect') {
      if (!flags.cdp) throw new Error('Usage: agent-devtools connect --cdp <url>'); const client = await connectAngularBrowser({ cdpUrl: flags.cdp, timeoutMs: flags.timeout, adapterScripts: [await pixiBrowserAdapterScript()] });
      try { await client.status(); } finally { await client.close(); } const session = { cdpUrl: flags.cdp, createdAt: Date.now() }; await saveSession(session); result = session;
    } else if (command === 'close') { await closeSession(); result = { closed: true }; }
    else if (command === 'status') result = await withClient(flags, client => client.status());
    else if (command === 'snapshot') result = await withClient(flags, client => client.snapshot({ ...(flags.scope ? { scope: flags.scope } : {}), ...(flags.compact ? { compact: true } : {}), ...(flags.name ? { name: flags.name } : {}) }));
    else if (command === 'scene' && subcommand === 'tree') result = await withClient(flags, async client => domainDataAs<PixiSceneGraphSnapshot>(await client.snapshot(), 'scene-graph'));
    else if (command === 'scene' && subcommand === 'inspect' && target) result = await withClient(flags, client => client.query({ domain: 'scene-graph', resource: 'nodes', where: target.startsWith('ref-') ? { 'ref.id': target } : { name: target }, limit: 1 }));
    else if (command === 'rendering' && subcommand === 'info') result = await withClient(flags, async client => domainDataAs<PixiRenderingSnapshot>(await client.snapshot(), 'rendering'));
    else if (command === 'assets' && subcommand === 'textures') result = await withClient(flags, async client => domainDataAs<PixiAssetsSnapshot>(await client.snapshot(), 'assets').textures);
    else if (command === 'components' && subcommand === 'tree') result = await withClient(flags, async client => domainData(await client.snapshot(), 'components').components);
    else if (command === 'component' && subcommand === 'inspect' && target) result = await withClient(flags, client => client.query({ domain: 'components', resource: 'components', where: target.startsWith('cmp-') ? { 'ref.id': target } : { name: target }, limit: 1 }));
    else if (command === 'directive' && subcommand === 'inspect' && target) result = await withClient(flags, client => client.query({ domain: 'components', resource: 'directives', where: { name: target }, limit: 1 }));
    else if (command === 'router' && ['tree', 'active', 'events'].includes(subcommand ?? '')) result = await withClient(flags, async client => { const router = domainData(await client.snapshot(), 'routing'); return subcommand === 'active' ? { activeUrl: router.activeUrl, navigationInProgress: router.navigationInProgress, routes: flattenActiveRoutes(router.roots) } : subcommand === 'events' ? router.events.slice(-(flags.last ?? 20)) : router.roots; });
    else if (command === 'di' && subcommand === 'tree') result = await withClient(flags, async client => domainData(await client.snapshot(), 'dependency-injection').injectors);
    else if (command === 'di' && subcommand === 'injector' && target) result = await withClient(flags, async client => domainData(await client.snapshot(), 'dependency-injection').injectors.find(item => item.ref.id === target) ?? null);
    else if (command === 'di' && subcommand === 'providers') result = await withClient(flags, async client => domainData(await client.snapshot(), 'dependency-injection').providers.filter(item => !target || item.injector.id === target));
    else if (command === 'di' && subcommand === 'resolve' && target && flags.from) result = await withClient(flags, async client => { const data = domainData(await client.snapshot(), 'dependency-injection'); const source = [...data.injectors, ...domainData(await client.snapshot(), 'components').components].find(item => item.ref.id === flags.from)?.ref; if (!source) throw new Error(`Runtime reference not found: ${flags.from}`); return client.execute('dependency-injection', 'resolve', { token: target, from: source as unknown as SerializedValue }); });
    else if (command === 'signals' && subcommand === 'list') result = await withClient(flags, async client => domainData(await client.snapshot(), 'state').signals);
    else if (command === 'signals' && subcommand === 'watch') { result = await withClient(flags, client => watchClient(flags, client, io)); flags.quiet = true; }
    else if (command === 'signal' && subcommand === 'inspect' && target) result = await withClient(flags, client => client.query({ domain: 'state', resource: 'signals', where: { 'ref.id': target }, limit: 1 }));
    else if (command === 'forms' && subcommand === 'list') result = await withClient(flags, async client => domainData(await client.snapshot(), 'forms').forms);
    else if (command === 'form' && subcommand === 'inspect' && target) result = await withClient(flags, client => client.query({ domain: 'forms', resource: 'forms', where: { 'ref.id': target }, limit: 1 }));
    else if (command === 'form' && subcommand === 'errors' && target) result = await withClient(flags, async client => { const form = domainData(await client.snapshot(), 'forms').forms.find(item => item.ref.id === target); return form ? collectClassicFormErrors(form.root) : []; });
    else if (command === 'form' && subcommand === 'migrate' && target) result = await withClient(flags, async client => { const form = domainData(await client.snapshot(), 'forms').forms.find(item => item.ref.id === target); if (!form) throw new Error(`Form not found: ${target}`); return createSignalFormMigrationPlan(form); });
    else if (command === 'signal-forms' && subcommand === 'list') result = await withClient(flags, async client => domainData(await client.snapshot(), 'forms').signalForms);
    else if (command === 'signal-form' && subcommand === 'inspect' && target) result = await withClient(flags, client => client.query({ domain: 'forms', resource: 'signalForms', where: { 'ref.id': target }, limit: 1 }));
    else if (command === 'signal-form' && subcommand === 'errors' && target) result = await withClient(flags, async client => { const form = domainData(await client.snapshot(), 'forms').signalForms.find(item => item.ref.id === target); return form ? { form: form.errors, fields: form.fields.filter(field => field.errors.length).map(field => ({ path: field.path, errors: field.errors })) } : null; });
    else if (command === 'signal-form' && subcommand === 'field' && target) result = await withClient(flags, async client => { const forms = domainData(await client.snapshot(), 'forms').signalForms; const separator = target.indexOf(':'); const formId = separator > 0 ? target.slice(0, separator) : ''; const path = separator > 0 ? target.slice(separator + 1) : target; return forms.find(item => !formId || item.ref.id === formId)?.fields.find(field => field.path === path) ?? null; });
    else if (command === 'signal-form' && subcommand === 'assertions' && target) result = await withClient(flags, async client => { const form = domainData(await client.snapshot(), 'forms').signalForms.find(item => item.ref.id === target); if (!form) throw new Error(`Signal Form not found: ${target}`); return generateSignalFormAssertions(form); });
    else if (command === 'ngrx' && subcommand === 'state') result = await withClient(flags, async client => domainData(await client.snapshot(), 'state').stores.filter(item => item.storeType === 'ngrx'));
    else if (command === 'ngrx' && ['actions', 'diff'].includes(subcommand ?? '')) result = await withClient(flags, async client => (await client.events(undefined, flags.last ?? 20)).filter(event => event.type === (subcommand === 'actions' ? 'ngrx-action' : 'store-changed')));
    else if (command === 'signal-store' && subcommand === 'list') result = await withClient(flags, async client => domainData(await client.snapshot(), 'state').stores.filter(item => item.storeType === 'signal-store'));
    else if (command === 'signal-store' && subcommand === 'inspect' && target) result = await withClient(flags, async client => domainData(await client.snapshot(), 'state').stores.find(item => item.storeType === 'signal-store' && (item.ref.id === target || item.name === target)) ?? null);
    else if (command === 'profile' && subcommand === 'start') result = await withClient(flags, client => client.execute('performance', 'start'));
    else if (command === 'profile' && subcommand === 'stop') { result = await withClient(flags, client => client.execute('performance', 'stop')); if (flags.output) await writeFile(flags.output, JSON.stringify(result, null, 2)); }
    else if (command === 'profile' && subcommand === 'summarize') result = await withClient(flags, async client => domainData(await client.snapshot(), 'performance'));
    else if (command === 'watch') { result = await withClient(flags, client => watchClient(flags, client, io)); flags.quiet = true; }
    else if (command === 'query' && subcommand) { const where = filtersFrom(p.slice(2), flags.filters); result = await withClient(flags, client => client.query({ domain: subcommand as StructuredQuery['domain'], ...(flags.resource ? { resource: flags.resource } : {}), where })); }
    else if (command === 'explain' && subcommand && target) result = await withClient(flags, async client => { const snapshot = await client.snapshot(); const found = findRef(snapshot, target); return client.explain(found ?? { id: target, domain: domainForKind(subcommand), kind: subcommand, generation: snapshot.generation }); });
    else if (command === 'diff') { if (!flags.from) throw new Error('diff requires --from <snapshot.json>'); const previous = JSON.parse(await readFile(flags.from, 'utf8')) as Snapshot; result = await withClient(flags, async client => diffSnapshots(previous, await client.snapshot())); }
    else throw new Error(`Unknown or incomplete command: ${p.join(' ')}`);
    print(result, flags, io);
    if (command === 'status' && result && typeof result === 'object' && 'adapters' in result && !(result as { adapters: Array<{ id: string }> }).adapters.length) return 3;
    if (command === 'snapshot' && result && typeof result === 'object' && 'warnings' in result) {
      const snapshot = result as Snapshot; const onlyProductionAngular = snapshot.adapters.length === 1 && snapshot.adapters[0]?.id === 'angular' && snapshot.warnings.some(warning => warning.code === 'PRODUCTION_BUILD');
      if (onlyProductionAngular || snapshot.warnings.some(warning => warning.code === 'ADAPTER_NOT_FOUND')) return 3;
    }
    return 0;
  } catch (error) {
    const code = error instanceof ProtocolRequestError ? error.rpcError.code : 'CLI_ERROR'; io.stderr.write(`${JSON.stringify({ error: { code, message: error instanceof Error ? error.message : String(error) } })}\n`);
    if (error instanceof ProtocolRequestError) { if (['NOT_CONNECTED', 'TIMEOUT'].includes(error.rpcError.code)) return 2; if (['ADAPTER_NOT_FOUND', 'UNAVAILABLE'].includes(error.rpcError.code)) return 3; if (['STALE_REFERENCE', 'NOT_FOUND'].includes(error.rpcError.code)) return 4; }
    return error instanceof Error && error.message.includes('No active agent-devtools session') ? 2 : 1;
  }
}

const filtersFrom = (positional: string[], flags: Record<string, SerializedValue>) => { const where = { ...flags }; for (const filter of positional) { const separator = filter.indexOf('='); if (separator > 0) where[filter.slice(0, separator)] = parseValue(filter.slice(separator + 1)); } return where; };
const collectClassicFormErrors = (control: FormControlSnapshot): Array<{ path: string; errors: typeof control.errors }> => [...(control.errors.length ? [{ path: control.path, errors: control.errors }] : []), ...control.children.flatMap(collectClassicFormErrors)];
const flattenActiveRoutes = (routes: StandardDomainData['routing']['roots']): StandardDomainData['routing']['roots'] => routes.flatMap(route => [...(route.active ? [route] : []), ...flattenActiveRoutes(route.children)]);
const domainDataAs = <T>(snapshot: Snapshot, id: string): T => { const domain = snapshot.domains[id]; if (!domain) throw new Error(`Domain not available: ${id}`); return domain.data as T; };
const domainForKind = (kind: string) => kind === 'component' || kind === 'directive' ? 'components' : kind === 'route' ? 'routing' : ['injector', 'provider', 'service'].includes(kind) ? 'dependency-injection' : ['form', 'field'].includes(kind) ? 'forms' : kind === 'pixi-node' || kind === 'node' ? 'scene-graph' : kind === 'pixi-texture' || kind === 'texture' ? 'assets' : 'state';
const findRef = (snapshot: Snapshot, id: string): RuntimeRef | undefined => { const visit = (value: unknown): RuntimeRef | undefined => { if (!value || typeof value !== 'object') return undefined; if ('id' in value && 'domain' in value && 'generation' in value && (value as { id: unknown }).id === id) return value as RuntimeRef; for (const child of Object.values(value)) { const found = visit(child); if (found) return found; } return undefined; }; return visit(snapshot.domains); };

export function playwrightInstallArguments(requested: string[], withDeps: boolean): string[] { const browsers = requested.length ? requested : ['chromium']; const supported = new Set(['chromium', 'firefox', 'webkit']); const unsupported = browsers.filter(browser => !supported.has(browser)); if (unsupported.length) throw new Error(`Unsupported browser: ${unsupported.join(', ')}. Expected chromium, firefox, or webkit.`); return ['install', ...(withDeps ? ['--with-deps'] : []), ...browsers]; }
const installBrowsers = async (requested: string[], withDeps: boolean, machineOutput: boolean): Promise<{ installed: string[]; withDeps: boolean }> => { const args = playwrightInstallArguments(requested, withDeps); const playwrightCli = fileURLToPath(new URL('cli.js', import.meta.resolve('playwright-core'))); await new Promise<void>((resolve, reject) => { const child = spawn(process.execPath, [playwrightCli, ...args], { stdio: machineOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit' }); let stderr = ''; child.stderr?.on('data', (chunk: Buffer | string) => { stderr += chunk.toString(); }); child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(stderr.trim() || `Playwright installer exited with code ${code ?? 'unknown'}`))); }); return { installed: args.filter(value => !value.startsWith('-') && value !== 'install'), withDeps }; };

export const HELP = renderHelp(createHelpDocument());
