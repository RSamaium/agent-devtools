# CLI contract

Human-readable output is used only on a TTY. `--json` emits one JSON document, `--jsonl` emits one event per line, and diagnostic output is written to stderr. No informational logs are written to stdout in either machine-readable mode.

Exit codes are stable within protocol major 1:

| Code | Meaning |
|---:|---|
| 0 | Success |
| 1 | Invalid command, arguments, or unexpected CLI failure |
| 2 | No browser session, connection failure, or timeout |
| 3 | Angular absent or a non-inspectable production build |
| 4 | Missing or stale runtime reference |
| 5 | Mutation denied by runtime security policy |

Read commands never enable runtime mutations. A mutation additionally requires `--allow-mutations`, `--capability-token`, the provider runtime opt-in, an explicit operation allowlist, and a permitted origin.

## Command discovery

The CLI exposes the same complete command catalog as human-readable contextual help and as a versioned JSON document. Help commands do not load a session or connect to a browser.

```bash
ng-agent help
ng-agent help signal-form
ng-agent signal-form field --help
ng-agent commands --json
```

`help --json` and `commands --json` return a `CliHelpDocument`. It contains `schemaVersion`, `protocolVersion`, global options, exit codes, and every leaf command with its path, usage, arguments, options, examples, output description, and mutation status. A command group can be selected with `ng-agent help <group> --json`.

The machine-readable catalog is intended for shell-based agents. MCP clients should normally use the schemas exposed directly by the `angular_*` MCP tools.

## Browser installation

Global and local CLI installations expose the matching Playwright browser installer through `ng-agent`:

```bash
ng-agent install
ng-agent install chromium firefox webkit
ng-agent install chromium --with-deps
```

With no browser argument, Chromium is installed. Supported names are `chromium`, `firefox`, and `webkit`; any other value returns exit code 1. `--with-deps` may invoke the operating-system package manager and can require elevated privileges. In `--json` mode, Playwright progress output is captured so stdout contains only the final JSON result.
