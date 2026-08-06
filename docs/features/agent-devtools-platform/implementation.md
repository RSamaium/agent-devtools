# Agent DevTools Platform implementation

## Objective and scope

This change turns the Angular-specific V0 into an ADP V1 development workspace. It introduces generic domain snapshots and adapter negotiation, extracts Angular from the runtime and browser packages, and keeps Angular inspection parity for components, Router, DI, Signals, Forms, Signal Forms, NgRx and profiling.

No package was published and no remote repository, release or tag was changed. Graph, diagnostics, replay, interaction and mutation were removed from V1.

## Main implementation

- `@adp-devtools/protocol` now owns generic adapter, domain, snapshot, reference, query, event and command contracts.
- `@adp-devtools/runtime` is an adapter host with no framework dependency. It validates protocol ranges and namespaced domains.
- `@adp-devtools/angular` aggregates private Angular capture modules, maps them to standard domains and owns Angular explanations and domain commands.
- `@adp-devtools/browser` injects the generic bridge plus caller-supplied adapter scripts; the Angular browser entry composes both.
- CLI and MCP expose generic ADP operations plus Angular contributions.
- Angular form migration and assertion helpers moved out of the generic core into the Angular package.

## Data flow

`connectAngularBrowser()` loads the generic page runtime and Angular adapter bundle. `snapshot` creates a new reference registry, selects available adapters, captures domain envelopes, and returns warnings and truncations. `query` selects one domain resource. `execute` and `explain` route to the adapter declaring the subject domain.

## Decisions and limitations

- V1 is Web-first but the protocol does not depend on Playwright.
- Internal Angular modules remain separate workspace projects for build isolation, but are private and aggregated behind one adapter package.
- Domain diff is deterministic at domain-payload granularity.
- Event capture from optional Angular instrumentation is collected during snapshots; watch performs periodic captures.
- Dynamic third-party plugin discovery is deferred to RFC-0014.

## Tests and validation

Focused tests cover schemas, custom namespaces, adapter protocol negotiation, custom domain capture, stale generations, command routing, generic query/diff, Angular assistance, CLI/MCP registration and dependency boundaries.

Validation commands:

```bash
pnpm typecheck
pnpm test:packages
pnpm check
pnpm test:browsers
```

The completed implementation passed `pnpm check`. A live Chromium smoke run against `basic-app` detected Angular 22.1, one component and one Signal Form through `connectAngularBrowser()`.
