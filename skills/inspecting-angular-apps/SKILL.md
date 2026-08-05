---
name: inspecting-angular-apps
description: Inspect, query, profile, and explain a running Angular development application through the Agent DevTools Angular adapter. Use when an agent needs runtime evidence about components, directives, Router, dependency injection, Signals, classic Forms, Signal Forms, NgRx, or rendering performance.
---

# Inspect Angular Apps

Use structured runtime evidence before drawing conclusions from source code alone.

## Workflow

1. Confirm that the target is a local Angular development build.
2. Start or attach to Chromium:

   ```bash
   agent-devtools open http://localhost:4200
   # or
   agent-devtools connect --cdp http://localhost:9222
   ```

3. Run `agent-devtools status --json`. If Angular is absent or production mode prevents inspection, report that limitation rather than guessing.
4. Capture `agent-devtools snapshot --scope current-route --json` for correlated context.
5. Narrow results with structured domain queries, such as `agent-devtools query components --resource components name=CheckoutComponent --json`.
6. Use stable refs from the current generation for inspection and explanation. Recapture when a `STALE_REFERENCE` error occurs.
7. Use `profile` or `watch` only when the question requires temporal evidence.
8. Close owned browser sessions with `agent-devtools close`.

## Evidence Rules

- Distinguish `observed`, `instrumented`, and `inferred` relations.
- State when discovery is `partial`; never claim exhaustive Signal dependencies or DI consumers without instrumentation.
- Treat redacted and truncated values as unavailable.
- Do not resolve providers by invoking factories or call SignalStore methods.
- Treat the V1 runtime as read-only; mutation, replay and interaction commands do not exist.
- Prefer compact JSON for tool use and JSONL for event streams. Do not parse human-formatted output.

## Useful Commands

```bash
agent-devtools components tree --json
agent-devtools router active --json
agent-devtools di tree --json
agent-devtools signals list --json
agent-devtools forms list --json
agent-devtools signal-forms list --json
agent-devtools ngrx state --json
agent-devtools profile start
agent-devtools profile stop --output profile.json
```

When MCP is configured, use generic `adp_*` tools for protocol operations and `angular_*` tools for adapter resources.
