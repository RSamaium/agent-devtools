# CLI contract

Human-readable output is used only on a TTY. `--json` emits one JSON document, `--jsonl` emits events, and errors are written to stderr.

| Code | Meaning |
|---:|---|
| 0 | Success |
| 1 | Invalid command or unexpected failure |
| 2 | Missing session, browser failure or timeout |
| 3 | Required adapter unavailable or non-inspectable build |
| 4 | Missing or stale runtime reference |

V1 has no mutation commands.

## Discovery

```bash
agent-devtools help
agent-devtools help signal-form
agent-devtools commands --json
```

The JSON catalog contains schema and protocol versions, options, exit codes and every executable leaf command. Generic ADP commands coexist with commands contributed by the Angular and PixiJS compositions.

PixiJS commands are `scene tree`, `scene inspect`, `rendering info`, and `assets textures`. They remain read-only and address the same standard domains available through `query`.

## Generic query

```bash
agent-devtools query components --resource components name=CheckoutComponent --json
agent-devtools query company.example/state status=ready --json
```

The domain is mandatory. `--resource` selects an array property inside a structured domain payload.

## Browser installation

```bash
agent-devtools install
agent-devtools install chromium firefox webkit
agent-devtools install chromium --with-deps
```

`--with-deps` may require operating-system privileges. Machine-readable mode captures Playwright progress so stdout remains valid JSON.
