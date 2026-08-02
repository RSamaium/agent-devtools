import { describe, expect, it } from 'vitest';
import { CLI_COMMANDS, createHelpDocument, playwrightInstallArguments, runCli } from './index.js';

const io = () => {
  let stdout = ''; let stderr = '';
  return { streams: { stdout: { isTTY: false, write: (value: string) => { stdout += value; return true; } }, stderr: { write: (value: string) => { stderr += value; return true; } } }, output: () => ({ stdout, stderr }) };
};

describe('CLI contract', () => {
  it('prints help successfully', async () => {
    const target = io();
    expect(await runCli(['help'], target.streams)).toBe(0);
    expect(target.output().stdout).toContain('components tree');
    expect(target.output().stdout).toContain('Machine-readable catalog');
    for (const command of CLI_COMMANDS) expect(target.output().stdout).toContain(command.usage.slice('ng-agent '.length));
  });

  it('prints contextual help through both supported syntaxes', async () => {
    const explicit = io();
    const contextual = io();
    const afterArgument = io();
    expect(await runCli(['help', 'component', 'inspect'], explicit.streams)).toBe(0);
    expect(await runCli(['component', 'inspect', '--help'], contextual.streams)).toBe(0);
    expect(await runCli(['component', 'inspect', 'CheckoutComponent', '--help'], afterArgument.streams)).toBe(0);
    expect(explicit.output().stdout).toContain('ng-agent component inspect <name-or-ref>');
    expect(contextual.output().stdout).toBe(explicit.output().stdout);
    expect(afterArgument.output().stdout).toBe(explicit.output().stdout);
    expect(contextual.output().stderr).toBe('');
  });

  it('exposes the complete versioned command catalog as JSON', async () => {
    const target = io();
    expect(await runCli(['commands', '--json'], target.streams)).toBe(0);
    const document = JSON.parse(target.output().stdout) as ReturnType<typeof createHelpDocument>;
    expect(document).toMatchObject({ schemaVersion: '1.0.0', name: 'ng-agent', protocolVersion: '1.0.0', path: [] });
    expect(document.commands).toHaveLength(CLI_COMMANDS.length);
    expect(new Set(document.commands.map(item => item.path.join(' '))).size).toBe(document.commands.length);
    expect(document.commands.every(item => item.examples.length > 0 && item.output.length > 0)).toBe(true);
    expect(document.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ['snapshot'], mutation: false }),
      expect.objectContaining({ path: ['signal', 'set'], mutation: true }),
      expect.objectContaining({ path: ['ngrx', 'dispatch'], mutation: true }),
    ]));
    expect(document.exitCodes.map(item => item.code)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('filters JSON help by command group', async () => {
    const target = io();
    expect(await runCli(['help', 'router', '--json'], target.streams)).toBe(0);
    const document = JSON.parse(target.output().stdout) as ReturnType<typeof createHelpDocument>;
    expect(document.path).toEqual(['router']);
    expect(document.commands.map(item => item.path.join(' '))).toEqual(['router tree', 'router active', 'router events', 'router navigate']);
  });

  it('rejects an unknown help topic without opening a session', async () => {
    const target = io();
    expect(await runCli(['help', 'does-not-exist'], target.streams)).toBe(1);
    expect(JSON.parse(target.output().stderr)).toMatchObject({ error: { code: 'CLI_ERROR', message: 'Unknown help topic: does-not-exist' } });
  });

  it('builds safe Playwright installation arguments', () => {
    expect(playwrightInstallArguments([], false)).toEqual(['install', 'chromium']);
    expect(playwrightInstallArguments(['firefox', 'webkit'], true)).toEqual(['install', '--with-deps', 'firefox', 'webkit']);
    expect(() => playwrightInstallArguments(['chrome'], false)).toThrow('Unsupported browser: chrome');
  });

  it('returns the usage failure code on an unknown command', async () => {
    const target = io();
    expect(await runCli(['unknown'], target.streams)).toBe(1);
    expect(JSON.parse(target.output().stderr)).toMatchObject({ error: { code: 'CLI_ERROR' } });
  });
});
