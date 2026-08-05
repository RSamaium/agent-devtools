import { z } from 'zod';

const standardDomains = new Set(['application', 'components', 'routing', 'dependency-injection', 'state', 'forms', 'performance', 'rendering', 'scene-graph', 'assets', 'network', 'diagnostics']);
export const domainIdSchema = z.string().min(1).refine(id => standardDomains.has(id) || /^[a-z0-9]+(?:[.-][a-z0-9]+)+\/[a-z0-9][a-z0-9._-]*$/.test(id), 'Custom domain identifiers must be namespaced, for example company.example/state');

export const runtimeKindSchema = z.string().min(1);

export const runtimeRefSchema = z.object({
  id: z.string().min(1),
  domain: domainIdSchema,
  kind: runtimeKindSchema,
  generation: z.number().int().nonnegative(),
});

export const serializedValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(), z.number().finite(), z.boolean(), z.null(),
    z.array(serializedValueSchema), z.record(serializedValueSchema),
  ]),
);

export const protocolErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string(),
  details: serializedValueSchema.optional(),
  retryable: z.boolean(),
});

export const rpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.string().min(1),
  protocolVersion: z.string(),
  sessionId: z.string().min(1),
  timestamp: z.number(),
  method: z.enum(['status', 'snapshot', 'query', 'explain', 'events', 'execute']),
  params: z.record(z.unknown()),
});

export const protocolEnvelopeSchema = <T extends z.ZodTypeAny>(payload: T) => z.object({
  protocolVersion: z.string(), requestId: z.string(), sessionId: z.string(),
  timestamp: z.number(), payload,
}).passthrough();

export const snapshotSchema = z.object({
  id: z.string().min(1), name: z.string().optional(), generation: z.number().int().nonnegative(),
  runtime: z.object({ environment: z.enum(['web', 'node', 'unknown']), capturedAt: z.number() }).passthrough(),
  adapters: z.array(z.object({ id: z.string(), name: z.string(), version: z.string(), protocolRange: z.string(), domains: z.array(z.object({ id: domainIdSchema, version: z.string(), capabilities: z.array(z.string()) }).passthrough()), capabilities: z.array(z.string()) }).passthrough()),
  domains: z.record(z.object({ id: domainIdSchema, version: z.string(), data: z.unknown() }).passthrough()),
  warnings: z.array(z.object({ code: z.string(), message: z.string() }).passthrough()),
  truncations: z.array(z.object({ path: z.string(), reason: z.enum(['depth', 'array-length', 'string-length', 'budget', 'redacted', 'unsupported']) }).passthrough()),
}).passthrough();

export const runtimeEventSchema = z.object({
  id: z.string(), sequence: z.number().int().nonnegative(),
  domain: domainIdSchema, type: z.string().min(1),
  timestamp: z.number(), source: runtimeRefSchema.optional(), data: serializedValueSchema,
  confidence: z.enum(['observed', 'instrumented', 'inferred']),
}).passthrough();

export const rpcResponseSchema = z.union([
  z.object({ jsonrpc: z.literal('2.0'), id: z.string(), result: z.unknown() }).passthrough(),
  z.object({ jsonrpc: z.literal('2.0'), id: z.string(), error: protocolErrorSchema }).passthrough(),
]);
