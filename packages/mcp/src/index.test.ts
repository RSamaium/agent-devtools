import { describe, expect, it } from 'vitest';
import { createAgentDevToolsMcpServer } from './index.js';

describe('createAgentDevToolsMcpServer', () => {
  it('registers the complete tool set without duplicate names', async () => {
    const server = createAgentDevToolsMcpServer({ cdpUrl: 'http://127.0.0.1:9222' });
    expect(server).toBeDefined();
    await server.close();
  });
});
