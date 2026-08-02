import type {
  CommandMap, CommandName, DependencyGraph, Diagnostic, Explanation, ProtocolError,
  ProfileEntry, RouteSnapshot, RpcRequest, RpcResponse, RuntimeEvent, RuntimeRef, RuntimeWarning, Snapshot, SnapshotOptions,
} from '@ng-agent/protocol';
import { PROTOCOL_VERSION } from '@ng-agent/protocol';
import type { RuntimeAdapter, RuntimeContext } from './adapter.js';
import { AngularDiscoveryAdapter } from './discovery.js';
import { getInstrumentation } from './instrumentation.js';
import { ReferenceRegistry } from './refs.js';
import { serialize } from './serializer.js';
import { querySnapshot } from './query.js';

export interface RuntimeEngineOptions {
  adapters?: RuntimeAdapter[];
  allowRuntimeMutations?: boolean;
  capabilityToken?: string;
  mutationAllowlist?: CommandMap['mutate']['params']['operation'][];
  allowNonLocalMutations?: boolean;
  eventHistoryLimit?: number;
}

export class RuntimeEngine {
  private generation = 0;
  private latest?: Snapshot;
  private latestRefs?: ReferenceRegistry;
  private readonly events: RuntimeEvent[] = [];
  private readonly snapshots: Snapshot[] = [];
  private sequence = 0;
  private profileStartedAt: number | undefined;
  private profileStartedWallTime: number | undefined;
  private profileBudgetMs: number | undefined;
  private lastProfile: CommandMap['profileStop']['result'] | undefined;
  private profileEntries: ProfileEntry[] = [];
  private profileFrames: Array<{ event: number; start: number }> = [];
  private removeAngularProfiler: (() => void) | undefined;
  private traceStartedAt: number | undefined;
  private traceAfterSequence: number | undefined;
  private readonly adapters: RuntimeAdapter[];
  private readonly clickListener: (event: Event) => void;
  private readonly instrumentationListener: (event: Event) => void;
  constructor(private readonly window: Window, private readonly options: RuntimeEngineOptions = {}) {
    this.adapters = ([new AngularDiscoveryAdapter(), ...(options.adapters ?? [])] as RuntimeAdapter[]).sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    this.clickListener = event => {
      const element = event.target instanceof Element ? event.target : undefined;
      this.emit({ type: 'user-interaction', timestamp: Date.now(), data: { action: 'click', target: element ? selectorFor(element) : 'unknown' }, confidence: 'observed' });
    };
    this.instrumentationListener = event => {
      const detail = (event as CustomEvent<import('./instrumentation.js').RuntimeInstrumentationEvent>).detail;
      if (detail) this.emitInstrumentationEvent(detail);
    };
    window.addEventListener('click', this.clickListener, true);
    window.addEventListener('__ng_agent_instrumentation_event__', this.instrumentationListener);
    for (const event of getInstrumentation(window)?.events ?? []) this.emitInstrumentationEvent(event);
  }

  async handle(request: RpcRequest): Promise<RpcResponse> {
    try {
      if (request.protocolVersion.split('.')[0] !== PROTOCOL_VERSION.split('.')[0]) throw protocolError('UNSUPPORTED', `Protocol ${request.protocolVersion} is incompatible with runtime ${PROTOCOL_VERSION}`);
      const result = await this.dispatch(request.method, request.params as never);
      return { jsonrpc: '2.0', id: request.id, result };
    } catch (error) {
      const protocolError: ProtocolError = isProtocolError(error) ? error : { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : String(error), retryable: false };
      return { jsonrpc: '2.0', id: request.id, error: protocolError };
    }
  }

  private async dispatch<C extends CommandName>(method: C, params: CommandMap[C]['params']): Promise<CommandMap[C]['result']> {
    switch (method) {
      case 'status': return this.status() as CommandMap[C]['result'];
      case 'snapshot': return await this.snapshot(params as SnapshotOptions) as CommandMap[C]['result'];
      case 'query': {
        const query = params as CommandMap['query']['params']; const snapshot = await this.ensureSnapshot();
        if (query.generation !== undefined && query.generation !== snapshot.generation) throw protocolError('STALE_REFERENCE', `Query generation ${query.generation} is stale; current generation is ${snapshot.generation}`);
        return querySnapshot(snapshot, query) as CommandMap[C]['result'];
      }
      case 'events': { const p = params as CommandMap['events']['params']; return this.events.filter(event => event.sequence > (p.after ?? 0)).slice(0, p.limit ?? 100) as CommandMap[C]['result']; }
      case 'graph': return await this.graph() as CommandMap[C]['result'];
      case 'diagnostics': return await this.diagnostics() as CommandMap[C]['result'];
      case 'diResolve': return await this.resolveProvider(params as CommandMap['diResolve']['params']) as CommandMap[C]['result'];
      case 'explain': return this.explain((params as CommandMap['explain']['params']).subject) as CommandMap[C]['result'];
      case 'profileStart': return this.startProfile(params as CommandMap['profileStart']['params']) as CommandMap[C]['result'];
      case 'profileStop': return this.stopProfile() as CommandMap[C]['result'];
      case 'traceStart': this.traceStartedAt = Date.now(); this.traceAfterSequence = this.sequence; return { startedAt: this.traceStartedAt, afterSequence: this.traceAfterSequence } as CommandMap[C]['result'];
      case 'traceStop': return this.stopTrace() as CommandMap[C]['result'];
      case 'sessionExport': return { protocolVersion: PROTOCOL_VERSION, exportedAt: Date.now(), snapshots: this.snapshots, events: this.events } as CommandMap[C]['result'];
      case 'sessionImport': return this.importSession(params as CommandMap['sessionImport']['params']) as CommandMap[C]['result'];
      case 'replay': return await this.replay(params as CommandMap['replay']['params']) as CommandMap[C]['result'];
      case 'interact': return this.interact(params as CommandMap['interact']['params']) as CommandMap[C]['result'];
      case 'mutate': return this.mutate(params as CommandMap['mutate']['params']) as CommandMap[C]['result'];
      default: throw protocolError('INVALID_REQUEST', `Unknown command: ${String(method)}`);
    }
  }

