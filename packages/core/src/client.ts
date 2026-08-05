import type { CommandMap, CommandName, Explanation, QueryResult, RuntimeEvent, SerializedValue, Snapshot, SnapshotOptions, StructuredQuery } from '@agent-devtools/protocol';
import { PROTOCOL_VERSION } from '@agent-devtools/protocol';
import type { Transport } from './transport.js';
import { ProtocolRequestError } from './transport.js';

export interface ClientOptions { timeoutMs?: number }

export class AgentDevToolsClient {
  readonly timeoutMs: number;
  readonly sessionId = crypto.randomUUID();
  constructor(private readonly transport: Transport, options: ClientOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

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
  events(after?: number, limit?: number): Promise<RuntimeEvent[]> {
    return this.call('events', { ...(after === undefined ? {} : { after }), ...(limit === undefined ? {} : { limit }) });
  }
  execute(domain: string, command: string, params?: SerializedValue) { return this.call('execute', { domain, command, ...(params === undefined ? {} : { params }) }); }
  close() { return this.transport.close(); }
}

export interface ConnectOptions extends ClientOptions { transport: Transport }
export async function connect(options: ConnectOptions): Promise<AgentDevToolsClient> {
  const client = new AgentDevToolsClient(options.transport, options);
  await client.status();
  return client;
}
