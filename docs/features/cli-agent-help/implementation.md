# Agent-discoverable CLI help: implementation

## Objective and scope

This feature makes the complete CLI surface discoverable without reading source code or opening a browser session. It covers root help, command-group help, exact command help, and a stable JSON catalog suitable for development agents.

## Implementation

`packages/cli/src/help.ts` is the single source of truth for command discovery. It defines the global options, stable exit codes, and every executable leaf command. `packages/cli/src/index.ts` routes `help`, `commands`, `--help`, and `-h` before session loading, then renders either text or JSON from that catalog.

The same change adds `ng-agent install`, a stable wrapper around the exact `playwright-core` version bundled with the CLI. This avoids requiring globally installed users to locate or version the Playwright executable themselves.

Control flow:

1. Parse positional arguments and global flags.
2. Detect a help request before normal command dispatch.
3. Select commands by path prefix.
4. Render contextual text, or serialize the versioned help document.
5. Return exit code 0 without browser access; unknown topics return code 1.

The catalog is deliberately data-driven so human and machine help cannot drift independently. Mutation commands carry an explicit `mutation: true` marker and list their security options.

## Tests and validation

Focused tests cover root help, contextual syntaxes before and after command arguments, the complete JSON schema, group filtering, mutation metadata, exit codes, unknown topics, and safe browser-install arguments. Validation commands:

```bash
pnpm --filter @ng-agent/cli typecheck
pnpm exec vitest run packages/cli/src/index.test.ts
pnpm --filter @ng-agent/cli build
pnpm lint
```

## Limitations

The catalog documents deterministic CLI arguments and options. Dynamic structured query filters are represented by the `--<field> <value>` pattern because their field set depends on the selected runtime domain.
