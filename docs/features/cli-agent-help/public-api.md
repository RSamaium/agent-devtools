# Agent-discoverable CLI help: public API

## Human-readable help

```bash
ng-agent help
ng-agent help router
ng-agent router events --help
ng-agent router events -h
```

Root help lists every executable leaf command. Group help lists all matching commands. Exact help additionally describes arguments, command-specific options, output, examples, and whether the operation is a mutation.

## Machine-readable help

```bash
ng-agent help --json
ng-agent commands --json
ng-agent help signal-form --json
```

Both complete-catalog commands return a `CliHelpDocument`:

```ts
interface CliHelpDocument {
  schemaVersion: '1.0.0';
  name: 'ng-agent';
  description: string;
  protocolVersion: '1.0.0';
  path: string[];
  globalOptions: CliHelpOption[];
  exitCodes: Array<{ code: number; meaning: string }>;
  commands: CliHelpCommand[];
}
```

Each command provides `path`, `usage`, `summary`, optional `arguments` and `options`, executable `examples`, an `output` description, and a `mutation` boolean. Unknown topics emit a structured `CLI_ERROR` on stderr and return exit code 1.

## Browser setup command

```bash
ng-agent install [chromium|firefox|webkit...] [--with-deps]
```

The default browser is Chromium. Unsupported browser names fail before a child process is created. `--with-deps` forwards Playwright's system-dependency installation option and may require elevated operating-system permissions.

## TypeScript exports

`@ng-agent/cli` exports `CLI_COMMANDS`, `CLI_GLOBAL_OPTIONS`, `CLI_EXIT_CODES`, `createHelpDocument`, `resolveContextualHelpPath`, `renderHelp`, and their public TypeScript interfaces. Additive fields may be introduced within schema major 1; incompatible changes require a new help `schemaVersion` major.
