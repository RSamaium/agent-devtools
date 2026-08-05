import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { connectAngularBrowser } from '@agent-devtools/angular/browser';
import { pixiBrowserAdapterScript } from '@agent-devtools/pixi/browser';
import type { PixiAssetsSnapshot, PixiRenderingSnapshot } from '@agent-devtools/pixi';
import { diffSnapshots, type AgentDevToolsClient } from '@agent-devtools/core';
import type { SerializationBudget, Snapshot, StandardDomainData } from '@agent-devtools/protocol';

export interface McpServerOptions { cdpUrl: string; timeoutMs?: number }
const text = (value: unknown): CallToolResult => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });

export function createAgentDevToolsMcpServer(options: McpServerOptions): McpServer {
  const server = new McpServer({ name: '@agent-devtools/mcp', version: '0.1.0' });
  let clientPromise: Promise<AgentDevToolsClient> | undefined;
  const client = () => clientPromise ??= pixiBrowserAdapterScript().then(adapterScript => connectAngularBrowser({ cdpUrl: options.cdpUrl, adapterScripts: [adapterScript], ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }) }));
  const register = <T extends z.ZodRawShape>(name: string, description: string, shape: T, handler: (params: z.infer<z.ZodObject<T>>, client: AgentDevToolsClient) => Promise<unknown>) => {
    const callback = async (params: z.infer<z.ZodObject<T>>): Promise<CallToolResult> => text(await handler(params, await client()));
    server.registerTool(name, { description, inputSchema: shape }, callback as never);
  };
  const pagination = { limit: z.number().int().min(1).max(1000).default(100).optional(), cursor: z.string().optional() };
  const budget = z.object({ maxDepth: z.number().int().positive().optional(), maxArrayLength: z.number().int().positive().optional(), maxStringLength: z.number().int().positive().optional(), maxProperties: z.number().int().positive().optional(), maxTotalBytes: z.number().int().positive().optional(), redact: z.array(z.string()).optional() });
  const normalizeBudget = (value: { maxDepth?: number | undefined; maxArrayLength?: number | undefined; maxStringLength?: number | undefined; maxProperties?: number | undefined; maxTotalBytes?: number | undefined; redact?: string[] | undefined }): Partial<SerializationBudget> => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<SerializationBudget>;
  const snapshotResource = (domain: string, resource?: string) => async (params: { limit?: number | undefined; cursor?: string | undefined }, c: AgentDevToolsClient) => c.query({ domain, ...(resource ? { resource } : {}), ...(params.limit ? { limit: params.limit } : {}), ...(params.cursor ? { cursor: params.cursor } : {}) });

  register('adp_status', 'List active ADP adapters, domains and capabilities.', {}, async (_p, c) => c.status());
  register('adp_snapshot', 'Capture an ADP multi-domain runtime snapshot.', { scope: z.string().optional(), compact: z.boolean().optional(), budget: budget.optional() }, async (p, c) => c.snapshot({ ...(p.scope === undefined ? {} : { scope: p.scope }), ...(p.compact === undefined ? {} : { compact: p.compact }), ...(p.budget === undefined ? {} : { budget: normalizeBudget(p.budget) }) }));
  register('adp_query', 'Query a standard or namespaced ADP domain resource.', { domain: z.string(), resource: z.string().optional(), where: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(), limit: z.number().int().min(1).max(1000).optional(), cursor: z.string().optional() }, async (p, c) => c.query({ domain: p.domain, ...(p.resource ? { resource: p.resource } : {}), ...(p.where ? { where: p.where } : {}), ...(p.limit ? { limit: p.limit } : {}), ...(p.cursor ? { cursor: p.cursor } : {}) }));
  register('adp_events', 'Read normalized ADP runtime events.', { after: z.number().int().nonnegative().optional(), limit: z.number().int().min(1).max(1000).optional() }, async (p, c) => c.events(p.after, p.limit));
  register('adp_explain', 'Explain a runtime reference using its owning adapter.', { id: z.string(), domain: z.string(), kind: z.string(), generation: z.number().int().nonnegative(), question: z.string().optional() }, async (p, c) => c.explain({ id: p.id, domain: p.domain, kind: p.kind, generation: p.generation }, p.question));
  register('adp_diff', 'Compare a supplied ADP snapshot with the current runtime.', { before: z.string() }, async (p, c) => diffSnapshots(JSON.parse(p.before) as Snapshot, await c.snapshot()));

  register('pixi_scene_nodes', 'List PixiJS scene graph nodes.', pagination, snapshotResource('scene-graph', 'nodes'));
  register('pixi_rendering', 'Return PixiJS renderer metadata and scene counters.', {}, async (_p, c) => domainDataAs<PixiRenderingSnapshot>(await c.snapshot(), 'rendering'));
  register('pixi_textures', 'List PixiJS managed GPU texture metadata.', pagination, async (p, c) => {
    const captured = await c.snapshot(); const assets = domainDataAs<PixiAssetsSnapshot>(captured, 'assets'); const offset = p.cursor ? Number.parseInt(p.cursor, 10) : 0; const page = assets.textures.slice(offset, offset + (p.limit ?? 100));
    return { items: page, total: assets.total, generation: captured.generation, ...(offset + page.length < assets.textures.length ? { nextCursor: String(offset + page.length) } : {}) };
  });

  register('angular_components', 'List Angular components.', pagination, snapshotResource('components', 'components'));
  register('angular_directives', 'List Angular directives.', pagination, snapshotResource('components', 'directives'));
  register('angular_router', 'Return the Angular Router domain.', {}, async (_p, c) => domainData(await c.snapshot(), 'routing'));
  register('angular_di', 'Return Angular injectors and providers.', {}, async (_p, c) => domainData(await c.snapshot(), 'dependency-injection'));
  register('angular_di_resolve', 'Explain observed Angular provider resolution.', { token: z.string(), from: z.string() }, async (p, c) => {
    const snapshot = await c.snapshot(); const di = domainData(snapshot, 'dependency-injection'); const components = domainData(snapshot, 'components').components;
    const source = [...di.injectors, ...components].find(item => item.ref.id === p.from)?.ref;
    if (!source) throw new Error(`Runtime reference not found: ${p.from}`);
    return c.execute('dependency-injection', 'resolve', { token: p.token, from: source as unknown as import('@agent-devtools/protocol').SerializedValue });
  });
  register('angular_signals', 'List Angular Signals.', pagination, snapshotResource('state', 'signals'));
  register('angular_forms', 'List classic Angular forms.', pagination, snapshotResource('forms', 'forms'));
  register('angular_signal_forms', 'List Angular Signal Forms.', pagination, snapshotResource('forms', 'signalForms'));
  register('angular_ngrx_state', 'List NgRx and SignalStore snapshots.', pagination, async (p, c) => { const snapshot = await c.snapshot(); const stores = domainData(snapshot, 'state').stores; const offset = p.cursor ? Number.parseInt(p.cursor, 10) : 0; const page = stores.slice(offset, offset + (p.limit ?? 100)); return { items: page, total: stores.length, generation: snapshot.generation, ...(offset + page.length < stores.length ? { nextCursor: String(offset + page.length) } : {}) }; });
  register('angular_profile', 'Start, stop or summarize Angular profiling.', { action: z.enum(['start', 'stop', 'summarize']) }, async (p, c) => p.action === 'summarize' ? domainData(await c.snapshot(), 'performance') : c.execute('performance', p.action));
  return server;
}

const domainData = <K extends keyof StandardDomainData>(snapshot: Snapshot, id: K): StandardDomainData[K] => {
  const domain = snapshot.domains[id]; if (!domain) throw new Error(`Domain not available: ${id}`); return domain.data as StandardDomainData[K];
};

const domainDataAs = <T>(snapshot: Snapshot, id: string): T => {
  const domain = snapshot.domains[id]; if (!domain) throw new Error(`Domain not available: ${id}`); return domain.data as T;
};

export async function runStdioServer(options: McpServerOptions): Promise<void> { const server = createAgentDevToolsMcpServer(options); await server.connect(new StdioServerTransport()); }
