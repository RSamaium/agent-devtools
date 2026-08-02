import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { connectBrowser } from '@ng-agent/browser';
import type { NgAgentClient } from '@ng-agent/core';
import { createSignalFormMigrationPlan, diffSnapshots, generateSignalFormAssertions, ProtocolRequestError } from '@ng-agent/core';
import type { RuntimeRef, SerializedValue, SessionExport, Snapshot, StructuredQuery } from '@ng-agent/protocol';
import { createHelpDocument, renderHelp, resolveContextualHelpPath } from './help.js';
import { closeSession, loadSession, openSession, saveSession } from './session.js';

export { CLI_COMMANDS, CLI_EXIT_CODES, CLI_GLOBAL_OPTIONS, createHelpDocument, renderHelp, resolveContextualHelpPath } from './help.js';
export type { CliHelpArgument, CliHelpCommand, CliHelpDocument, CliHelpOption } from './help.js';

export interface CliIo { stdout: Pick<NodeJS.WriteStream, 'write' | 'isTTY'>; stderr: Pick<NodeJS.WriteStream, 'write'> }
interface Flags { json: boolean; jsonl: boolean; quiet: boolean; help: boolean; headless: boolean; timeout: number; allowMutations: boolean; apply: boolean; withDeps: boolean; filters: Record<string, SerializedValue>; capabilityToken?: string; output?: string; from?: string; name?: string; last?: number; scope?: 'all' | 'current-route'; compact?: boolean; cdp?: string }

