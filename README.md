# Agent DevTools

Agent DevTools is a platform that lets an AI agent observe, understand and explain an application runtime through the open Agent DevTools Protocol (ADP).

```text
Application -> Adapter -> ADP -> Agent DevTools -> CLI / MCP / SDK / IDE
```

This repository is under local development. The `@agent-devtools/*` package names describe the target workspace architecture; no npm publication is part of the current milestone.

## V1 development scope

- Generic protocol, client, runtime, browser transport, CLI, MCP and testing packages.
- Web runtimes through Playwright or Chromium CDP.
- Angular 20–22 reference adapter with components, directives, Router, DI, Signals, classic Forms, Signal Forms, NgRx and profiling.
- PixiJS 8 adapter with scene graph, renderer and managed GPU texture metadata.
- Read-only snapshots, queries, event streams, deterministic diffs and evidence-based explanations.

Graph, diagnostics, replay, application interaction, mutation and dynamic third-party plugin installation are deferred to V2.

## Local quick start

```bash
pnpm install
pnpm build
pnpm --filter @agent-devtools/browser exec playwright-core install chromium
pnpm --filter basic-app start
```

In another terminal:

```bash
pnpm --filter @agent-devtools/cli exec agent-devtools open http://localhost:4200
pnpm --filter @agent-devtools/cli exec agent-devtools status --json
pnpm --filter @agent-devtools/cli exec agent-devtools snapshot --json
pnpm --filter @agent-devtools/cli exec agent-devtools query components --resource components name=App --json
pnpm --filter @agent-devtools/cli exec agent-devtools close
```

The Angular-oriented commands are adapter contributions:

```bash
pnpm --filter @agent-devtools/cli exec agent-devtools components tree --json
pnpm --filter @agent-devtools/cli exec agent-devtools router active --json
pnpm --filter @agent-devtools/cli exec agent-devtools di tree --json
pnpm --filter @agent-devtools/cli exec agent-devtools signals list --json
pnpm --filter @agent-devtools/cli exec agent-devtools signal-forms list --json
```

PixiJS applications registered with `@pixi/devtools` expose dedicated read-only commands:

```bash
pnpm --filter @agent-devtools/cli exec agent-devtools scene tree --json
pnpm --filter @agent-devtools/cli exec agent-devtools rendering info --json
pnpm --filter @agent-devtools/cli exec agent-devtools assets textures --json
```

## Angular instrumentation

Runtime discovery needs no application change. Optional instrumentation provides stable identities, histories, correlations and redaction:

```ts
import { provideAgentDevtools } from '@agent-devtools/angular';

bootstrapApplication(AppComponent, {
  providers: [
    provideAgentDevtools({
      redact: ['auth.token', 'user.password'],
      historyLimit: 100,
      signalForms: {
        captureSchemas: true,
        captureValidationEvents: true,
        captureSubmissions: true,
      },
    }),
  ],
});
```

## SDK

Use the Angular composition for the reference adapter:

```ts
import { connectAngularBrowser } from '@agent-devtools/angular/browser';

const client = await connectAngularBrowser({
  url: 'http://localhost:4200',
  browserName: 'chromium',
  headless: true,
});

try {
  const status = await client.status();
  const snapshot = await client.snapshot();
  const components = await client.query({
    domain: 'components',
    resource: 'components',
  });
  console.log({ status, snapshot, components });
} finally {
  await client.close();
}
```

`@agent-devtools/browser` remains adapter-neutral and accepts adapter bundles through `adapterScripts`.

PixiJS-only consumers can use `connectPixiBrowser()` from `@agent-devtools/pixi/browser`. CLI and MCP load the Angular and PixiJS bundles together and activate only the adapters detected on the page.

## Packages

| Package | Responsibility |
|---|---|
| `@agent-devtools/protocol` | ADP types, schemas and version policy |
| `@agent-devtools/core` | Generic client, transport, query and diff helpers |
| `@agent-devtools/runtime` | Adapter host, sessions, snapshots, events and serialization |
| `@agent-devtools/browser` | Generic Playwright/CDP transport |
| `@agent-devtools/angular` | Angular adapter, browser composition and instrumentation |
| `@agent-devtools/pixi` | PixiJS scene graph, rendering and texture adapter |
| `@agent-devtools/cli` | Generic commands plus Angular and PixiJS contributions |
| `@agent-devtools/mcp` | `adp_*`, Angular and PixiJS tools |
| `@agent-devtools/testing` | Generic fixtures and adapter test harnesses |

The packages under `packages/adapters/` are private implementation modules aggregated by `@agent-devtools/angular`.

## Safety

- V1 is read-only and development-oriented.
- Serialization enforces depth, collection, string, property and total-byte budgets.
- Configured paths are redacted before values enter snapshots or event history.
- Inspection does not invoke provider factories, getters or store methods.
- Runtime references are scoped to a snapshot generation.
- CDP endpoints should remain bound to loopback interfaces.

## Documentation

- [Architecture](docs/architecture/overview.md)
- [ADP v1](docs/protocol/adp-v1.md)
- [Angular adapter](docs/adapters/angular.md)
- [PixiJS adapter](docs/adapters/pixi.md)
- [RFC index](docs/rfc/README.md)
- [Implementation notes](docs/features/agent-devtools-platform/implementation.md)
- [Public API and migration](docs/features/agent-devtools-platform/public-api.md)
- [Security policy](SECURITY.md)

## Validation

```bash
pnpm check
pnpm test:browsers
```

## License

MIT
