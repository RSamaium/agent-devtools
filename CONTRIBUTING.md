# Contributing

Use Node.js 20.19+ and pnpm 11. Run `pnpm check` before opening a pull request. Public protocol changes need schemas, tests, and a compatibility note. Runtime adapters must remain read-only by default, tolerate unavailable APIs, and report partial discovery rather than fabricate completeness.

Changes to a public package must include a user-facing Changeset created with `pnpm changeset`. Documentation, tests, examples, CI-only work, and changes limited to private packages under `packages/adapters/` do not require one. The nine public packages use a fixed release group and therefore always keep the same version.

Commits that touch Angular behavior should build the example application with `pnpm --filter basic-app build`.
