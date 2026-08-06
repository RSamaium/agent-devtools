# Changesets

Every pull request that changes a public package must include a changeset:

```bash
pnpm changeset
```

Select the affected packages, choose the semantic version impact, and write a short user-facing summary. All public packages share one fixed version, so Changesets will keep their versions aligned.

Documentation, tests, examples, CI changes, and changes limited to private implementation packages do not require a changeset.
