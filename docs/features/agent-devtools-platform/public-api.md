# Agent DevTools Platform public API

## Migration

This is an intentional pre-publication break. Workspace imports move from `@ng-agent/*` to `@agent-devtools/*`, `NgAgentClient` becomes `AgentDevToolsClient`, the page bridge becomes `window.__AGENT_DEVTOOLS__`, and the CLI becomes `agent-devtools`. There are no compatibility aliases.

Angular consumers replace `provideNgAgentDevtools()` with `provideAgentDevtools()` and use `connectAngularBrowser()` when they want the reference adapter loaded automatically.

## Protocol types

`AdapterDescriptor` declares adapter identity, protocol range, domains and capabilities. `DomainDescriptor` declares a standard or namespaced domain and its read-only commands. `Snapshot.domains` stores `DomainSnapshot` envelopes. `RuntimeRef` requires `id`, `domain`, `kind` and `generation`.

The V1 `CommandMap` exposes `status`, `snapshot`, `query`, `events`, `explain` and `execute`. Errors are structured and stale generations use `STALE_REFERENCE`.

## SDK

```ts
import { connectAngularBrowser } from '@agent-devtools/angular/browser';
import type { RuntimeRef } from '@agent-devtools/protocol';

const client = await connectAngularBrowser({ url: 'http://localhost:4200' });
const status = await client.status();
const snapshot = await client.snapshot();
const components = await client.query({
  domain: 'components',
  resource: 'components',
  where: { name: 'CheckoutComponent' },
});
const component = components.items[0] as { ref: RuntimeRef };
const explanation = await client.explain(component.ref);
await client.close();
```

Generic browser consumers use `connectBrowser({ adapterScripts })`. Adapter authors implement `RuntimeAdapter` from `@agent-devtools/runtime`; custom domain IDs must be namespaced.

## CLI and MCP

The CLI provides generic `status`, `snapshot`, `query`, `watch`, `diff` and `explain` commands alongside Angular contributions. Generic query syntax is:

```bash
agent-devtools query <domain> --resource <resource> field=value --json
```

MCP provides `adp_status`, `adp_snapshot`, `adp_query`, `adp_events`, `adp_diff` and `adp_explain`, plus read-only `angular_*` tools.

## Security and side effects

V1 contains no mutation, replay or application-interaction API. Snapshot and query operations observe runtime state; profiling starts or stops a measurement window but does not mutate application state. Serialization budgets and redaction apply before values leave the page runtime.
