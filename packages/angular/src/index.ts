import { ENVIRONMENT_INITIALIZER, EnvironmentInjector, InjectionToken, effect, makeEnvironmentProviders, inject, type EnvironmentProviders, type Provider } from '@angular/core';

export interface SignalFormsInstrumentationOptions {
  captureSchemas?: boolean;
  captureValidationEvents?: boolean;
  captureSubmissions?: boolean;
}
export interface NgAgentDevtoolsOptions {
  redact?: string[];
  historyLimit?: number;
  maxDepth?: number;
  maxArrayLength?: number;
  maxStringLength?: number;
  maxProperties?: number;
  maxTotalBytes?: number;
  allowRuntimeMutations?: boolean;
  capabilityToken?: string;
  mutationAllowlist?: Array<'signal.set' | 'form.set' | 'ngrx.dispatch' | 'router.navigate'>;
  allowNonLocalMutations?: boolean;
  signalForms?: SignalFormsInstrumentationOptions;
}
export const NG_AGENT_OPTIONS = new InjectionToken<Readonly<NgAgentDevtoolsOptions>>('NG_AGENT_OPTIONS');

export interface InstrumentedRecord {
  id: string; kind: 'signal' | 'effect' | 'form' | 'signal-form' | 'store' | 'service' | 'injector'; name: string;
  value: unknown; owner?: object; metadata?: Record<string, unknown>; registeredAt: number;
}
export interface InstrumentationEvent { type: string; timestamp: number; source?: string; value?: unknown; origin?: string }
export interface NgAgentInstrumentation {
  readonly options: Readonly<NgAgentDevtoolsOptions>;
  readonly records: Map<string, InstrumentedRecord>;
  readonly events: InstrumentationEvent[];
  register(record: Omit<InstrumentedRecord, 'registeredAt'>): () => void;
  record(event: InstrumentationEvent): void;
}

export const NG_AGENT_INSTRUMENTATION = new InjectionToken<NgAgentInstrumentation>('NG_AGENT_INSTRUMENTATION');

function createInstrumentation(options: Readonly<NgAgentDevtoolsOptions>): NgAgentInstrumentation {
  const records = new Map<string, InstrumentedRecord>(); const events: InstrumentationEvent[] = [];
  return {
    options, records, events,
    register(record) { records.set(record.id, { ...record, registeredAt: Date.now() }); return () => records.delete(record.id); },
    record(event) {
      events.push(event); events.splice(0, Math.max(0, events.length - (options.historyLimit ?? 100)));
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('__ng_agent_instrumentation_event__', { detail: event }));
    },
  };
}

export function provideNgAgentDevtools(options: NgAgentDevtoolsOptions = {}): EnvironmentProviders {
  const frozen = Object.freeze({ allowRuntimeMutations: false, historyLimit: 100, ...options });
  const providers: Provider[] = [
    { provide: NG_AGENT_OPTIONS, useValue: frozen },
    { provide: NG_AGENT_INSTRUMENTATION, useFactory: () => createInstrumentation(inject(NG_AGENT_OPTIONS)) },
    {
      provide: ENVIRONMENT_INITIALIZER, multi: true,
      useValue: () => {
        const instrumentation = inject(NG_AGENT_INSTRUMENTATION);
        const environmentInjector = inject(EnvironmentInjector);
        instrumentation.register({ id: 'injector:environment:root', kind: 'injector', name: 'EnvironmentInjector', value: environmentInjector, metadata: { type: 'environment-injector' } });
        if (typeof window !== 'undefined') Object.defineProperty(window, '__NG_AGENT_INSTRUMENTATION__', { value: instrumentation, configurable: true });
      },
    },
  ];
  return makeEnvironmentProviders(providers);
}

export function injectNgAgentInstrumentation(): NgAgentInstrumentation { return inject(NG_AGENT_INSTRUMENTATION); }

export function instrumentSignal(name: string, signal: object, options: { id?: string; owner?: object; metadata?: Record<string, unknown> } = {}): () => void {
  const instrumentation = inject(NG_AGENT_INSTRUMENTATION);
  const unregister = instrumentation.register({ id: options.id ?? `signal:${name}`, kind: 'signal', name, value: signal, ...(options.owner ? { owner: options.owner } : {}), ...(options.metadata ? { metadata: options.metadata } : {}) });
  let initialized = false;
  const watcher = typeof signal === 'function' ? effect(() => {
    const value = (signal as () => unknown)();
    if (initialized) instrumentation.record({ type: 'signal-changed', timestamp: Date.now(), source: options.id ?? `signal:${name}`, value, origin: 'angular-effect' });
    initialized = true;
  }) : undefined;
  return () => { watcher?.destroy(); unregister(); };
}

