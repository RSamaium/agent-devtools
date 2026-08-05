# Agent DevTools architecture

Agent DevTools lets an AI agent observe, understand and explain an application runtime through ADP. Angular is the reference adapter; generic packages never import Angular or NgRx.

```text
Application runtime
        ↓
Adapter (`@agent-devtools/angular` or `@agent-devtools/pixi`)
        ↓
ADP runtime host (`window.__AGENT_DEVTOOLS__`)
        ↓
Browser transport
        ↓
Core SDK / CLI / MCP
```

## Package boundaries

- `protocol` defines serializable messages, standard domains and runtime schemas.
- `core` is a transport-independent ADP client with generic query and diff helpers.
- `runtime` owns adapter lifecycle, references, snapshots, events and serialization.
- `browser` injects the generic runtime and caller-supplied adapter bundles.
- `angular` aggregates private domain modules and provides the Angular browser composition.
- `pixi` captures scene graph, renderer and managed texture metadata without importing PixiJS at runtime.
- `cli` and `mcp` expose generic ADP operations plus Angular and PixiJS contributions.

The runtime never calls Angular debug APIs itself. An adapter captures one or more domains and may implement commands or explanations for domains it owns.

## Data flow

The client sends JSON-RPC 2.0 requests to the page bridge. A snapshot allocates a new reference generation, discovers active adapters, captures their domains and merges warnings and truncation reports. Queries address a domain and optional resource. Events carry both a domain and a type. Explain is routed to the adapter owning the subject domain.

## V1 boundary

The implementation is Web-first through Playwright and Chromium CDP. The wire contracts remain transport-independent. V1 contains no causal dependency graph, diagnostics, replay, application interaction or mutation surface.
