export const PROTOCOL_VERSION = '1.0.0' as const;

export type RuntimeKind = string;

export type StandardDomainId =
  | 'application' | 'components' | 'routing' | 'dependency-injection'
  | 'state' | 'forms' | 'performance' | 'rendering' | 'scene-graph'
  | 'assets' | 'network' | 'diagnostics';
export type DomainId = StandardDomainId | (string & {});

export interface RuntimeRef {
  id: string;
  domain: DomainId;
  kind: RuntimeKind;
  generation: number;
}

export interface ProtocolEnvelope<T> {
  protocolVersion: string;
  requestId: string;
  sessionId: string;
  timestamp: number;
  payload: T;
}

export type JsonPrimitive = string | number | boolean | null;
export type SerializedValue = JsonPrimitive | SerializedValue[] | { [key: string]: SerializedValue };

export interface Truncation {
  path: string;
  reason: 'depth' | 'array-length' | 'string-length' | 'budget' | 'redacted' | 'unsupported';
  originalSize?: number;
}

export interface PageMetadata {
  url: string;
  title: string;
  userAgent?: string;
  capturedAt: number;
}

export interface ApplicationMetadata {
  framework: string;
  detected: boolean;
  version?: string;
  devMode: boolean;
  roots: RuntimeRef[];
  discovery: DiscoveryLevel;
  renderMode?: 'client' | 'ssr' | 'hydrated';
  multiRoot?: boolean;
}

export interface DomainDescriptor {
  id: DomainId;
  version: string;
  capabilities: string[];
  commands?: Array<{ name: string; description: string }>;
}

export interface AdapterDescriptor {
  id: string;
  name: string;
  version: string;
  protocolRange: string;
  framework?: { name: string; version?: string };
  domains: DomainDescriptor[];
  capabilities: string[];
}

export interface RuntimeMetadata {
  environment: 'web' | 'node' | 'unknown';
  url?: string;
  title?: string;
  userAgent?: string;
  capturedAt: number;
}

export interface DomainSnapshot<T = unknown> {
  id: DomainId;
  version: string;
  data: T;
}

export type DiscoveryLevel = 'complete' | 'partial' | 'instrumented';

export interface PropertySnapshot {
  name: string;
  value: SerializedValue;
  category: 'property' | 'input' | 'output' | 'model';
  writable?: boolean;
}

export interface ComponentSnapshot {
  ref: RuntimeRef;
  name: string;
  host?: RuntimeRef;
  parent?: RuntimeRef;
  children: RuntimeRef[];
  directives: RuntimeRef[];
  properties: PropertySnapshot[];
  changeDetection?: 'default' | 'on-push' | 'unknown';
  destroyed: boolean;
  injector?: RuntimeRef;
  formFields: RuntimeRef[];
  source?: { file?: string; line?: number };
}

export interface DirectiveSnapshot {
  ref: RuntimeRef;
  name: string;
  host?: RuntimeRef;
  properties: PropertySnapshot[];
  injector?: RuntimeRef;
}

export interface RouteSnapshot {
  ref: RuntimeRef;
  path: string;
  outlet: string;
  active: boolean;
  lazy: boolean;
  component?: RuntimeRef;
  children: RouteSnapshot[];
  params: Record<string, SerializedValue>;
  queryParams: Record<string, SerializedValue>;
  fragment?: string;
  data: Record<string, SerializedValue>;
}

export interface RouterEventSnapshot {
  id: number;
  type: string;
  url?: string;
  timestamp: number;
  error?: string;
}

export interface RouterSnapshot {
  activeUrl: string;
  roots: RouteSnapshot[];
  events: RouterEventSnapshot[];
  navigationInProgress: boolean;
}

export interface InjectorSnapshot {
  ref: RuntimeRef;
  injectorType: 'environment' | 'element';
  name?: string;
  parent?: RuntimeRef;
  children: RuntimeRef[];
  providers: RuntimeRef[];
  owner?: RuntimeRef;
}

