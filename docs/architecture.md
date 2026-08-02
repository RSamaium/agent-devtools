# Architecture

Requests flow from the SDK, CLI, or MCP server through a browser transport to `window.__NG_AGENT__` in the page's main world. The runtime runs adapters against Angular debug APIs and the optional application instrumentation registry. Every result uses `@ng-agent/protocol` contracts.

Package boundaries are deliberate:

- `protocol` has no Angular or browser dependency.
- `core` depends only on `protocol`.
- Angular implementation details are contained inside runtime adapters.
- Browser, CLI, and MCP consume only the bridge protocol.
- NgRx peer dependencies remain optional.

References are valid only for their snapshot generation. Adapters must avoid side effects: do not instantiate providers, invoke factories, call store methods, or mutate Signals while capturing.

Replay is a dry-run by default. With explicit local `apply`, normalized user interactions can be replayed and a plugin adapter may opt into a specific event through its `replay` hook; the core never restores arbitrary application state by assignment.

The V2 graph attaches confidence to every edge. `observed` means the runtime saw a relationship, `instrumented` means application hooks recorded it, and `inferred` means the relationship was derived from evidence.
