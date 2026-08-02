---
name: inspecting-angular-apps
description: Inspect, query, profile, diagnose, and explain a running Angular development application with the ng-agent CLI or MCP server. Use when an agent needs runtime evidence about components, directives, Router, dependency injection, Signals, classic Forms, Signal Forms, NgRx, rendering performance, or causal relationships.
---

# Inspect Angular Apps

Use structured runtime evidence before drawing conclusions from source code alone.

## Workflow

1. Confirm that the target is a local Angular development build.
2. Start or attach to Chromium:

   ```bash
   ng-agent open http://localhost:4200
   # or
   ng-agent connect --cdp http://localhost:9222
   ```

3. Run `ng-agent status --json`. If Angular is absent or production mode prevents inspection, report that limitation rather than guessing.
4. Capture `ng-agent snapshot --scope current-route --json` for correlated context.
5. Narrow results with structured queries, such as `ng-agent query fields invalid=true --json`.
6. Use stable refs from the current generation for inspection and explanation. Recapture when a `STALE_REFERENCE` error occurs.
7. Use `profile`, `watch`, `graph`, or `diagnostics` only when the question requires temporal or causal evidence.
8. Close owned browser sessions with `ng-agent close`.

## Evidence Rules

- Distinguish `observed`, `instrumented`, and `inferred` relations.
- State when discovery is `partial`; never claim exhaustive Signal dependencies or DI consumers without instrumentation.
- Treat redacted and truncated values as unavailable.
- Do not resolve providers by invoking factories or call SignalStore methods.
- Keep runtime mutations disabled unless the user explicitly requests them and a local capability token is configured.
- Prefer compact JSON for tool use and JSONL for event streams. Do not parse human-formatted output.

## Useful Commands

```bash
ng-agent components tree --json
ng-agent router active --json
ng-agent di tree --json
ng-agent signals list --json
ng-agent forms list --json
ng-agent signal-forms list --json
ng-agent ngrx state --json
ng-agent profile start
ng-agent profile stop --output profile.json
ng-agent diagnostics --json
```

When MCP is configured, prefer its `angular_*` tools because schemas, pagination, and reusable references are explicit.