const parse = (argv: string[]) => {
  const positional: string[] = []; const flags: Flags = { json: false, jsonl: false, quiet: false, help: false, headless: true, timeout: 10_000, allowMutations: false, apply: false, withDeps: false, filters: {} };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--json') flags.json = true; else if (arg === '--jsonl') flags.jsonl = true; else if (arg === '--quiet') flags.quiet = true; else if (arg === '--help' || arg === '-h') flags.help = true; else if (arg === '--allow-mutations') flags.allowMutations = true; else if (arg === '--apply') flags.apply = true; else if (arg === '--with-deps') flags.withDeps = true;
    else if (arg === '--headed') flags.headless = false; else if (arg === '--compact') flags.compact = true;
    else if (['--timeout', '--output', '--from', '--name', '--last', '--scope', '--cdp', '--capability-token'].includes(arg)) { const value = argv[++i]; if (!value) throw new Error(`${arg} requires a value`); if (arg === '--timeout') flags.timeout = Number(value); else if (arg === '--last') flags.last = Number(value); else if (arg === '--scope') flags.scope = value as NonNullable<Flags['scope']>; else if (arg === '--capability-token') flags.capabilityToken = value; else flags[arg.slice(2) as 'output' | 'from' | 'name' | 'cdp'] = value; }
    else if (arg.startsWith('--')) {
      const key = arg.slice(2); const candidate = argv[i + 1];
      if (candidate && !candidate.startsWith('--')) { flags.filters[key] = parseValue(candidate); i++; }
      else flags.filters[key] = true;
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
  if (value && typeof value === 'object' && 'angular' in value && 'components' in value) {
    const snapshot = value as Snapshot;
    return [`Snapshot ${snapshot.id} (generation ${snapshot.generation})`, `Angular ${snapshot.angular.version ?? 'unknown'} — ${snapshot.angular.discovery}`, `${snapshot.components.length} components · ${snapshot.signals.length} signals · ${snapshot.forms.length + snapshot.signalForms.length} forms · ${snapshot.stores.length} stores`, snapshot.warnings.length ? `Warnings: ${snapshot.warnings.map(item => item.code).join(', ')}` : 'No runtime warnings'].join('\n');
  }
  if (value && typeof value === 'object' && 'connected' in value && 'angular' in value) {
    const status = value as { connected: boolean; angular: { detected: boolean; version?: string; devMode: boolean }; capabilities: string[] };
    return `Connected: ${status.connected ? 'yes' : 'no'}\nAngular: ${status.angular.detected ? status.angular.version ?? 'detected' : 'not detected'} (${status.angular.devMode ? 'development' : 'production'})\nCapabilities: ${status.capabilities.join(', ')}`;
  }
  if (Array.isArray(value)) return value.length ? value.map((item: unknown, index) => `${index + 1}. ${item && typeof item === 'object' && 'name' in item ? String((item as { name: unknown }).name) : JSON.stringify(item)}`).join('\n') : 'No results.';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
};
const withClient = async <T>(flags: Flags, action: (client: NgAgentClient) => Promise<T>): Promise<T> => { const session = await loadSession(); const client = await connectBrowser({ cdpUrl: session.cdpUrl, timeoutMs: flags.timeout, allowMutations: flags.allowMutations }); try { return await action(client); } finally { await client.close(); } };
const watchClient = async (flags: Flags, client: NgAgentClient, io: CliIo): Promise<{ stopped: true }> => {
  let stopped = false; let after = 0;
  const stop = () => { stopped = true; }; process.once('SIGINT', stop);
  try {
    while (!stopped) {
      const events = await client.events(after, flags.last ?? 100);
      if (events.length) { after = events.at(-1)?.sequence ?? after; print(events, flags, io); }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  } finally { process.removeListener('SIGINT', stop); }
  return { stopped: true };
};
const parseValue = (value: string): SerializedValue => { try { return JSON.parse(value) as SerializedValue; } catch { return value; } };
const ref = (id: string, kind: RuntimeRef['kind'], generation = 1): RuntimeRef => ({ id, kind, generation });

export async function runCli(argv: string[], io: CliIo = { stdout: process.stdout, stderr: process.stderr }): Promise<number> {
  try {
    const { positional: p, flags } = parse(argv); const [command, subcommand, target] = p;
    if (!command || command === 'help' || command === 'commands' || flags.help) {
      const path = command === 'help' ? p.slice(1) : command === 'commands' || !command ? [] : resolveContextualHelpPath(p);
      const document = createHelpDocument(path);
      if (!flags.quiet) io.stdout.write(flags.json || flags.jsonl ? `${JSON.stringify(document, null, flags.json ? 2 : undefined)}\n` : renderHelp(document));
      return 0;
    }
    let result: unknown;
    if (command === 'install') result = await installBrowsers(p.slice(1), flags.withDeps, flags.json || flags.jsonl);
    else if (command === 'open') { if (!subcommand) throw new Error('Usage: ng-agent open <url>'); result = await openSession(subcommand, flags.headless); }
    else if (command === 'connect') {
      if (!flags.cdp) throw new Error('Usage: ng-agent connect --cdp <url>');
      const client = await connectBrowser({ cdpUrl: flags.cdp, timeoutMs: flags.timeout });
      try { await client.status(); } finally { await client.close(); }
      const session = { cdpUrl: flags.cdp, createdAt: Date.now() }; await saveSession(session); result = session;
    }
    else if (command === 'close') { await closeSession(); result = { closed: true }; }
    else if (command === 'status') result = await withClient(flags, client => client.status());
    else if (command === 'snapshot') result = await withClient(flags, client => client.snapshot({ ...(flags.scope ? { scope: flags.scope } : {}), ...(flags.compact ? { compact: true } : {}), ...(flags.name ? { name: flags.name } : {}) }));
    else if (command === 'components' && subcommand === 'tree') result = await withClient(flags, async client => (await client.snapshot()).components);
    else if (command === 'component' && subcommand === 'inspect' && target) result = await withClient(flags, client => client.query({ domain: 'components', where: target.startsWith('cmp-') ? { 'ref.id': target } : { name: target }, limit: 1 }));
    else if (command === 'directive' && subcommand === 'inspect' && target) result = await withClient(flags, client => client.query({ domain: 'directives', where: { name: target }, limit: 1 }));
    else if (command === 'router' && ['tree', 'active', 'events'].includes(subcommand ?? '')) result = await withClient(flags, async client => {
      const router = (await client.snapshot()).router;
      if (!router) return null;
      if (subcommand === 'active') return { activeUrl: router.activeUrl, navigationInProgress: router.navigationInProgress, routes: flattenActiveRoutes(router.roots) };
      if (subcommand === 'events') return router.events.slice(-(flags.last ?? 20));
      return router.roots;
    });
    else if (command === 'di' && subcommand === 'tree') result = await withClient(flags, async client => (await client.snapshot()).injectors);
    else if (command === 'di' && subcommand === 'injector' && target) result = await withClient(flags, async client => (await client.snapshot()).injectors.find(item => item.ref.id === target) ?? null);
    else if (command === 'di' && subcommand === 'providers') result = await withClient(flags, async client => (await client.snapshot()).providers.filter(item => !target || item.injector.id === target));
    else if (command === 'di' && subcommand === 'resolve' && target && flags.from) result = await withClient(flags, async client => {
      const snapshot = await client.snapshot();
      const source = [...snapshot.components, ...snapshot.injectors].find(item => item.ref.id === flags.from)?.ref;
      if (!source) throw new Error(`Runtime reference not found: ${flags.from}`);
      return client.resolveProvider(target, source);
    });
    else if (command === 'signals' && (subcommand === 'list' || subcommand === 'watch')) { if (subcommand === 'watch') { result = await withClient(flags, client => watchClient(flags, client, io)); flags.quiet = true; } else result = await withClient(flags, async client => (await client.snapshot()).signals); }
    else if (command === 'signal' && subcommand === 'inspect' && target) result = await withClient(flags, client => client.query({ domain: 'signals', where: { 'ref.id': target }, limit: 1 }));
    else if (command === 'forms' && subcommand === 'list') result = await withClient(flags, async client => (await client.snapshot()).forms);
    else if (command === 'form' && subcommand === 'inspect' && target) result = await withClient(flags, client => client.query({ domain: 'forms', where: { 'ref.id': target }, limit: 1 }));
    else if (command === 'form' && subcommand === 'errors' && target) result = await withClient(flags, async client => {
      const form = (await client.snapshot()).forms.find(item => item.ref.id === target);
      return form ? collectClassicFormErrors(form.root) : [];
    });
    else if (command === 'form' && subcommand === 'migrate' && target) result = await withClient(flags, async client => {
      const form = (await client.snapshot()).forms.find(item => item.ref.id === target);
      if (!form) throw new Error(`Form not found: ${target}`);
      return createSignalFormMigrationPlan(form);
    });
    else if (command === 'signal-forms' && subcommand === 'list') result = await withClient(flags, async client => (await client.snapshot()).signalForms);
    else if (command === 'signal-form' && subcommand === 'inspect' && target) result = await withClient(flags, client => client.query({ domain: 'signal-forms', where: { 'ref.id': target }, limit: 1 }));
    else if (command === 'signal-form' && subcommand === 'errors' && target) result = await withClient(flags, async client => {
      const form = (await client.snapshot()).signalForms.find(item => item.ref.id === target);
      return form ? { form: form.errors, fields: form.fields.filter(field => field.errors.length).map(field => ({ path: field.path, errors: field.errors })) } : null;
    });
    else if (command === 'signal-form' && subcommand === 'field' && target) result = await withClient(flags, async client => {
      const snapshot = await client.snapshot(); const separator = target.indexOf(':');
      const formId = separator > 0 ? target.slice(0, separator) : ''; const path = separator > 0 ? target.slice(separator + 1) : target;
      return snapshot.signalForms.find(item => !formId || item.ref.id === formId)?.fields.find(field => field.path === path) ?? null;
    });
    else if (command === 'signal-form' && subcommand === 'assertions' && target) result = await withClient(flags, async client => {
      const form = (await client.snapshot()).signalForms.find(item => item.ref.id === target);
      if (!form) throw new Error(`Signal Form not found: ${target}`);
      return generateSignalFormAssertions(form);
    });
    else if (command === 'ngrx' && subcommand === 'state') result = await withClient(flags, async client => (await client.snapshot()).stores.filter(item => item.storeType === 'ngrx'));
    else if (command === 'ngrx' && subcommand === 'actions') result = await withClient(flags, async client => (await client.events(undefined, flags.last ?? 20)).filter(event => event.type === 'ngrx-action'));
    else if (command === 'ngrx' && subcommand === 'diff') result = await withClient(flags, async client => (await client.events(undefined, flags.last ?? 20)).filter(event => event.type === 'store-changed'));
    else if (command === 'signal-store' && subcommand === 'list') result = await withClient(flags, async client => (await client.snapshot()).stores.filter(item => item.storeType === 'signal-store'));
    else if (command === 'signal-store' && subcommand === 'inspect' && target) result = await withClient(flags, async client => (await client.snapshot()).stores.find(item => item.storeType === 'signal-store' && (item.ref.id === target || item.name === target)) ?? null);
    else if (command === 'profile' && subcommand === 'start') result = await withClient(flags, client => client.profileStart());
    else if (command === 'profile' && subcommand === 'stop') { result = await withClient(flags, client => client.profileStop()); if (flags.output) await writeFile(flags.output, JSON.stringify(result, null, 2)); }
    else if (command === 'profile' && subcommand === 'summarize') result = await withClient(flags, async client => (await client.snapshot()).profile);
    else if (command === 'trace' && subcommand === 'start') result = await withClient(flags, client => client.traceStart());
    else if (command === 'trace' && subcommand === 'stop') result = await withClient(flags, client => client.traceStop());
    else if (command === 'click' && subcommand) result = await withClient(flags, client => client.click(subcommand));
    else if (command === 'session' && subcommand === 'export') { result = await withClient(flags, client => client.exportSession()); if (flags.output) await writeFile(flags.output, JSON.stringify(result, null, 2)); }
    else if (command === 'session' && subcommand === 'import' && target) { const session = JSON.parse(await readFile(target, 'utf8')) as SessionExport; result = await withClient(flags, client => client.importSession(session)); }
    else if (command === 'replay' && subcommand) { const session = JSON.parse(await readFile(subcommand, 'utf8')) as SessionExport; result = await withClient(flags, client => client.replay(session.events, flags.apply)); }
    else if (command === 'watch') { result = await withClient(flags, client => watchClient(flags, client, io)); flags.quiet = true; }
    else if (command === 'query' && subcommand) { const where: Record<string, SerializedValue> = { ...flags.filters }; for (const filter of p.slice(2)) { const separator = filter.indexOf('='); if (separator > 0) where[filter.slice(0, separator)] = parseValue(filter.slice(separator + 1)); } result = await withClient(flags, client => client.query({ domain: subcommand as StructuredQuery['domain'], where })); }
    else if (command === 'explain' && subcommand && target) result = await withClient(flags, async client => {
      const snapshot = await client.snapshot();
      const refs = [...snapshot.components, ...snapshot.directives, ...snapshot.injectors, ...snapshot.providers, ...snapshot.signals, ...snapshot.forms, ...snapshot.signalForms, ...snapshot.stores].map(item => item.ref);
      refs.push(...snapshot.signalForms.flatMap(form => form.fields.map(field => field.ref)));
      return client.explain(refs.find(item => item.id === target) ?? ref(target, subcommand as RuntimeRef['kind'], snapshot.generation));
    });
    else if (command === 'graph') result = await withClient(flags, client => client.graph());
    else if (command === 'diagnostics') result = await withClient(flags, client => client.diagnostics());
    else if (flags.allowMutations && command === 'signal' && subcommand === 'set' && target && p[3]) result = await withClient(flags, client => client.mutate({ operation: 'signal.set', target, value: parseValue(p[3]!), capabilityToken: flags.capabilityToken ?? '' }));
    else if (flags.allowMutations && command === 'form' && subcommand === 'set' && target && p[3]) result = await withClient(flags, client => client.mutate({ operation: 'form.set', target, value: parseValue(p[3]!), capabilityToken: flags.capabilityToken ?? '' }));
    else if (flags.allowMutations && command === 'router' && subcommand === 'navigate' && target) result = await withClient(flags, client => client.mutate({ operation: 'router.navigate', target, value: target, capabilityToken: flags.capabilityToken ?? '' }));
    else if (flags.allowMutations && command === 'ngrx' && subcommand === 'dispatch' && target) result = await withClient(flags, client => client.mutate({ operation: 'ngrx.dispatch', target: 'ngrx', value: parseValue(target), capabilityToken: flags.capabilityToken ?? '' }));
    else if (command === 'diff') { if (!flags.from) throw new Error('diff requires --from <snapshot-id-or-json>'); result = await withClient(flags, async client => {
      let previous: Snapshot | undefined;
      try { previous = JSON.parse(await readFile(flags.from!, 'utf8')) as Snapshot; }
      catch { previous = (await client.exportSession()).snapshots.find(item => item.id === flags.from || item.name === flags.from); }
      if (!previous) throw new Error(`Snapshot not found: ${flags.from}`);
      return diffSnapshots(previous, await client.snapshot());
    }); }
    else throw new Error(`Unknown or incomplete command: ${p.join(' ')}`);
    print(result, flags, io);
    if (command === 'status' && result && typeof result === 'object' && 'angular' in result) {
      const angular = (result as { angular: { detected: boolean; devMode: boolean } }).angular;
      if (!angular.detected || !angular.devMode) return 3;
    }
    if (command === 'snapshot' && result && typeof result === 'object' && 'warnings' in result && (result as Snapshot).warnings.some(warning => warning.code === 'ANGULAR_NOT_FOUND' || warning.code === 'PRODUCTION_BUILD')) return 3;
    return 0;
  } catch (error) {
    const code = error instanceof ProtocolRequestError ? error.rpcError.code : 'CLI_ERROR';
    io.stderr.write(`${JSON.stringify({ error: { code, message: error instanceof Error ? error.message : String(error) } })}\n`);
    if (error instanceof ProtocolRequestError) {
      if (['NOT_CONNECTED', 'TIMEOUT'].includes(error.rpcError.code)) return 2;
      if (['ANGULAR_NOT_FOUND', 'PRODUCTION_BUILD'].includes(error.rpcError.code)) return 3;
      if (['STALE_REFERENCE', 'NOT_FOUND'].includes(error.rpcError.code)) return 4;
      if (error.rpcError.code === 'MUTATION_DENIED') return 5;
    }
    return error instanceof Error && error.message.includes('No active ng-agent session') ? 2 : 1;
  }
}

const collectClassicFormErrors = (control: Snapshot['forms'][number]['root']): Array<{ path: string; errors: typeof control.errors }> => [
  ...(control.errors.length ? [{ path: control.path, errors: control.errors }] : []),
  ...control.children.flatMap(collectClassicFormErrors),
];
const flattenActiveRoutes = (routes: NonNullable<Snapshot['router']>['roots']): NonNullable<Snapshot['router']>['roots'] => routes.flatMap(route => [
  ...(route.active ? [route] : []), ...flattenActiveRoutes(route.children),
]);

export function playwrightInstallArguments(requested: string[], withDeps: boolean): string[] {
  const browsers = requested.length ? requested : ['chromium'];
  const supported = new Set(['chromium', 'firefox', 'webkit']);
  const unsupported = browsers.filter(browser => !supported.has(browser));
  if (unsupported.length) throw new Error(`Unsupported browser: ${unsupported.join(', ')}. Expected chromium, firefox, or webkit.`);
  return ['install', ...(withDeps ? ['--with-deps'] : []), ...browsers];
}

const installBrowsers = async (requested: string[], withDeps: boolean, machineOutput: boolean): Promise<{ installed: string[]; withDeps: boolean }> => {
  const args = playwrightInstallArguments(requested, withDeps);
  const playwrightCli = fileURLToPath(new URL('cli.js', import.meta.resolve('playwright-core')));
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [playwrightCli, ...args], { stdio: machineOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer | string) => { stderr += chunk.toString(); });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(stderr.trim() || `Playwright installer exited with code ${code ?? 'unknown'}`)));
  });
  return { installed: args.filter(value => !value.startsWith('-') && value !== 'install'), withDeps };
};

export const HELP = renderHelp(createHelpDocument());