export interface ProviderSnapshot {
  ref: RuntimeRef;
  token: string;
  providerType: 'class' | 'value' | 'factory' | 'existing' | 'unknown';
  injector: RuntimeRef;
  instance?: SerializedValue;
  observedConsumers: RuntimeRef[];
  possibleConsumers: RuntimeRef[];
}

export interface ResolutionSnapshot {
  token: string;
  from: RuntimeRef;
  path: RuntimeRef[];
  winner?: RuntimeRef;
  flags: string[];
  error?: string;
  confidence: Confidence;
}

export interface SignalSnapshot {
  ref: RuntimeRef;
  signalType: 'signal' | 'computed' | 'input' | 'model' | 'unknown';
  name?: string;
  owner?: RuntimeRef;
  value: SerializedValue;
  writable: boolean;
  error?: string;
  discovery: DiscoveryLevel;
}

export interface FormErrorSnapshot {
  code: string;
  message?: string;
  value?: SerializedValue;
  source?: string;
  kind?: 'field' | 'cross-field' | 'async';
  dependsOn?: string[];
}

export interface FormControlSnapshot {
  ref: RuntimeRef;
  name: string;
  path: string;
  controlType: 'control' | 'group' | 'array';
  value: SerializedValue;
  rawValue?: SerializedValue;
  valid: boolean;
  invalid: boolean;
  pending: boolean;
  disabled: boolean;
  dirty: boolean;
  touched: boolean;
  errors: FormErrorSnapshot[];
  children: FormControlSnapshot[];
  element?: RuntimeRef;
  component?: RuntimeRef;
}

export interface FormSnapshot {
  ref: RuntimeRef;
  owner?: RuntimeRef;
  formType: 'reactive' | 'template-driven';
  root: FormControlSnapshot;
}

export interface SignalFormFieldSnapshot {
  ref: RuntimeRef;
  path: string;
  value: SerializedValue;
  valid: boolean;
  invalid: boolean;
  pending: boolean;
  disabled: boolean;
  dirty: boolean;
  touched: boolean;
  errors: FormErrorSnapshot[];
  element?: RuntimeRef;
  controlComponent?: RuntimeRef;
  children?: SignalFormFieldSnapshot[];
}

export interface SignalFormSnapshot {
  ref: RuntimeRef;
  name?: string;
  owner?: RuntimeRef;
  model: SerializedValue;
  fields: SignalFormFieldSnapshot[];
  valid: boolean;
  invalid: boolean;
  pending: boolean;
  submitting?: boolean;
  errors: FormErrorSnapshot[];
  discovery: 'partial' | 'instrumented';
  schema?: SerializedValue;
}

export interface StoreSnapshot {
  ref: RuntimeRef;
  name: string;
  storeType: 'ngrx' | 'signal-store';
  state: SerializedValue;
  lastAction?: SerializedValue;
  actions?: SerializedValue[];
  signals?: RuntimeRef[];
  methods?: string[];
  owner?: RuntimeRef;
  injector?: RuntimeRef;
  discovery: DiscoveryLevel;
}

export interface ProfileEntry {
  ref?: RuntimeRef;
  name: string;
  kind: 'cycle' | 'component' | 'directive' | 'lifecycle' | 'validation' | 'selector' | 'effect';
  start: number;
  duration: number;
  trigger?: string;
}

export interface ProfileSnapshot {
  startedAt: number;
  stoppedAt: number;
  entries: ProfileEntry[];
  budgetExceeded: boolean;
  budgetMs?: number;
}

export interface RuntimeWarning {
  code: string;
  message: string;
  domain?: string;
  ref?: RuntimeRef;
}

export interface Snapshot {
  id: string;
  name?: string;
  generation: number;
  runtime: RuntimeMetadata;
  adapters: AdapterDescriptor[];
  domains: Record<string, DomainSnapshot>;
  warnings: RuntimeWarning[];
  truncations: Truncation[];
}