export function instrumentEffect(name: string, effectRef: object, options: { id?: string; owner?: object; reads?: object[]; writes?: object[]; metadata?: Record<string, unknown> } = {}): () => void {
  const metadata = { ...options.metadata, ...(options.reads ? { reads: options.reads } : {}), ...(options.writes ? { writes: options.writes } : {}) };
  return inject(NG_AGENT_INSTRUMENTATION).register({ id: options.id ?? `effect:${name}`, kind: 'effect', name, value: effectRef, ...(options.owner ? { owner: options.owner } : {}), ...(Object.keys(metadata).length ? { metadata } : {}) });
}

export function instrumentSignalForm(name: string, form: object, options: { id?: string; owner?: object; model?: unknown; schema?: unknown; fields?: Array<{ path: string; field: object }> } = {}): () => void {
  const instrumentation = inject(NG_AGENT_INSTRUMENTATION);
  const signalFormsOptions = instrumentation.options.signalForms;
  const metadata = { ...(options.model === undefined ? {} : { model: options.model }), ...(options.schema === undefined || !signalFormsOptions?.captureSchemas ? {} : { schema: options.schema }), ...(options.fields === undefined ? {} : { fields: options.fields }) };
  const unregister = instrumentation.register({ id: options.id ?? `signal-form:${name}`, kind: 'signal-form', name, value: form, ...(options.owner ? { owner: options.owner } : {}), metadata });
  let initialized = false;
  const watcher = options.fields?.length ? effect(() => {
    const states = (options.fields ?? []).map(item => {
      const state = typeof item.field === 'function' ? (item.field as () => Record<string, (() => unknown) | undefined>)() : item.field as Record<string, (() => unknown) | undefined>;
      return { path: item.path, value: state['value']?.(), valid: state['valid']?.(), pending: state['pending']?.(), errors: state['errors']?.() };
    });
    if (initialized) {
      instrumentation.record({ type: 'signal-form-field-changed', timestamp: Date.now(), source: options.id ?? `signal-form:${name}`, value: states, origin: 'angular-effect' });
      if (signalFormsOptions?.captureValidationEvents) instrumentation.record({ type: 'signal-form-validation-changed', timestamp: Date.now(), source: options.id ?? `signal-form:${name}`, value: states.map(state => ({ path: state.path, valid: state.valid, pending: state.pending, errors: state.errors })), origin: 'angular-effect' });
    }
    initialized = true;
  }) : undefined;
  return () => { watcher?.destroy(); unregister(); };
}

export function instrumentClassicForm(name: string, control: object, options: { id?: string; owner?: object } = {}): () => void {
  const instrumentation = inject(NG_AGENT_INSTRUMENTATION);
  const id = options.id ?? `form:${name}`;
  const unregister = instrumentation.register({ id, kind: 'form', name, value: control, ...(options.owner ? { owner: options.owner } : {}) });
  const source = control as { valueChanges?: { subscribe(listener: (value: unknown) => void): { unsubscribe(): void } }; statusChanges?: { subscribe(listener: (value: unknown) => void): { unsubscribe(): void } } };
  const valueSubscription = source.valueChanges?.subscribe(value => instrumentation.record({ type: 'form-status-changed', timestamp: Date.now(), source: id, value: { value }, origin: 'angular-forms' }));
  const statusSubscription = source.statusChanges?.subscribe(value => instrumentation.record({ type: 'form-status-changed', timestamp: Date.now(), source: id, value: { status: value }, origin: 'angular-forms' }));
  return () => { valueSubscription?.unsubscribe(); statusSubscription?.unsubscribe(); unregister(); };
}

export function instrumentService(name: string, service: object, options: { id?: string; owner?: object; metadata?: Record<string, unknown> } = {}): () => void {
  const instrumentation = inject(NG_AGENT_INSTRUMENTATION);
  return instrumentation.register({ id: options.id ?? `service:${name}`, kind: 'service', name, value: service, ...(options.owner ? { owner: options.owner } : {}), ...(options.metadata ? { metadata: options.metadata } : {}) });
}

