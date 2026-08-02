# Contributing

Use Node.js 20.19+ and pnpm 11. Run `pnpm check` before opening a pull request. Public protocol changes need schemas, tests, and a compatibility note. Runtime adapters must remain read-only by default, tolerate unavailable APIs, and report partial discovery rather than fabricate completeness.

Commits that touch Angular behavior should build the example application with `pnpm --filter basic-app build`.
