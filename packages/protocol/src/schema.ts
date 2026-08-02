import { z } from 'zod';

export const runtimeKindSchema = z.enum([
  'element', 'component', 'directive', 'injector', 'provider', 'service', 'signal',
  'computed', 'effect', 'form', 'field', 'route', 'store', 'selector', 'network-request',
]);

export const runtimeRefSchema = z.object({
  id: z.string().min(1),
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
  code: z.enum(['INVALID_REQUEST', 'NOT_CONNECTED', 'ANGULAR_NOT_FOUND', 'PRODUCTION_BUILD', 'STALE_REFERENCE', 'NOT_FOUND', 'UNSUPPORTED', 'TIMEOUT', 'BUDGET_EXCEEDED', 'MUTATION_DENIED', 'INTERNAL_ERROR']),
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
  method: z.enum(['status', 'snapshot', 'query', 'explain', 'graph', 'diagnostics', 'diResolve', 'events', 'profileStart', 'profileStop', 'traceStart', 'traceStop', 'sessionExport', 'sessionImport', 'replay', 'interact', 'mutate']),
  params: z.record(z.unknown()),
});

export const protocolEnvelopeSchema = <T extends z.ZodTypeAny>(payload: T) => z.object({
  protocolVersion: z.string(), requestId: z.string(), sessionId: z.string(),
  timestamp: z.number(), payload,
}).passthrough();

const discoverySchema = z.enum(['complete', 'partial', 'instrumented']);
const referencedSnapshotSchema = z.object({ ref: runtimeRefSchema }).passthrough();
const formControlSchema: z.ZodType<unknown> = z.lazy(() => z.object({
  ref: runtimeRefSchema, name: z.string(), path: z.string(), controlType: z.enum(['control', 'group', 'array']),
  value: serializedValueSchema, valid: z.boolean(), invalid: z.boolean(), pending: z.boolean(), disabled: z.boolean(),
  dirty: z.boolean(), touched: z.boolean(), errors: z.array(z.object({ code: z.string() }).passthrough()), children: z.array(formControlSchema),
}).passthrough());

export const snapshotSchema = z.object({
  id: z.string().min(1), name: z.string().optional(), generation: z.number().int().nonnegative(),
  page: z.object({ url: z.string(), title: z.string(), capturedAt: z.number() }).passthrough(),
  angular: z.object({ detected: z.boolean(), version: z.string().optional(), devMode: z.boolean(), roots: z.array(runtimeRefSchema), discovery: discoverySchema }).passthrough(),
  components: z.array(z.object({ ref: runtimeRefSchema, name: z.string(), children: z.array(runtimeRefSchema), directives: z.array(runtimeRefSchema), properties: z.array(z.object({ name: z.string(), value: serializedValueSchema, category: z.enum(['property', 'input', 'output', 'model']) }).passthrough()), destroyed: z.boolean(), formFields: z.array(runtimeRefSchema) }).passthrough()),
  directives: z.array(referencedSnapshotSchema), injectors: z.array(referencedSnapshotSchema), providers: z.array(referencedSnapshotSchema),
  signals: z.array(z.object({ ref: runtimeRefSchema, value: serializedValueSchema, writable: z.boolean(), discovery: discoverySchema }).passthrough()),
  forms: z.array(z.object({ ref: runtimeRefSchema, formType: z.enum(['reactive', 'template-driven']), root: formControlSchema }).passthrough()),
  signalForms: z.array(z.object({ ref: runtimeRefSchema, model: serializedValueSchema, fields: z.array(referencedSnapshotSchema), valid: z.boolean(), invalid: z.boolean(), pending: z.boolean(), errors: z.array(z.object({ code: z.string() }).passthrough()), discovery: z.enum(['partial', 'instrumented']) }).passthrough()),
  stores: z.array(z.object({ ref: runtimeRefSchema, name: z.string(), storeType: z.enum(['ngrx', 'signal-store']), state: serializedValueSchema, discovery: discoverySchema }).passthrough()),
  warnings: z.array(z.object({ code: z.string(), message: z.string() }).passthrough()),
  truncations: z.array(z.object({ path: z.string(), reason: z.enum(['depth', 'array-length', 'string-length', 'budget', 'redacted', 'unsupported']) }).passthrough()),
}).passthrough();

export const runtimeEventSchema = z.object({
  id: z.string(), sequence: z.number().int().nonnegative(),
  type: z.enum(['navigation', 'component-created', 'component-destroyed', 'signal-changed', 'form-status-changed', 'signal-form-field-changed', 'signal-form-validation-changed', 'signal-form-submission', 'ngrx-action', 'store-changed', 'change-detection-cycle', 'runtime-warning', 'network-request', 'user-interaction']),
  timestamp: z.number(), source: runtimeRefSchema.optional(), data: serializedValueSchema,
  confidence: z.enum(['observed', 'instrumented', 'inferred']),
}).passthrough();

export const rpcResponseSchema = z.union([
  z.object({ jsonrpc: z.literal('2.0'), id: z.string(), result: z.unknown() }).passthrough(),
  z.object({ jsonrpc: z.literal('2.0'), id: z.string(), error: protocolErrorSchema }).passthrough(),
]);