  private status(): CommandMap['status']['result'] {
    const ng = (this.window as unknown as { ng?: unknown }).ng;
    const version = this.detectVersion();
    return { connected: true, angular: { detected: !!ng || !!version, ...(version ? { version } : {}), devMode: !!ng, roots: this.latest?.angular.roots ?? [], discovery: this.options.adapters?.length && getInstrumentation(this.window) ? 'instrumented' : 'partial' }, capabilities: this.adapters.map(adapter => adapter.name) };
  }

  async snapshot(options: SnapshotOptions = {}): Promise<Snapshot> {
    const generation = ++this.generation;
    const refs = new ReferenceRegistry(generation);
    const warnings: RuntimeWarning[] = [];
    const configured = getInstrumentation(this.window)?.options ?? {};
    const configuredBudget = {
      ...(Array.isArray(configured['redact']) ? { redact: configured['redact'] as string[] } : {}),
      ...(typeof configured['maxDepth'] === 'number' ? { maxDepth: configured['maxDepth'] } : {}),
      ...(typeof configured['maxArrayLength'] === 'number' ? { maxArrayLength: configured['maxArrayLength'] } : {}),
      ...(typeof configured['maxStringLength'] === 'number' ? { maxStringLength: configured['maxStringLength'] } : {}),
      ...(typeof configured['maxProperties'] === 'number' ? { maxProperties: configured['maxProperties'] } : {}),
      ...(typeof configured['maxTotalBytes'] === 'number' ? { maxTotalBytes: configured['maxTotalBytes'] } : {}),
      ...options.budget,
    };
    const effectiveOptions: SnapshotOptions = { ...options, budget: configuredBudget };
    const context: RuntimeContext = {
      window: this.window, document: this.window.document, refs, options: effectiveOptions,
      warn: (code, message, domain) => warnings.push({ code, message, ...(domain ? { domain } : {}) }),
      emit: event => this.emit(event),
    };
    const status = this.status();
    const snapshot: Snapshot = {
      id: `snapshot-${generation}`, ...(options.name ? { name: options.name } : {}), generation,
      page: { url: this.window.location.href, title: this.window.document.title, userAgent: this.window.navigator.userAgent, capturedAt: Date.now() },
      angular: { ...status.angular, roots: [] }, components: [], directives: [], injectors: [], providers: [], signals: [], forms: [], signalForms: [], stores: [], warnings, truncations: [],
    };
    if (!snapshot.angular.detected) warnings.push({ code: 'ANGULAR_NOT_FOUND', message: 'Angular was not detected on this page.' });
    else if (!snapshot.angular.devMode) warnings.push({ code: 'PRODUCTION_BUILD', message: 'Angular was detected, but debug APIs are unavailable. Use a development build for runtime inspection.' });
    for (const adapter of this.adapters) {
      try { if (adapter.isAvailable(context)) await adapter.capture(snapshot, context); }
      catch (error) { context.warn('ADAPTER_FAILURE', `${adapter.name}: ${error instanceof Error ? error.message : String(error)}`, adapter.name); }
    }
    const hasSsrMarkers = !!context.document.querySelector('[ngh],[ng-server-context]') || !!context.document.body?.getAttribute('ng-server-context');
    snapshot.angular.renderMode = hasSsrMarkers ? snapshot.angular.devMode ? 'hydrated' : 'ssr' : 'client';
    snapshot.angular.multiRoot = snapshot.angular.roots.length > 1;
    if (this.lastProfile) snapshot.profile = this.lastProfile;
    if (options.compact) {
      for (const component of snapshot.components) component.properties = component.properties.filter(property => property.category !== 'property');
      for (const directive of snapshot.directives) directive.properties = directive.properties.filter(property => property.category !== 'property');
      if (snapshot.router) snapshot.router.events = snapshot.router.events.slice(-5);
    }
    if (options.scope === 'current-route' && snapshot.router) {
      const activeComponents = flattenRoutes(snapshot.router.roots).flatMap(route => route.active && route.component ? [route.component.id] : []);
      if (activeComponents.length) {
        const included = new Set(activeComponents); let changed = true;
        while (changed) { changed = false; for (const component of snapshot.components) if (component.parent && included.has(component.parent.id) && !included.has(component.ref.id)) { included.add(component.ref.id); changed = true; } }
        snapshot.components = snapshot.components.filter(component => included.has(component.ref.id));
      }
    }
    this.latest = snapshot;
    this.latestRefs = refs;
    this.snapshots.push(snapshot);
    this.snapshots.splice(0, Math.max(0, this.snapshots.length - 20));
    return snapshot;
  }

