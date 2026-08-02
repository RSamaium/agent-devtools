import type {
  CommandMap, CommandName, Diagnostic, Explanation, MutationRequest, QueryResult,
  RuntimeEvent, RuntimeRef, SessionExport, Snapshot, SnapshotOptions, StructuredQuery,
} from '@ng-agent/protocol';
import { PROTOCOL_VERSION } from '@ng-agent/protocol';
import type { Transport } from './transport.js';
import { ProtocolRequestError } from './transport.js';

export interface ClientOptions { timeoutMs?: number; allowMutations?: boolean }

export class NgAgentClient {
  readonly timeoutMs: number;
  readonly sessionId = crypto.randomUUID();
  constructor(private readonly transport: Transport, options: ClientOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.allowMutations = options.allowMutations ?? false;
  }
  private readonly allowMutations: boolean;

  private async call<C extends CommandName>(method: C, params: CommandMap[C]['params']): Promise<CommandMap[C]['result']> {
    const request = { jsonrpc: '2.0' as const, id: crypto.randomUUID(), protocolVersion: PROTOCOL_VERSION, sessionId: this.sessionId, timestamp: Date.now(), method, params };
    const response = await this.transport.request(request, this.timeoutMs);
    if ('error' in response) throw new ProtocolRequestError(response.error);
    return response.result;
  }

  status() { return this.call('status', {}); }
  snapshot(options: SnapshotOptions = {}): Promise<Snapshot> { return this.call('snapshot', options); }
  query(query: StructuredQuery): Promise<QueryResult> { return this.call('query', query); }
  explain(subject: Parameters<typeof this.call<'explain'>>[1]['subject'], question?: string): Promise<Explanation> {
    return this.call('explain', question === undefined ? { subject } : { subject, question });
  }
  graph(scope?: string) { return this.call('graph', scope === undefined ? {} : { scope }); }
  diagnostics(scope?: string): Promise<Diagnostic[]> { return this.call('diagnostics', scope === undefined ? {} : { scope }); }
  resolveProvider(token: string, from: RuntimeRef) { return this.call('diResolve', { token, from }); }
  events(after?: number, limit?: number): Promise<RuntimeEvent[]> {
    return this.call('events', { ...(after === undefined ? {} : { after }), ...(limit === undefined ? {} : { limit }) });
  }
  profileStart(budgetMs?: number) { return this.call('profileStart', budgetMs === undefined ? {} : { budgetMs }); }
  profileStop() { return this.call('profileStop', {}); }
  traceStart() { return this.call('traceStart', {}); }
  traceStop() { return this.call('traceStop', {}); }
  exportSession() { return this.call('sessionExport', {}); }
  importSession(session: SessionExport) { return this.call('sessionImport', { session }); }
  replay(events: RuntimeEvent[], apply = false) { return this.call('replay', { events, apply }); }
  click(target: RuntimeRef | string) { return this.call('interact', { action: 'click', target }); }
  mutate(request: MutationRequest) {
    if (!this.allowMutations) throw new ProtocolRequestError({ code: 'MUTATION_DENIED', message: 'Runtime mutations are disabled on this client', retryable: false });
    return this.call('mutate', request);
  }
  close() { return this.transport.close(); }
}

export interface ConnectOptions extends ClientOptions { transport: Transport }
export async function connect(options: ConnectOptions): Promise<NgAgentClient> {
  const client = new NgAgentClient(options.transport, options);
  await client.status();
  return client;
}
