# ng-agent

Angular runtime inspection built for development agents.

`ng-agent` gives an agent structured, correlated access to Angular components, directives, Router state, dependency injection, Signals, classic Forms, Signal Forms, NgRx, profiling, diagnostics, and causal traces. It exposes the same versioned model through a CLI, TypeScript SDK, and MCP server.

> Development builds only. Runtime mutations are disabled by default.

## Installation

### Global installation (recommended)

```bash
npm install -g @ng-agent/cli
ng-agent install chromium
```

Install every supported browser when cross-browser inspection is required:

```bash
ng-agent install chromium firefox webkit
```

On Linux, `--with-deps` also asks Playwright to install browser system dependencies:

```bash
ng-agent install chromium --with-deps
```

Requirements: Node.js 20.19 or later and an Angular 20–22 development build. Signal Forms require Angular 21 or later.

### Project-local installation

Pin the CLI in a project when reproducible CI versions matter:

```bash
npm install --save-dev @ng-agent/cli
npx ng-agent install chromium
```

## Quick start

Start your Angular application normally:

```bash
ng serve
```

Open it in a managed headless browser and inspect the runtime:

```bash
ng-agent open http://localhost:4200
ng-agent status
ng-agent snapshot --scope current-route --json
ng-agent query fields invalid=true --json
```

Runtime references from snapshots can be reused by later commands:

```bash
ng-agent component inspect cmp-12 --json
ng-agent signal-form field sf-3:user.email --json
ng-agent explain field field-8 --json
```

Close the browser session when finished:

```bash
ng-agent close
```

To attach to an existing Chromium instance instead:

```bash
chromium --remote-debugging-port=9222
ng-agent connect --cdp http://localhost:9222
```

## Discover commands

The help is complete and can be explored without starting a browser:

```bash
ng-agent help
ng-agent help router
ng-agent component inspect --help
```

Agents can retrieve the full versioned command catalog as JSON. It includes arguments, options, output descriptions, examples, mutation markers, and exit codes:

```bash
ng-agent commands --json
ng-agent help signal-form --json
```

Machine-readable command output uses `--json`; event streams use `--jsonl`. Diagnostics go to stderr, so stdout remains safe to parse.

## Use with AI agents

### Just ask the agent

The CLI is self-describing. A coding agent can start with:

> Use ng-agent to inspect the Angular application at http://localhost:4200. Run `ng-agent --help` to discover commands, use JSON output, and close the session when finished.

### Install the agent skill

Install the repository skill for richer Angular-specific inspection guidance:

```bash
npx skills add RSamaium/ng-agent --skill inspecting-angular-apps
```

The skill can be used by Codex, Claude Code, Cursor, Gemini CLI, GitHub Copilot, OpenCode, Windsurf, and other clients supported by the `skills` CLI. It teaches the agent to prefer runtime evidence, handle stale references, distinguish observed/instrumented/inferred relations, and keep mutations disabled unless explicitly requested.

Do not copy `SKILL.md` manually: installing it from the repository makes updates easier to track.

For persistent project instructions, add this to `AGENTS.md` or the equivalent file used by your agent:

```md
## Angular runtime inspection

Use `ng-agent` when runtime evidence is needed.
Run `ng-agent help --json` to discover the complete command contract.
Prefer `--json` for reads and `--jsonl` for event streams.
Treat partial discovery and inferred relations as non-exhaustive.
Close browser sessions created by the agent with `ng-agent close`.
```

## MCP server

Install or run the MCP server directly from npm:

```bash
npm install -g @ng-agent/mcp
ng-agent-mcp
```

Example MCP client configuration:

```json
{
  "mcpServers": {
    "ng-agent": {
      "command": "npx",
      "args": ["-y", "@ng-agent/mcp"]
    }
  }
}
```

The server exposes paginated `angular_*` tools for status, snapshots, components, Router, DI, Signals, Forms, Signal Forms, NgRx, profiling, queries, diffs, explanations, graphs, diagnostics, traces, sessions, replay, and controlled mutations.

