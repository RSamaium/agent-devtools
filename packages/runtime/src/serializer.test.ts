import { describe, expect, it } from 'vitest';
import { serialize } from './serializer.js';

describe('serialize', () => {
  it('redacts paths and breaks cycles', () => {
    const input: Record<string, unknown> = { auth: { token: 'secret' } }; input.self = input;
    const result = serialize(input, { redact: ['auth.token'] });
    expect(result.value).toEqual({ auth: { token: '[REDACTED]' }, self: '[Circular]' });
    expect(result.truncations.map(item => item.reason)).toEqual(['redacted', 'unsupported']);
  });

  it('applies redaction relative to an inspected property path', () => {
    expect(serialize({ password: 'secret' }, { redact: ['account.password'] }, 'account').value)
      .toEqual({ password: '[REDACTED]' });
  });
});
