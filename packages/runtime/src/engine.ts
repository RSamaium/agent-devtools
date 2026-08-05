import type {
  CommandMap, CommandName, Explanation, ProtocolError, RpcRequest, RpcResponse,
  RuntimeEvent, RuntimeRef, RuntimeWarning, Snapshot, SnapshotOptions,
} from '@agent-devtools/protocol';
import { domainIdSchema, PROTOCOL_VERSION } from '@agent-devtools/protocol';
import type { RuntimeAdapter, RuntimeContext } from './adapter.js';
import { querySnapshot } from './query.js';
import { ReferenceRegistry } from './refs.js';

export interface RuntimeEngineOptions {
  adapters?: RuntimeAdapter[];
  eventHistoryLimit?: number;
}

export class RuntimeEngine {
  private generation = 0;
  private latest?: Snapshot;
  private latestRefs?: ReferenceRegistry;
  private readonly events: RuntimeEvent[] = [];
  private sequence = 0;
  private readonly adapters: RuntimeAdapter[];

  constructor(private readonly window: Window, private readonly options: RuntimeEngineOptions = {}) {
    this.adapters = [];
    for (const adapter of options.adapters ?? []) this.registerAdapter(adapter);
  }

  async handle(request: RpcRequest): Promise<RpcResponse> {
    try {
      if (request.protocolVersion.split('.')[0] !== PROTOCOL_VERSION.split('.')[0]) throw protocolError('UNSUPPORTED', `Protocol ${request.protocolVersion} is incompatible with runtime ${PROTOCOL_VERSION}`);
      const result = await this.dispatch(request.method, request.params as never);
      return { jsonrpc: '2.0', id: request.id, result };
    } catch (error) {
      const failure: ProtocolError = isProtocolError(error) ? error : {
        code: error instanceof Error && error.message === 'STALE_REFERENCE' ? 'STALE_REFERENCE' : 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : String(error), retryable: false,
      };
      return { jsonrpc: '2.0', id: request.id, error: failure };
    }
  }

  private async dispatch<C extends CommandName>(method: C, params: CommandMap[C]['params']): Promise<CommandMap[C]['result']> {
    switch (method) {
      case 'status': return this.status() as CommandMap[C]['result'];
      case 'snapshot': return await this.snapshot(params as SnapshotOptions) as CommandMap[C]['result'];
      case 'query': {
        const query = params as CommandMap['query']['params'];
        const snapshot = await this.ensureSnapshot();
        if (query.generation !== undefined && query.generation !== snapshot.generation) throw protocolError('STALE_REFERENCE', `Query generation ${query.generation} is stale; current generation is ${snapshot.generation}`);
        return querySnapshot(snapshot, query) as CommandMap[C]['result'];
      }
      case 'events': {
        const options = params as CommandMap['events']['params'];
        return this.events.filter(event => event.sequence > (options.after ?? 0)).slice(0, options.limit ?? 100) as CommandMap[C]['result'];
      }
      case 'explain': {
        const options = params as CommandMap['explain']['params'];
        return await this.explain(options.subject, options.question) as CommandMap[C]['result'];
      }
      case 'execute': {
        const options = params as CommandMap['execute']['params'];
        return await this.execute(options.domain, options.command, options.params) as CommandMap[C]['result'];
      }
    }
  }

  private status(): CommandMap['status']['result'] {
    const context = this.contextFor(new ReferenceRegistry(this.generation), {}, []);
    const adapters = this.adapters.filter(adapter => adapter.isAvailable(context)).map(adapter => adapter.descriptor);
    const domains = adapters.flatMap(adapter => adapter.domains).filter((domain, index, all) => all.findIndex(candidate => candidate.id === domain.id) === index);
    return { connected: true, protocolVersion: PROTOCOL_VERSION, adapters, domains, capabilities: [...new Set(adapters.flatMap(adapter => adapter.capabilities))] };
  }

  private async snapshot(options: SnapshotOptions = {}): Promise<Snapshot> {
    const refs = new ReferenceRegistry(++this.generation);
    const warnings: RuntimeWarning[] = [];
    const context = this.contextFor(refs, options, warnings);
    const available = this.adapters.filter(adapter => adapter.isAvailable(context));
    const snapshot: Snapshot = {
      id: crypto.randomUUID(), ...(options.name ? { name: options.name } : {}), generation: refs.generation,
      runtime: { environment: 'web', url: this.window.location.href, title: this.window.document.title, userAgent: this.window.navigator.userAgent, capturedAt: Date.now() },
      adapters: available.map(adapter => adapter.descriptor), domains: {}, warnings, truncations: [],
    };
    if (!available.length) warnings.push({ code: 'ADAPTER_NOT_FOUND', message: 'No runtime adapter is available for this page.' });
    for (const adapter of available) {
      const capture = await adapter.capture(context);
      for (const [id, domain] of Object.entries(capture.domains)) {
        if (snapshot.domains[id]) warnings.push({ code: 'DOMAIN_COLLISION', message: `Domain ${id} was already captured; ${adapter.descriptor.id} replaced it.`, domain: id });
        snapshot.domains[id] = domain;
      }
      snapshot.warnings.push(...(capture.warnings ?? []));
      snapshot.truncations.push(...(capture.truncations ?? []));
    }
    this.latest = snapshot;
    this.latestRefs = refs;
    return snapshot;
  }