export interface StandardDomainData {
  application: ApplicationMetadata;
  components: { components: ComponentSnapshot[]; directives: DirectiveSnapshot[] };
  routing: RouterSnapshot;
  'dependency-injection': { injectors: InjectorSnapshot[]; providers: ProviderSnapshot[] };
  state: { signals: SignalSnapshot[]; stores: StoreSnapshot[] };
  forms: { forms: FormSnapshot[]; signalForms: SignalFormSnapshot[] };
  performance: ProfileSnapshot | null;
  rendering: SerializedValue;
  'scene-graph': SerializedValue;
  assets: SerializedValue;
  network: SerializedValue;
  diagnostics: SerializedValue;
}

/** Mutable standard-domain view used by an adapter while capturing a snapshot. */
export interface StandardCaptureSnapshot {
  id: string;
  name?: string;
  generation: number;
  runtime: RuntimeMetadata;
  application: ApplicationMetadata;
  router?: RouterSnapshot;
  components: ComponentSnapshot[];
  directives: DirectiveSnapshot[];
  injectors: InjectorSnapshot[];
  providers: ProviderSnapshot[];
  signals: SignalSnapshot[];
  forms: FormSnapshot[];
  signalForms: SignalFormSnapshot[];
  stores: StoreSnapshot[];
  profile?: ProfileSnapshot;
  warnings: RuntimeWarning[];
  truncations: Truncation[];
}

export type RuntimeEventType = string;

export interface RuntimeEvent {
  id: string;
  sequence: number;
  domain: DomainId;
  type: RuntimeEventType;
  timestamp: number;
  source?: RuntimeRef;
  data: SerializedValue;
  cause?: string;
  confidence: Confidence;
}

export type Confidence = 'observed' | 'instrumented' | 'inferred';

export interface Explanation {
  subject: RuntimeRef | string;
  summary: string;
  facts: Array<{ relation: string; value: SerializedValue; confidence: Confidence }>;
  evidence: RuntimeRef[];
  limitations: string[];
}

export interface SnapshotOptions {
  scope?: string;
  compact?: boolean;
  name?: string;
  budget?: Partial<SerializationBudget>;
}

export interface SerializationBudget {
  maxDepth: number;
  maxArrayLength: number;
  maxStringLength: number;
  maxProperties: number;
  maxTotalBytes: number;
  redact: string[];
}

export type QueryDomain = DomainId;
export interface StructuredQuery { domain: QueryDomain; resource?: string; where?: Record<string, SerializedValue>; limit?: number; cursor?: string; generation?: number }
export interface QueryResult { items: SerializedValue[]; nextCursor?: string; total: number; generation: number }

export interface ProtocolError {
  code: 'INVALID_REQUEST' | 'NOT_CONNECTED' | 'ADAPTER_NOT_FOUND' | 'UNAVAILABLE' | 'STALE_REFERENCE' | 'NOT_FOUND' | 'UNSUPPORTED' | 'TIMEOUT' | 'BUDGET_EXCEEDED' | 'INTERNAL_ERROR' | (string & {});
  message: string;
  details?: SerializedValue;
  retryable: boolean;
}

export interface CommandMap {
  status: { params: Record<string, never>; result: { connected: boolean; protocolVersion: string; adapters: AdapterDescriptor[]; domains: DomainDescriptor[]; capabilities: string[] } };
  snapshot: { params: SnapshotOptions; result: Snapshot };
  query: { params: StructuredQuery; result: QueryResult };
  explain: { params: { subject: RuntimeRef | string; question?: string }; result: Explanation };
  events: { params: { after?: number; limit?: number }; result: RuntimeEvent[] };
  execute: { params: { domain: DomainId; command: string; params?: SerializedValue }; result: SerializedValue };
}

export type CommandName = keyof CommandMap;
export interface RpcRequest<C extends CommandName = CommandName> { jsonrpc: '2.0'; id: string; protocolVersion: string; sessionId: string; timestamp: number; method: C; params: CommandMap[C]['params'] }
export interface RpcSuccess<R = unknown> { jsonrpc: '2.0'; id: string; result: R }
export interface RpcFailure { jsonrpc: '2.0'; id: string; error: ProtocolError }
export type RpcResponse<R = unknown> = RpcSuccess<R> | RpcFailure;
