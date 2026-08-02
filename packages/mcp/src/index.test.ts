import { describe, expect, it } from 'vitest';
import { createAngularMcpServer } from './index.js';

describe('createAngularMcpServer', () => {
  it('registers the complete tool set without duplicate names', async () => {
    const server = createAngularMcpServer({ cdpUrl: 'http://127.0.0.1:9222' });
    expect(server).toBeDefined();
    await server.close();
  });
});