  private async ensureSnapshot(): Promise<Snapshot> { return this.latest ?? this.snapshot(); }

  private async explain(subject: RuntimeRef | string, question?: string): Promise<Explanation> {
    const snapshot = await this.ensureSnapshot();
    if (typeof subject !== 'string' && subject.generation !== snapshot.generation) throw protocolError('STALE_REFERENCE', `Reference ${subject.id} belongs to generation ${subject.generation}; current generation is ${snapshot.generation}`);
    const context = this.contextFor(this.latestRefs ?? new ReferenceRegistry(snapshot.generation), {}, snapshot.warnings);
    const candidates = this.adapters.filter(adapter => adapter.isAvailable(context) && adapter.explain && (typeof subject === 'string' || adapter.descriptor.domains.some(domain => domain.id === subject.domain)));
    for (const adapter of candidates) return await adapter.explain!(subject, question, context);
    return { subject, summary: typeof subject === 'string' ? subject : `${subject.kind} ${subject.id}`, facts: [], evidence: [], limitations: ['No active adapter can explain this subject.'] };
  }

  private async execute(domain: string, command: string, params?: import('@agent-devtools/protocol').SerializedValue) {
    const snapshot = await this.ensureSnapshot();
    const context = this.contextFor(this.latestRefs ?? new ReferenceRegistry(snapshot.generation), {}, snapshot.warnings);
    const adapter = this.adapters.find(candidate => candidate.isAvailable(context) && candidate.execute && candidate.descriptor.domains.some(item => item.id === domain));
    if (!adapter?.execute) throw protocolError('UNSUPPORTED', `No active adapter implements ${domain}.${command}`);
    return adapter.execute(domain, command, params, context);
  }

  private contextFor(refs: ReferenceRegistry, options: SnapshotOptions, warnings: RuntimeWarning[]): RuntimeContext {
    return {
      window: this.window, document: this.window.document, refs, options,
      warn: (code, message, domain) => warnings.push({ code, message, ...(domain ? { domain } : {}) }),
      emit: event => this.emit(event),
    };
  }

  private emit(event: Omit<RuntimeEvent, 'id' | 'sequence'>): void {
    this.events.push({ ...event, id: crypto.randomUUID(), sequence: ++this.sequence });
    this.events.splice(0, Math.max(0, this.events.length - (this.options.eventHistoryLimit ?? 100)));
  }

  registerAdapter(adapter: RuntimeAdapter): void {
    if (this.adapters.some(existing => existing.descriptor.id === adapter.descriptor.id)) throw new Error(`Runtime adapter already registered: ${adapter.descriptor.id}`);
    const acceptedMajor = /\d+/.exec(adapter.descriptor.protocolRange)?.[0];
    if (acceptedMajor !== PROTOCOL_VERSION.split('.')[0]) throw new Error(`Adapter ${adapter.descriptor.id} does not support ADP ${PROTOCOL_VERSION}`);
    for (const domain of adapter.descriptor.domains) domainIdSchema.parse(domain.id);
    this.adapters.push(adapter);
  }

  unregisterAdapter(id: string): void {
    const index = this.adapters.findIndex(adapter => adapter.descriptor.id === id);
    if (index < 0) return;
    const [adapter] = this.adapters.splice(index, 1);
    void adapter?.dispose?.();
  }

  async dispose(): Promise<void> { for (const adapter of this.adapters) await adapter.dispose?.(); }
}

const protocolError = (code: ProtocolError['code'], message: string): ProtocolError => ({ code, message, retryable: false });
const isProtocolError = (value: unknown): value is ProtocolError => !!value && typeof value === 'object' && 'code' in value && 'retryable' in value;

export interface RuntimeBridge {
  protocolVersion: string;
  request(request: RpcRequest): Promise<RpcResponse>;
  registerAdapter(adapter: RuntimeAdapter): void;
  unregisterAdapter(id: string): void;
  dispose(): Promise<void>;
}

export function installRuntimeBridge(window: Window, options: RuntimeEngineOptions = {}): RuntimeBridge {
  const engine = new RuntimeEngine(window, options);
  const bridge: RuntimeBridge = {
    protocolVersion: PROTOCOL_VERSION,
    request: request => engine.handle(request),
    registerAdapter: adapter => engine.registerAdapter(adapter),
    unregisterAdapter: id => engine.unregisterAdapter(id),
    dispose: () => engine.dispose(),
  };
  Object.defineProperty(window, '__AGENT_DEVTOOLS__', { value: bridge, configurable: true });
  return bridge;
}
