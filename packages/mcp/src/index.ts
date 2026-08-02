import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { connectBrowser } from '@ng-agent/browser';
import { diffSnapshots, type NgAgentClient } from '@ng-agent/core';
import type { RuntimeRef, SerializationBudget, SessionExport, StructuredQuery } from '@ng-agent/protocol';

export interface McpServerOptions { cdpUrl: string; timeoutMs?: number }
const text = (value: unknown): CallToolResult => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });

export function createAngularMcpServer(options: McpServerOptions): McpServer {
  const server = new McpServer({ name: '@ng-agent/mcp', version: '0.1.0' });
  let clientPromise: Promise<NgAgentClient> | undefined;
  const client = () => clientPromise ??= connectBrowser({ cdpUrl: options.cdpUrl, ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }) });
  const register = <T extends z.ZodRawShape>(name: string, description: string, shape: T, handler: (params: z.infer<z.ZodObject<T>>, client: NgAgentClient) => Promise<unknown>) => {
    const callback = async (params: z.infer<z.ZodObject<T>>): Promise<CallToolResult> => text(await handler(params, await client()));
    // The SDK supports Zod 3 and 4 through a conditional callback type that TypeScript
    // cannot always reduce for a generic raw shape. The schema still validates every call.
    server.registerTool(name, { description, inputSchema: shape }, callback as never);
  };
  const pagination = { limit: z.number().int().min(1).max(1000).default(100).optional(), cursor: z.string().optional() };
  const budget = z.object({ maxDepth: z.number().int().positive().optional(), maxArrayLength: z.number().int().positive().optional(), maxStringLength: z.number().int().positive().optional(), maxProperties: z.number().int().positive().optional(), maxTotalBytes: z.number().int().positive().optional(), redact: z.array(z.string()).optional() });
  const normalizeBudget = (value: { maxDepth?: number | undefined; maxArrayLength?: number | undefined; maxStringLength?: number | undefined; maxProperties?: number | undefined; maxTotalBytes?: number | undefined; redact?: string[] | undefined }): Partial<SerializationBudget> => ({
    ...(value.maxDepth === undefined ? {} : { maxDepth: value.maxDepth }), ...(value.maxArrayLength === undefined ? {} : { maxArrayLength: value.maxArrayLength }),
    ...(value.maxStringLength === undefined ? {} : { maxStringLength: value.maxStringLength }), ...(value.maxProperties === undefined ? {} : { maxProperties: value.maxProperties }),
    ...(value.maxTotalBytes === undefined ? {} : { maxTotalBytes: value.maxTotalBytes }), ...(value.redact === undefined ? {} : { redact: value.redact }),
  });
  const inspect = { id: z.string(), generation: z.number().int().nonnegative() };
  const snapshotDomain = (domain: StructuredQuery['domain']) => async (params: { limit?: number | undefined; cursor?: string | undefined }, c: NgAgentClient) => c.query({ domain, ...(params.limit ? { limit: params.limit } : {}), ...(params.cursor ? { cursor: params.cursor } : {}) });
  const paginate = <T>(items: T[], params: { limit?: number | undefined; cursor?: string | undefined }, generation: number) => {
    const offset = params.cursor ? Number.parseInt(params.cursor, 10) : 0; const limit = params.limit ?? 100; const page = items.slice(offset, offset + limit); const next = offset + page.length;
    return { items: page, total: items.length, generation, ...(next < items.length ? { nextCursor: String(next) } : {}) };
  };

  register('angular_status', 'Detect Angular and list runtime capabilities.', {}, async (_p, c) => c.status());
  register('angular_snapshot', 'Capture a correlated Angular runtime snapshot.', { scope: z.enum(['all', 'current-route']).optional(), compact: z.boolean().optional(), budget: budget.optional() }, async (p, c) => c.snapshot({ ...(p.scope === undefined ? {} : { scope: p.scope }), ...(p.compact === undefined ? {} : { compact: p.compact }), ...(p.budget === undefined ? {} : { budget: normalizeBudget(p.budget) }) }));
  register('angular_components', 'List Angular components.', pagination, snapshotDomain('components'));
  register('angular_component_inspect', 'Inspect a component reference.', inspect, async (p, c) => c.query({ domain: 'components', where: { 'ref.id': p.id }, generation: p.generation, limit: 1 }));
  register('angular_router_tree', 'Return the Router tree.', {}, async (_p, c) => (await c.snapshot()).router ?? null);
  register('angular_router_state', 'Return the active Router state.', {}, async (_p, c) => (await c.snapshot()).router ?? null);
  register('angular_di_tree', 'Return environment and element injector trees.', pagination, async (p, c) => { const snapshot = await c.snapshot(); return paginate(snapshot.injectors, p, snapshot.generation); });
  register('angular_di_resolve', 'Explain an observed provider resolution.', { token: z.string(), from: z.string() }, async (p, c) => {
    const snapshot = await c.snapshot(); const source = [...snapshot.components, ...snapshot.injectors].find(item => item.ref.id === p.from)?.ref;
    if (!source) throw new Error(`Runtime reference not found: ${p.from}`);
    return c.resolveProvider(p.token, source);
  });
  register('angular_signals', 'List discovered Signals.', pagination, snapshotDomain('signals'));
  register('angular_signal_inspect', 'Inspect a Signal reference.', inspect, async (p, c) => c.query({ domain: 'signals', where: { 'ref.id': p.id }, generation: p.generation, limit: 1 }));
  register('angular_forms', 'List classic Angular forms.', pagination, snapshotDomain('forms'));
  register('angular_form_inspect', 'Inspect a classic form.', inspect, async (p, c) => c.query({ domain: 'forms', where: { 'ref.id': p.id }, generation: p.generation, limit: 1 }));
  register('angular_signal_forms', 'List Angular Signal Forms.', pagination, snapshotDomain('signal-forms'));
  register('angular_signal_form_inspect', 'Inspect an Angular Signal Form.', inspect, async (p, c) => c.query({ domain: 'signal-forms', where: { 'ref.id': p.id }, generation: p.generation, limit: 1 }));
  register('angular_ngrx_state', 'Return summarized NgRx state.', pagination, async (p, c) => { const snapshot = await c.snapshot(); return paginate(snapshot.stores.filter(store => store.storeType === 'ngrx'), p, snapshot.generation); });
  register('angular_ngrx_actions', 'Return observed NgRx actions.', { limit: z.number().int().min(1).max(100).default(20).optional() }, async (p, c) => (await c.events(undefined, p.limit)).filter(event => event.type === 'ngrx-action'));
  register('angular_profile', 'Start, stop, or summarize profiling.', { action: z.enum(['start', 'stop', 'summarize']), budgetMs: z.number().positive().optional() }, async (p, c) => p.action === 'start' ? c.profileStart(p.budgetMs) : p.action === 'stop' ? c.profileStop() : (await c.snapshot()).profile ?? null);
  register('angular_diff', 'Diff the current runtime against a named or numbered snapshot.', { from: z.string() }, async (p, c) => {
    const session = await c.exportSession(); const previous = session.snapshots.find(snapshot => snapshot.id === p.from || snapshot.name === p.from);
    if (!previous) throw new Error(`Snapshot not found: ${p.from}`);
    return diffSnapshots(previous, await c.snapshot());
  });
  register('angular_query', 'Run a structured runtime query.', { domain: z.enum(['components', 'directives', 'providers', 'signals', 'forms', 'signal-forms', 'fields', 'stores', 'routes']), where: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(), limit: z.number().int().min(1).max(1000).optional(), cursor: z.string().optional() }, async (p, c) => c.query(p as StructuredQuery));
  register('angular_explain', 'Explain a runtime subject using observed relations.', { id: z.string(), kind: z.enum(['element', 'component', 'directive', 'injector', 'provider', 'service', 'signal', 'computed', 'effect', 'form', 'field', 'route', 'store', 'selector', 'network-request']), generation: z.number().int().nonnegative(), question: z.string().optional() }, async (p, c) => c.explain({ id: p.id, kind: p.kind as RuntimeRef['kind'], generation: p.generation }, p.question));
  register('angular_graph', 'Return the V2 dependency graph.', {}, async (_p, c) => c.graph());
  register('angular_diagnostics', 'Return evidence-based runtime diagnostics.', {}, async (_p, c) => c.diagnostics());
  register('angular_trace', 'Start or stop causal runtime tracing.', { action: z.enum(['start', 'stop']) }, async (p, c) => p.action === 'start' ? c.traceStart() : c.traceStop());
  register('angular_session_export', 'Export snapshots and the normalized event journal.', {}, async (_p, c) => c.exportSession());
  register('angular_session_import', 'Import a previously exported session.', { session: z.string() }, async (p, c) => c.importSession(JSON.parse(p.session) as SessionExport));
  register('angular_replay', 'Dry-run or apply recorded user interactions.', { session: z.string(), apply: z.boolean().default(false).optional() }, async (p, c) => c.replay((JSON.parse(p.session) as SessionExport).events, p.apply ?? false));
  register('angular_interact', 'Perform an explicit user interaction during a trace.', { action: z.literal('click'), target: z.string() }, async (p, c) => c.click(p.target));
  return server;
}

export async function runStdioServer(options: McpServerOptions): Promise<void> {
  const server = createAngularMcpServer(options); await server.connect(new StdioServerTransport());
}
