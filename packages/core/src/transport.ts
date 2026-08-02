import type { CommandMap, CommandName, RpcFailure, RpcRequest, RpcResponse } from '@ng-agent/protocol';

export interface Transport {
  request<C extends CommandName>(request: RpcRequest<C>, timeoutMs: number): Promise<RpcResponse<CommandMap[C]['result']>>;
  subscribe?(listener: (event: unknown) => void): () => void;
  close(): Promise<void>;
}

export class ProtocolRequestError extends Error {
  constructor(readonly rpcError: RpcFailure['error']) {
    super(rpcError.message);
    this.name = 'ProtocolRequestError';
  }
}

export class FunctionTransport implements Transport {
  constructor(private readonly handler: (request: RpcRequest) => Promise<RpcResponse>) {}
  async request<C extends CommandName>(request: RpcRequest<C>): Promise<RpcResponse<CommandMap[C]['result']>> {
    return this.handler(request) as Promise<RpcResponse<CommandMap[C]['result']>>;
  }
  async close(): Promise<void> {}
}