export function instrumentRouter(router: object, options: { id?: string; owner?: object } = {}): () => void {
  const instrumentation = inject(NG_AGENT_INSTRUMENTATION);
  const unregister = instrumentation.register({ id: options.id ?? 'service:Router', kind: 'service', name: 'Router', value: router, ...(options.owner ? { owner: options.owner } : {}), metadata: { token: 'Router' } });
  const subscription = (router as { events?: { subscribe?(listener: (event: unknown) => void): { unsubscribe(): void } } }).events?.subscribe?.(event => {
    const value = event && typeof event === 'object' ? { type: event.constructor?.name ?? 'RouterEvent', ...Object.fromEntries(Object.entries(event).filter(([, item]) => ['string', 'number', 'boolean'].includes(typeof item))) } : { type: 'RouterEvent' };
    instrumentation.record({ type: 'navigation', timestamp: Date.now(), source: 'Router', value, origin: 'router-events' });
  });
  return () => { subscription?.unsubscribe(); unregister(); };
}

export function instrumentStore(name: string, store: object, type: 'ngrx' | 'signal-store', metadata: Record<string, unknown> = {}): () => void {
  const instrumentation = inject(NG_AGENT_INSTRUMENTATION);
  const owner = metadata['owner']; const storedMetadata: Record<string, unknown> = { ...metadata, type }; delete storedMetadata['owner'];
  const unregister = instrumentation.register({ id: `store:${name}`, kind: 'store', name, value: store, ...(owner && typeof owner === 'object' ? { owner } : {}), metadata: storedMetadata });
  const stateReader = metadata['state']; let initialized = false; let previous: unknown;
  const watcher = typeof stateReader === 'function' ? effect(() => {
    const current = (stateReader as () => unknown)();
    if (initialized) instrumentation.record({ type: 'store-changed', timestamp: Date.now(), source: name, value: { previous, current }, origin: `${type}-state` });
    previous = current; initialized = true;
  }) : undefined;
  return () => { watcher?.destroy(); unregister(); };
}

export function instrumentNgrxActions(actions: { subscribe(listener: (action: unknown) => void): { unsubscribe(): void } }): () => void {
  const instrumentation = inject(NG_AGENT_INSTRUMENTATION);
  const subscription = actions.subscribe(action => instrumentation.record({ type: 'ngrx-action', timestamp: Date.now(), source: 'NgRx Actions', value: action, origin: 'ngrx-actions' }));
  return () => subscription.unsubscribe();
}

export function recordNgAgentEvent(event: Omit<InstrumentationEvent, 'timestamp'> & { timestamp?: number }): void {
  activeInstrumentation().record({ ...event, timestamp: event.timestamp ?? Date.now() });
}

export function recordSignalFormSubmission(name: string, value: unknown, origin = 'application'): void {
  const instrumentation = activeInstrumentation();
  if (instrumentation.options.signalForms?.captureSubmissions) instrumentation.record({ type: 'signal-form-submission', timestamp: Date.now(), source: name, value, origin });
}

export function recordSignalFormValidation(name: string, value: unknown, origin = 'application'): void {
  const instrumentation = activeInstrumentation();
  if (instrumentation.options.signalForms?.captureValidationEvents) instrumentation.record({ type: 'signal-form-validation-changed', timestamp: Date.now(), source: name, value, origin });
}

export function measureNgAgent<T>(name: string, kind: 'validation' | 'selector' | 'effect' | 'lifecycle', operation: () => T): T {
  const instrumentation = activeInstrumentation(); const start = performance.now();
  try { return operation(); }
  finally { instrumentation.record({ type: 'profile-entry', timestamp: Date.now(), source: name, value: { name, kind, start, duration: performance.now() - start }, origin: 'application-instrumentation' }); }
}

const activeInstrumentation = (): NgAgentInstrumentation => {
  if (typeof window !== 'undefined' && window.__NG_AGENT_INSTRUMENTATION__) return window.__NG_AGENT_INSTRUMENTATION__;
  try { return inject(NG_AGENT_INSTRUMENTATION); }
  catch { throw new Error('ng-agent instrumentation is unavailable. Install provideNgAgentDevtools() before recording events.'); }
};

declare global { interface Window { __NG_AGENT_INSTRUMENTATION__?: NgAgentInstrumentation } }