  private async ensureSnapshot(): Promise<Snapshot> { return this.latest ?? this.snapshot(); }
  private detectVersion(): string | undefined {
    const ng = (this.window as unknown as { ng?: { coreTokens?: { VERSION?: { full?: string } } } }).ng;
    return ng?.coreTokens?.VERSION?.full ?? this.window.document.querySelector('[ng-version]')?.getAttribute('ng-version') ?? undefined;
  }
  private emit(event: Omit<RuntimeEvent, 'id' | 'sequence'>): void {
    this.events.push({ ...event, id: crypto.randomUUID(), sequence: ++this.sequence });
    this.events.splice(0, Math.max(0, this.events.length - (this.options.eventHistoryLimit ?? 100)));
  }
  private emitInstrumentationEvent(event: import('./instrumentation.js').RuntimeInstrumentationEvent): void {
    const known = new Set<RuntimeEvent['type']>(['navigation', 'signal-changed', 'form-status-changed', 'signal-form-field-changed', 'signal-form-validation-changed', 'signal-form-submission', 'ngrx-action', 'store-changed', 'change-detection-cycle', 'runtime-warning', 'network-request']);
    const type: RuntimeEvent['type'] = known.has(event.type as RuntimeEvent['type']) ? event.type as RuntimeEvent['type'] : event.type.includes('signal-form') ? 'signal-form-field-changed' : 'runtime-warning';
    const configured = getInstrumentation(this.window)?.options ?? {};
    const serializationOptions = { ...(Array.isArray(configured['redact']) ? { redact: configured['redact'] as string[] } : {}) };
    const logicalSource = event.type.startsWith('signal-form') ? event.source : undefined;
    const data = serializeInstrumentationValue(event.value ?? { event: event.type }, logicalSource, serializationOptions);
    this.emit({ type, timestamp: event.timestamp, data, confidence: 'instrumented', ...(event.source ? { cause: event.source } : {}) });
  }
  private async graph(): Promise<DependencyGraph> {
    const snapshot = await this.ensureSnapshot();
    const graph: DependencyGraph = { nodes: [], edges: [] };
    const context = this.contextFor(snapshot);
    const addNode = (ref: RuntimeRef, label: string, data?: DependencyGraph['nodes'][number]['data']): void => {
      if (!graph.nodes.some(node => node.ref.id === ref.id)) graph.nodes.push({ ref, label, ...(data === undefined ? {} : { data }) });
    };
    const all = [...snapshot.components, ...snapshot.directives, ...snapshot.injectors, ...snapshot.providers, ...snapshot.signals, ...snapshot.forms, ...snapshot.signalForms, ...snapshot.stores, ...flattenRoutes(snapshot.router?.roots ?? [])];
    for (const item of all) addNode(item.ref, 'name' in item && typeof item.name === 'string' ? item.name : 'path' in item && typeof item.path === 'string' ? item.path : item.ref.id);
    for (const component of snapshot.components) {
      if (component.parent) graph.edges.push({ from: component.parent, to: component.ref, kind: 'renders', confidence: 'observed' });
      if (component.injector) graph.edges.push({ from: component.ref, to: component.injector, kind: 'injects', confidence: 'observed' });
      if (component.host) { const host = context.refs.resolve(component.host); if (host instanceof Element) addNode(component.host, selectorFor(host)); graph.edges.push({ from: component.ref, to: component.host, kind: 'renders', confidence: 'observed' }); }
    }
    for (const signal of snapshot.signals) if (signal.owner) graph.edges.push({ from: signal.owner, to: signal.ref, kind: 'owns', confidence: signal.discovery === 'instrumented' ? 'instrumented' : 'observed' });
    for (const form of snapshot.signalForms) {
      if (form.owner) graph.edges.push({ from: form.owner, to: form.ref, kind: 'owns', confidence: form.discovery === 'instrumented' ? 'instrumented' : 'observed' });
      const fieldsByPath = new Map(form.fields.map(field => [field.path, field]));
      for (const field of form.fields) {
        addNode(field.ref, field.path); graph.edges.push({ from: form.ref, to: field.ref, kind: 'controls', confidence: form.discovery === 'instrumented' ? 'instrumented' : 'observed' });
        if (field.element) { const element = context.refs.resolve(field.element); if (element instanceof Element) addNode(field.element, selectorFor(element)); graph.edges.push({ from: field.ref, to: field.element, kind: 'controls', confidence: 'observed' }); }
        for (const error of field.errors) for (const dependencyPath of error.dependsOn ?? []) { const dependency = fieldsByPath.get(dependencyPath); if (dependency && dependency.ref.id !== field.ref.id) graph.edges.push({ from: dependency.ref, to: field.ref, kind: 'validates', confidence: form.discovery === 'instrumented' ? 'instrumented' : 'inferred', evidence: [error.code] }); }
      }
    }
    for (const form of snapshot.forms) for (const control of flattenControls(form.root)) { addNode(control.ref, control.path || control.name); graph.edges.push({ from: form.ref, to: control.ref, kind: 'controls', confidence: 'observed' }); }
    for (const route of flattenRoutes(snapshot.router?.roots ?? [])) if (route.component) graph.edges.push({ from: route.ref, to: route.component, kind: 'activates', confidence: route.active ? 'observed' : 'inferred' });
    for (const provider of snapshot.providers) for (const consumer of provider.observedConsumers) graph.edges.push({ from: consumer, to: provider.ref, kind: 'injects', confidence: 'observed' });
    for (const store of snapshot.stores) for (const signal of store.signals ?? []) graph.edges.push({ from: store.ref, to: signal, kind: 'owns', confidence: store.discovery === 'instrumented' ? 'instrumented' : 'observed' });
    for (const record of getInstrumentation(this.window)?.records.values() ?? []) if ((record.kind === 'effect' || record.kind === 'service') && record.value && (typeof record.value === 'object' || typeof record.value === 'function')) {
      const ref = context.refs.ref(record.value as object, record.kind); addNode(ref, record.name);
      if (record.owner) graph.edges.push({ from: context.refs.ref(record.owner, 'component'), to: ref, kind: 'owns', confidence: 'instrumented' });
      if (record.kind === 'effect') for (const [metadataKey, edgeKind] of [['reads', 'reads'], ['writes', 'writes']] as const) {
        const dependencies = record.metadata?.[metadataKey];
        if (Array.isArray(dependencies)) for (const dependency of dependencies) if (dependency && (typeof dependency === 'object' || typeof dependency === 'function')) {
          const dependencyRef = context.refs.ref(dependency as object, 'signal'); addNode(dependencyRef, dependencyRef.id); graph.edges.push({ from: ref, to: dependencyRef, kind: edgeKind, confidence: 'instrumented' });
        }
      }
    }
    for (const resource of this.window.performance?.getEntriesByType('resource').slice(-50) ?? []) {
      const ref = context.refs.ref(resource, 'network-request'); const timing = resource as PerformanceResourceTiming;
      addNode(ref, resource.name, serialize({ name: resource.name, startTime: resource.startTime, duration: resource.duration, initiatorType: timing.initiatorType }).value);
    }
    for (const adapter of this.adapters) if (adapter.graph?.bind(adapter) && adapter.isAvailable(context)) await adapter.graph(snapshot, graph, context);
    return graph;
  }
  private async diagnostics(): Promise<Diagnostic[]> {
    const snapshot = await this.ensureSnapshot(); const result: Diagnostic[] = []; const context = this.contextFor(snapshot);
    for (const form of snapshot.signalForms) if (form.pending) result.push({ code: 'SIGNAL_FORM_PENDING', severity: 'warning', title: `Signal Form ${form.name ?? form.ref.id} is pending`, evidence: [form.ref.id], confidence: form.discovery === 'instrumented' ? 'instrumented' : 'observed', remediation: 'Inspect async validators and cancellation paths.', refs: [form.ref] });
    for (const form of snapshot.forms) if (form.root.pending) result.push({ code: 'FORM_PENDING', severity: 'warning', title: `Form ${form.ref.id} is pending`, evidence: [form.root.path], confidence: 'observed', remediation: 'Inspect async validators and ensure every observable completes.', refs: [form.ref] });
    for (const form of snapshot.signalForms) for (const field of form.fields) if (!field.element && !field.controlComponent) result.push({ code: 'SIGNAL_FORM_FIELD_NOT_RENDERED', severity: 'info', title: `${field.path} has no observed rendered control`, evidence: [field.path], confidence: 'inferred', remediation: 'Confirm that the field is intentionally conditional or dynamically rendered.', refs: [field.ref] });
    const providersByToken = new Map<string, typeof snapshot.providers>();
    for (const provider of snapshot.providers) providersByToken.set(provider.token, [...(providersByToken.get(provider.token) ?? []), provider]);
    for (const [token, providers] of providersByToken) if (providers.length > 1) result.push({ code: 'DUPLICATE_PROVIDER', severity: 'warning', title: `${token} is provided by multiple injectors`, evidence: providers.map(provider => provider.injector.id), confidence: 'observed', remediation: 'Verify whether hierarchical shadowing is intentional.', refs: providers.map(provider => provider.ref) });
    const injectors = new Map(snapshot.injectors.map(injector => [injector.ref.id, injector]));
    for (const [token, providers] of providersByToken) for (const provider of providers) {
      const ancestors = new Set<string>(); let current = injectors.get(provider.injector.id)?.parent;
      while (current && !ancestors.has(current.id)) { ancestors.add(current.id); current = injectors.get(current.id)?.parent; }
      const shadowed = providers.find(candidate => ancestors.has(candidate.injector.id));
      if (shadowed) result.push({ code: 'SHADOWED_PROVIDER', severity: 'info', title: `${token} from ${shadowed.injector.id} is shadowed at ${provider.injector.id}`, evidence: [provider.injector.id, shadowed.injector.id], confidence: 'observed', remediation: 'Confirm that the narrower provider scope is intentional.', refs: [provider.ref, shadowed.ref] });
    }
    for (const injector of snapshot.injectors) { const path = new Set<string>([injector.ref.id]); let current = injector.parent; while (current) { if (path.has(current.id)) { result.push({ code: 'DI_CYCLE', severity: 'error', title: `Injector parent cycle detected from ${injector.ref.id}`, evidence: [...path, current.id], confidence: 'observed', remediation: 'Remove the cyclic parent relationship or inspect custom injector construction.', refs: [injector.ref] }); break; } path.add(current.id); current = injectors.get(current.id)?.parent; } }
    const cycles = this.events.filter(event => event.type === 'change-detection-cycle');
    if (cycles.length >= 20) result.push({ code: 'EXCESSIVE_CHANGE_DETECTION', severity: 'warning', title: `${cycles.length} change-detection cycles were observed in the retained event window`, evidence: cycles.slice(-10).map(event => event.id), confidence: cycles.every(event => event.confidence === 'instrumented') ? 'instrumented' : 'observed', remediation: 'Inspect triggers and OnPush boundaries in the profiler.', refs: [] });
    for (const entry of snapshot.profile?.entries ?? []) if (entry.duration > 16 && ['validation', 'selector', 'effect'].includes(entry.kind)) result.push({ code: `SLOW_${entry.kind.toUpperCase()}`, severity: 'warning', title: `${entry.name} took ${entry.duration.toFixed(2)} ms`, evidence: [{ duration: entry.duration, start: entry.start }], confidence: 'observed', remediation: `Reduce work performed by this ${entry.kind}.`, refs: entry.ref ? [entry.ref] : [] });
    const effectEntries = (getInstrumentation(this.window)?.events ?? []).filter(event => event.type === 'profile-entry' && event.value && typeof event.value === 'object' && (event.value as Record<string, unknown>)['kind'] === 'effect');
    const effectsByName = new Map<string, typeof effectEntries>();
    for (const entry of effectEntries) effectsByName.set(entry.source ?? 'unknown', [...(effectsByName.get(entry.source ?? 'unknown') ?? []), entry]);
    for (const [name, entries] of effectsByName) if (entries.length >= 20) result.push({ code: 'FREQUENT_EFFECT', severity: 'warning', title: `${name} ran ${entries.length} times in the retained history`, evidence: entries.slice(-10).map(entry => entry.timestamp), confidence: 'instrumented', remediation: 'Inspect signal dependencies and avoid redundant writes inside the effect.', refs: [] });
    const creations = new Map<string, RuntimeEvent[]>();
    for (const event of this.events.filter(item => item.type === 'component-created')) creations.set(event.cause ?? 'unknown', [...(creations.get(event.cause ?? 'unknown') ?? []), event]);
    for (const [component, events] of creations) if (events.length >= 10) result.push({ code: 'COMPONENT_RECREATED', severity: 'warning', title: `${component} was created ${events.length} times`, evidence: events.map(event => event.id), confidence: 'observed', remediation: 'Check unstable tracking keys and conditional view churn.', refs: [] });
    for (const adapter of this.adapters) if (adapter.diagnostics && adapter.isAvailable(context)) result.push(...await adapter.diagnostics(snapshot, context));
    return result;
  }
  private async resolveProvider(params: CommandMap['diResolve']['params']): Promise<CommandMap['diResolve']['result']> {
    const snapshot = await this.ensureSnapshot();
    if (params.from.generation !== snapshot.generation) throw protocolError('STALE_REFERENCE', `Reference ${params.from.id} belongs to generation ${params.from.generation}; current generation is ${snapshot.generation}`);
    const start = params.from.kind === 'component' ? snapshot.components.find(item => item.ref.id === params.from.id)?.injector : params.from.kind === 'injector' ? params.from : undefined;
    if (!start) return { token: params.token, from: params.from, path: [], flags: [], error: 'Starting injector was not found', confidence: 'observed' };
    const injectors = new Map(snapshot.injectors.map(injector => [injector.ref.id, injector]));
    const path: RuntimeRef[] = []; let current = injectors.get(start.id); let winner: RuntimeRef | undefined;
    while (current) {
      path.push(current.ref);
      winner = current.providers.map(ref => snapshot.providers.find(provider => provider.ref.id === ref.id)).find(provider => provider?.token === params.token)?.ref;
      if (winner) break;
      current = current.parent ? injectors.get(current.parent.id) : undefined;
    }
    if (!winner) for (const root of snapshot.injectors.filter(injector => injector.injectorType === 'environment' && !injector.parent)) {
      if (!path.some(ref => ref.id === root.ref.id)) path.push(root.ref);
      winner = root.providers.map(ref => snapshot.providers.find(provider => provider.ref.id === ref.id)).find(provider => provider?.token === params.token)?.ref;
      if (winner) break;
    }
    return { token: params.token, from: params.from, path, ...(winner ? { winner } : { error: `No observed provider for ${params.token}` }), flags: [], confidence: 'observed' };
  }
  private explain(subject: CommandMap['explain']['params']['subject']): Explanation {
    const ref = typeof subject === 'string' ? undefined : subject;
    const subjectLabel = typeof subject === 'string' ? subject : subject.id;
    if (ref && this.latest && ref.generation !== this.latest.generation) throw protocolError('STALE_REFERENCE', `Reference ${ref.id} belongs to generation ${ref.generation}; current generation is ${this.latest.generation}`);
    const facts: Explanation['facts'] = [];
    if (ref && this.latest) {
      const component = this.latest.components.find(item => item.ref.id === ref.id);
      const signal = this.latest.signals.find(item => item.ref.id === ref.id);
      const form = this.latest.signalForms.find(item => item.ref.id === ref.id || item.fields.some(field => field.ref.id === ref.id));
      if (component?.injector) facts.push({ relation: 'uses-injector', value: component.injector.id, confidence: 'observed' });
      if (signal?.owner) facts.push({ relation: 'owned-by', value: signal.owner.id, confidence: signal.discovery === 'instrumented' ? 'instrumented' : 'observed' });
      const errors = ref.kind === 'field' ? form?.fields.find(field => field.ref.id === ref.id)?.errors ?? [] : form?.errors ?? [];
      for (const error of errors) facts.push({ relation: 'invalid-because', value: { code: error.code, message: error.message ?? '' }, confidence: form?.discovery === 'instrumented' ? 'instrumented' : 'observed' });
    }
    return { subject, summary: ref ? `${ref.kind} ${ref.id} has ${facts.length} observed relation(s) in ${this.latest?.id ?? 'no snapshot'}.` : subjectLabel, facts, evidence: ref ? [ref] : [], limitations: ['Only observed and instrumented runtime relations are reported.'] };
  }
  private stopProfile(): CommandMap['profileStop']['result'] {
    if (this.profileStartedAt === undefined) throw protocolError('INVALID_REQUEST', 'Profiling has not been started');
    const now = performance.now(); const startedAt = this.profileStartedAt; this.profileStartedAt = undefined;
    const wallTime = this.profileStartedWallTime ?? 0;
    const entries: ProfileEntry[] = [...this.profileEntries, ...(getInstrumentation(this.window)?.events ?? []).filter(event => event.type === 'profile-entry' && event.timestamp >= wallTime).flatMap(event => {
      if (!event.value || typeof event.value !== 'object') return [];
      const value = event.value as Record<string, unknown>; const kind = value['kind'];
      if (typeof value['name'] !== 'string' || typeof value['start'] !== 'number' || typeof value['duration'] !== 'number' || !['validation', 'selector', 'effect', 'lifecycle'].includes(String(kind))) return [];
      return [{ name: value['name'], kind: kind as 'validation' | 'selector' | 'effect' | 'lifecycle', start: value['start'], duration: value['duration'] }];
    })];
    this.removeAngularProfiler?.(); this.removeAngularProfiler = undefined; this.profileFrames = [];
    if (!entries.length) entries.push({ name: 'profile-window', kind: 'cycle', start: startedAt, duration: now - startedAt });
    const budgetMs = this.profileBudgetMs; this.profileStartedWallTime = undefined; this.profileBudgetMs = undefined;
    const profile = { startedAt, stoppedAt: now, entries, budgetExceeded: budgetMs !== undefined && entries.some(entry => entry.duration > budgetMs), ...(budgetMs === undefined ? {} : { budgetMs }) };
    this.lastProfile = profile;
    return profile;
  }
  private startProfile(params: CommandMap['profileStart']['params']): CommandMap['profileStart']['result'] {
    this.removeAngularProfiler?.(); this.profileEntries = []; this.profileFrames = [];
    this.profileStartedAt = performance.now(); this.profileStartedWallTime = Date.now(); this.profileBudgetMs = params.budgetMs;
    const api = (this.window as unknown as { ng?: { ɵsetProfiler?(callback: (event: number, instance?: object | null, eventFn?: ((...args: unknown[]) => unknown)) => void): () => void } }).ng;
    this.removeAngularProfiler = api?.ɵsetProfiler?.((event, instance, eventFn) => this.captureAngularProfileEvent(event, instance, eventFn));
    return { startedAt: this.profileStartedWallTime };
  }
  private captureAngularProfileEvent(event: number, instance?: object | null, eventFn?: ((...args: unknown[]) => unknown)): void {
    const pairs = new Map<number, number>([[1, 0], [3, 2], [5, 4], [7, 6], [9, 8], [11, 10], [13, 12], [15, 14], [17, 16], [19, 18], [21, 20], [23, 22], [25, 24]]);
    if (!pairs.has(event)) { if ([...pairs.values()].includes(event)) this.profileFrames.push({ event, start: performance.now() }); return; }
    const startEvent = pairs.get(event); if (startEvent === undefined) return;
    let index = -1; for (let candidate = this.profileFrames.length - 1; candidate >= 0; candidate--) if (this.profileFrames[candidate]?.event === startEvent) { index = candidate; break; }
    if (index < 0) return;
    const [frame] = this.profileFrames.splice(index, 1); if (!frame) return;
    const duration = performance.now() - frame.start;
    const kind: ProfileEntry['kind'] = [12, 14].includes(frame.event) ? 'cycle' : frame.event === 4 ? 'lifecycle' : frame.event === 24 ? 'directive' : 'component';
    const name = eventFn?.name || instance?.constructor?.name?.replace(/^_/, '') || angularProfileEventName(frame.event);
    this.profileEntries.push({ name, kind, start: frame.start, duration });
    if (kind === 'cycle') this.emit({ type: 'change-detection-cycle', timestamp: Date.now(), data: { name, duration }, confidence: 'observed' });
  }
  private stopTrace(): CommandMap['traceStop']['result'] {
    if (this.traceStartedAt === undefined || this.traceAfterSequence === undefined) throw protocolError('INVALID_REQUEST', 'Tracing has not been started');
    const startedAt = this.traceStartedAt; const afterSequence = this.traceAfterSequence;
    const events = this.events.filter(event => event.sequence > afterSequence);
    this.traceStartedAt = undefined; this.traceAfterSequence = undefined;
    return { startedAt, stoppedAt: Date.now(), steps: events.map((event, index) => {
      const previous = index ? events[index - 1] : undefined; const explicitlyLinked = !!previous && event.cause === previous.id;
      return { index, event, ...(previous ? { causedBy: previous.id } : {}), confidence: explicitlyLinked ? event.confidence : previous ? 'inferred' : event.confidence };
    }) };
  }
  private mutate(params: CommandMap['mutate']['params']): CommandMap['mutate']['result'] {
    const registry = getInstrumentation(this.window);
    const allowMutations = this.options.allowRuntimeMutations || registry?.options['allowRuntimeMutations'] === true;
    const configuredToken = this.options.capabilityToken ?? (typeof registry?.options['capabilityToken'] === 'string' ? registry.options['capabilityToken'] : undefined);
    if (!allowMutations || !configuredToken || params.capabilityToken !== configuredToken) throw protocolError('MUTATION_DENIED', 'Mutation capability is disabled or invalid');
    const configuredAllowlist = this.options.mutationAllowlist ?? (Array.isArray(registry?.options['mutationAllowlist']) ? registry.options['mutationAllowlist'] as CommandMap['mutate']['params']['operation'][] : []);
    if (!configuredAllowlist.includes(params.operation)) throw protocolError('MUTATION_DENIED', `Operation ${params.operation} is not allowlisted`);
    const allowNonLocal = this.options.allowNonLocalMutations || registry?.options['allowNonLocalMutations'] === true;
    if (!allowNonLocal && !['localhost', '127.0.0.1', '::1'].includes(this.window.location.hostname)) throw protocolError('MUTATION_DENIED', 'Mutations are only permitted on local origins');
    const target = typeof params.target === 'string' ? params.target : params.target.id;
    if (typeof params.target !== 'string' && (!this.latest || params.target.generation !== this.latest.generation)) throw protocolError('STALE_REFERENCE', `Reference ${params.target.id} is not part of the current generation`);
    const targetObject = typeof params.target === 'string' ? undefined : this.latestRefs?.resolve(params.target);
    let applied = false;
    if (params.operation === 'signal.set') {
      const record = [...(registry?.records.values() ?? [])].find(item => item.kind === 'signal' && ([item.id, item.name].includes(target) || item.value === targetObject));
      const signal = record?.value as { set?(value: unknown): void } | undefined;
      if (signal?.set) { signal.set(params.value); applied = true; }
    } else if (params.operation === 'form.set') {
      for (const record of registry?.records.values() ?? []) if (record.kind === 'signal-form') {
        const item = (record.metadata?.['fields'] as Array<{ path: string; field: object }> | undefined)?.find(candidate => candidate.path === target || `${record.id}:${candidate.path}` === target || candidate.field === targetObject);
        if (!item) continue;
        try {
          const state = typeof item.field === 'function' ? (item.field as () => { value?: { set?(value: unknown): void } })() : item.field as { value?: { set?(value: unknown): void } };
          if (state.value?.set) { state.value.set(params.value); applied = true; }
        } catch { /* This field does not expose a writable value. */ }
      }
    } else if (params.operation === 'router.navigate') {
      const router = [...(registry?.records.values() ?? [])].find(item => item.kind === 'service' && item.name === 'Router')?.value as { navigateByUrl?(url: string): unknown } | undefined;
      if (router?.navigateByUrl && typeof params.value === 'string') { void router.navigateByUrl(params.value); applied = true; }
    } else if (params.operation === 'ngrx.dispatch') {
      const store = [...(registry?.records.values() ?? [])].find(item => item.kind === 'store' && item.metadata?.['type'] === 'ngrx')?.value as { dispatch?(action: unknown): void } | undefined;
      if (store?.dispatch) { store.dispatch(params.value); applied = true; }
    }
    if (!applied) throw protocolError('NOT_FOUND', `No instrumented target handles ${params.operation} for ${target}`);
    const auditId = crypto.randomUUID();
    const type = params.operation === 'router.navigate' ? 'navigation' : params.operation === 'ngrx.dispatch' ? 'ngrx-action' : params.operation === 'form.set' ? 'signal-form-field-changed' : 'signal-changed';
    this.emit({ type, timestamp: Date.now(), data: serialize({ auditId, operation: params.operation, target, value: params.value }).value, confidence: 'instrumented' });
    return { applied: true, auditId };
  }
  private importSession(params: CommandMap['sessionImport']['params']): CommandMap['sessionImport']['result'] {
    if (params.session.protocolVersion.split('.')[0] !== PROTOCOL_VERSION.split('.')[0]) throw protocolError('UNSUPPORTED', `Cannot import protocol ${params.session.protocolVersion}`);
    this.snapshots.push(...params.session.snapshots);
    this.snapshots.splice(0, Math.max(0, this.snapshots.length - 20));
    for (const event of params.session.events) this.events.push({ ...event, id: crypto.randomUUID(), sequence: ++this.sequence });
    this.events.splice(0, Math.max(0, this.events.length - (this.options.eventHistoryLimit ?? 100)));
    return { snapshots: params.session.snapshots.length, events: params.session.events.length };
  }
  private async replay(params: CommandMap['replay']['params']): Promise<CommandMap['replay']['result']> {
    let applied = 0;
    if (params.apply && !['localhost', '127.0.0.1', '::1'].includes(this.window.location.hostname)) throw protocolError('MUTATION_DENIED', 'Applied replay is only permitted on local origins');
    if (params.apply) for (const event of params.events) {
      if (event.type === 'user-interaction' && event.data && typeof event.data === 'object' && !Array.isArray(event.data)) {
        const target = event.data['target']; if (typeof target === 'string') { this.interact({ action: 'click', target }); applied++; continue; }
      }
      const snapshot = await this.ensureSnapshot(); const context = this.contextFor(snapshot);
      for (const adapter of this.adapters) if (adapter.replay && adapter.isAvailable(context) && await adapter.replay(event, context)) { applied++; break; }
    }
    return { steps: params.events.length, applied, dryRun: !params.apply };
  }
  private interact(params: CommandMap['interact']['params']): CommandMap['interact']['result'] {
    let element: Element | undefined;
    if (typeof params.target === 'string') element = this.window.document.querySelector(params.target) ?? undefined;
    else {
      if (!this.latest || params.target.generation !== this.latest.generation) throw protocolError('STALE_REFERENCE', `Reference ${params.target.id} is not part of the current generation`);
      const resolved = this.latestRefs?.resolve(params.target); if (resolved instanceof Element) element = resolved;
    }
    if (!element) throw protocolError('NOT_FOUND', 'Target element was not found');
    if (params.action === 'click') (element as HTMLElement).click();
    return { applied: true };
  }
  private contextFor(snapshot: Snapshot): RuntimeContext {
    return { window: this.window, document: this.window.document, refs: this.latestRefs ?? new ReferenceRegistry(snapshot.generation), options: {}, warn: (code, message, domain) => snapshot.warnings.push({ code, message, ...(domain ? { domain } : {}) }), emit: event => this.emit(event) };
  }
  async dispose(): Promise<void> {
    this.removeAngularProfiler?.();
    this.window.removeEventListener('click', this.clickListener, true);
    this.window.removeEventListener('__ng_agent_instrumentation_event__', this.instrumentationListener);
    for (const adapter of this.adapters) await adapter.dispose?.();
  }
  registerAdapter(adapter: RuntimeAdapter): void {
    if (this.adapters.some(existing => existing.name === adapter.name)) throw new Error(`Runtime adapter already registered: ${adapter.name}`);
    this.adapters.push(adapter); this.adapters.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  }
  unregisterAdapter(name: string): void {
    const index = this.adapters.findIndex(adapter => adapter.name === name);
    if (index < 0 || name === 'angular-discovery') return;
    const [adapter] = this.adapters.splice(index, 1); void adapter?.dispose?.();
  }
}

