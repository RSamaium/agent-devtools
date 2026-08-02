export const PROTOCOL_VERSION = '1.0.0' as const;

export type RuntimeKind =
  | 'element' | 'component' | 'directive' | 'injector' | 'provider' | 'service'
  | 'signal' | 'computed' | 'effect' | 'form' | 'field' | 'route' | 'store'
  | 'selector' | 'network-request';

export interface RuntimeRef {
  id: string;
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

export interface AngularMetadata {
  detected: boolean;
  version?: string;
  devMode: boolean;
  roots: RuntimeRef[];
  discovery: DiscoveryLevel;
  renderMode?: 'client' | 'ssr' | 'hydrated';
  multiRoot?: boolean;
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
  page: PageMetadata;
  angular: AngularMetadata;
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

export type RuntimeEventType =
  | 'navigation' | 'component-created' | 'component-destroyed' | 'signal-changed'
  | 'form-status-changed' | 'signal-form-field-changed' | 'signal-form-validation-changed'
  | 'signal-form-submission'
  | 'ngrx-action' | 'store-changed' | 'change-detection-cycle' | 'runtime-warning'
  | 'network-request' | 'user-interaction';

export interface RuntimeEvent {
  id: string;
  sequence: number;
  type: RuntimeEventType;
  timestamp: number;
  source?: RuntimeRef;
  data: SerializedValue;
  cause?: string;
  confidence: Confidence;
}

export type Confidence = 'observed' | 'instrumented' | 'inferred';

export interface GraphNode { ref: RuntimeRef; label: string; data?: SerializedValue }
export type GraphEdgeKind = 'owns' | 'renders' | 'injects' | 'resolves-to' | 'reads' | 'writes' | 'validates' | 'controls' | 'dispatches' | 'selects' | 'activates' | 'triggers';
export interface GraphEdge { from: RuntimeRef; to: RuntimeRef; kind: GraphEdgeKind; confidence: Confidence; evidence?: string[] }
export interface DependencyGraph { nodes: GraphNode[]; edges: GraphEdge[] }

export interface Diagnostic {
  code: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  evidence: SerializedValue[];
  confidence: Confidence;
  remediation?: string;
  refs: RuntimeRef[];
}

export interface Explanation {
  subject: RuntimeRef | string;
  summary: string;
  facts: Array<{ relation: string; value: SerializedValue; confidence: Confidence }>;
  evidence: RuntimeRef[];
  limitations: string[];
}

export interface TraceStep {
  index: number;
  event: RuntimeEvent;
  causedBy?: string;
  confidence: Confidence;
}
export interface TraceResult { startedAt: number; stoppedAt: number; steps: TraceStep[] }

export interface SessionExport {
  protocolVersion: string;
  exportedAt: number;
  snapshots: Snapshot[];
  events: RuntimeEvent[];
}

export interface SnapshotOptions {
  scope?: 'all' | 'current-route';
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

export type QueryDomain = 'components' | 'directives' | 'providers' | 'signals' | 'forms' | 'signal-forms' | 'fields' | 'stores' | 'routes';
export interface StructuredQuery { domain: QueryDomain; where?: Record<string, SerializedValue>; limit?: number; cursor?: string; generation?: number }
export interface QueryResult { items: SerializedValue[]; nextCursor?: string; total: number; generation: number }

export interface ProtocolError {
  code: 'INVALID_REQUEST' | 'NOT_CONNECTED' | 'ANGULAR_NOT_FOUND' | 'PRODUCTION_BUILD' | 'STALE_REFERENCE' | 'NOT_FOUND' | 'UNSUPPORTED' | 'TIMEOUT' | 'BUDGET_EXCEEDED' | 'MUTATION_DENIED' | 'INTERNAL_ERROR';
  message: string;
  details?: SerializedValue;
  retryable: boolean;
}

export interface CommandMap {
  status: { params: Record<string, never>; result: { connected: boolean; angular: AngularMetadata; capabilities: string[] } };
  snapshot: { params: SnapshotOptions; result: Snapshot };
  query: { params: StructuredQuery; result: QueryResult };
  explain: { params: { subject: RuntimeRef | string; question?: string }; result: Explanation };
  graph: { params: { scope?: string }; result: DependencyGraph };
  diagnostics: { params: { scope?: string }; result: Diagnostic[] };
  diResolve: { params: { token: string; from: RuntimeRef }; result: ResolutionSnapshot };
  events: { params: { after?: number; limit?: number }; result: RuntimeEvent[] };
  profileStart: { params: { budgetMs?: number }; result: { startedAt: number } };
  profileStop: { params: Record<string, never>; result: ProfileSnapshot };
  traceStart: { params: Record<string, never>; result: { startedAt: number; afterSequence: number } };
  traceStop: { params: Record<string, never>; result: TraceResult };
  sessionExport: { params: Record<string, never>; result: SessionExport };
  sessionImport: { params: { session: SessionExport }; result: { snapshots: number; events: number } };
  replay: { params: { events: RuntimeEvent[]; apply?: boolean }; result: { steps: number; applied: number; dryRun: boolean } };
  interact: { params: { action: 'click'; target: RuntimeRef | string }; result: { applied: boolean } };
  mutate: { params: MutationRequest; result: { applied: boolean; auditId: string } };
}

export type CommandName = keyof CommandMap;
export interface RpcRequest<C extends CommandName = CommandName> { jsonrpc: '2.0'; id: string; protocolVersion: string; sessionId: string; timestamp: number; method: C; params: CommandMap[C]['params'] }
export interface RpcSuccess<R = unknown> { jsonrpc: '2.0'; id: string; result: R }
export interface RpcFailure { jsonrpc: '2.0'; id: string; error: ProtocolError }
export type RpcResponse<R = unknown> = RpcSuccess<R> | RpcFailure;

export interface MutationRequest {
  operation: 'signal.set' | 'form.set' | 'ngrx.dispatch' | 'router.navigate';
  target: RuntimeRef | string;
  value: SerializedValue;
  capabilityToken: string;
}