## Optional Angular instrumentation

Discovery mode requires no application changes. Add the provider when stable names, history, richer correlations, Signal/Form events, redaction, or plugins are needed:

```ts
import { provideNgAgentDevtools } from '@ng-agent/angular';

bootstrapApplication(AppComponent, {
  providers: [
    provideNgAgentDevtools({
      redact: [
        'auth.token',
        'user.password',
        'payment.cardNumber',
        'headers.authorization',
      ],
      historyLimit: 100,
      allowRuntimeMutations: false,
      signalForms: {
        captureSchemas: true,
        captureValidationEvents: true,
        captureSubmissions: true,
      },
    }),
  ],
});
```

Register application-owned Signals, Signal Forms, Router instances, services, and stores with the helpers exported by `@ng-agent/angular` when stable identity and event history are required.

## Common workflows

### Inspect Angular structure

```bash
ng-agent components tree --json
ng-agent router active --json
ng-agent di tree --json
ng-agent signals list --json
```

### Diagnose forms and state

```bash
ng-agent forms list --json
ng-agent signal-forms list --json
ng-agent signal-form errors sf-3 --json
ng-agent ngrx actions --last 20 --json
ng-agent diagnostics --json
```

### Profile and trace

```bash
ng-agent profile start
# interact with the application
ng-agent profile stop --output profile.json

ng-agent trace start
ng-agent click @e42
ng-agent trace stop --json
```

### Watch runtime events

```bash
ng-agent watch --jsonl
```

## TypeScript SDK

```bash
npm install @ng-agent/core @ng-agent/browser
```

```ts
import { connectBrowser } from '@ng-agent/browser';

const client = await connectBrowser({
  url: 'http://localhost:4200',
  browserName: 'chromium',
  headless: true,
});

try {
  const snapshot = await client.snapshot({ scope: 'current-route' });
  const invalidFields = await client.query({
    domain: 'fields',
    where: { invalid: true },
  });
  console.log({ snapshot, invalidFields });
} finally {
  await client.close();
}
```

## Safety

- Reads are the default and never enable runtime mutations.
- Values are serialized with depth, array, string, and total-volume budgets.
- Redaction is applied before values enter snapshots and event history.
- Provider factories and SignalStore methods are never invoked for inspection.
- References include a generation; stale references return a structured error.
- Mutations require a development build, local origin, application opt-in, explicit allowlist, CLI opt-in, and a capability token.

## Packages

| Package | Purpose |
|---|---|
| `@ng-agent/protocol` | Serializable contracts and runtime schemas |
| `@ng-agent/core` | Client, query, snapshot diff, and transport API |
| `@ng-agent/runtime` | Main-world runtime bridge and safe serializer |
| `@ng-agent/angular` | Optional provider and application instrumentation |
| `@ng-agent/browser` | Playwright and CDP transport |
| `@ng-agent/cli` | Global `ng-agent` executable and session management |
| `@ng-agent/mcp` | MCP server exposing `angular_*` tools |
| `@ng-agent/testing` | Fixtures, harnesses, and reference assertions |
| `@ng-agent/adapter-*` | Optional Angular and NgRx runtime domains |
| `@ng-agent/plugin-api` | Versioned plugin definition API |

## Development

```bash
git clone https://github.com/RSamaium/ng-agent.git
cd ng-agent
pnpm install
pnpm check
```

Run the included instrumented application and browser smoke tests:

```bash
pnpm --filter @ng-agent/browser exec playwright-core install chromium firefox webkit
pnpm --filter basic-app start
# in another terminal
pnpm test:browsers
```

See the [architecture](docs/architecture.md), [CLI contract](docs/cli.md), [protocol policy](docs/protocol.md), [compatibility matrix](docs/compatibility.md), and [security policy](SECURITY.md).

## License

MIT