const protocolError = (code: ProtocolError['code'], message: string): ProtocolError => ({ code, message, retryable: false });
const isProtocolError = (value: unknown): value is ProtocolError => !!value && typeof value === 'object' && 'code' in value && 'retryable' in value;
const selectorFor = (element: Element): string => element.id ? `#${element.id}` : `${element.tagName.toLowerCase()}${element.classList.length ? `.${[...element.classList].join('.')}` : ''}`;
const flattenRoutes = (routes: RouteSnapshot[]): RouteSnapshot[] => routes.flatMap(route => [route, ...flattenRoutes(route.children)]);
const flattenControls = (control: Snapshot['forms'][number]['root']): Array<Snapshot['forms'][number]['root']> => [control, ...control.children.flatMap(flattenControls)];
const angularProfileEventName = (event: number): string => ({ 0: 'template-create', 2: 'template-update', 4: 'lifecycle-hook', 6: 'output', 8: 'bootstrap-application', 10: 'bootstrap-component', 12: 'change-detection', 14: 'change-detection-sync', 16: 'after-render-hooks', 18: 'component', 20: 'defer-block', 22: 'dynamic-component', 24: 'host-bindings' } as Record<number, string>)[event] ?? `angular-event-${event}`;
const serializeInstrumentationValue = (value: unknown, source: string | undefined, options: Partial<import('@ng-agent/protocol').SerializationBudget>): import('@ng-agent/protocol').SerializedValue => {
  if (Array.isArray(value)) return value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return serialize(item, options, source ?? '').value;
    const record = item as Record<string, unknown>; const path = typeof record['path'] === 'string' ? record['path'] : source ?? '';
    return Object.fromEntries(Object.entries(record).map(([key, child]) => [key, serialize(child, options, key === 'value' ? path : path ? `${path}.${key}` : key).value]));
  });
  return serialize(value, options, source ?? '').value;
};

export interface RuntimeBridge { protocolVersion: string; request(request: RpcRequest): Promise<RpcResponse>; registerAdapter(adapter: RuntimeAdapter): void; unregisterAdapter(name: string): void; dispose(): Promise<void> }
export function installRuntimeBridge(window: Window, options: RuntimeEngineOptions = {}): RuntimeBridge {
  const engine = new RuntimeEngine(window, options);
  const bridge: RuntimeBridge = { protocolVersion: PROTOCOL_VERSION, request: request => engine.handle(request), registerAdapter: adapter => engine.registerAdapter(adapter), unregisterAdapter: name => engine.unregisterAdapter(name), dispose: () => engine.dispose() };
  Object.defineProperty(window, '__NG_AGENT__', { value: bridge, configurable: true });
  return bridge;
}
