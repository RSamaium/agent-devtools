# Releasing packages

The nine public `@adp-devtools/*` packages are versioned together with Changesets. Merging a normal feature pull request does not publish immediately: GitHub Actions maintains a release pull request containing the next versions and changelogs. Merging that release pull request publishes every new package version to npm.

## One-time repository setup

1. Create or confirm control of the public `@adp-devtools` organization on npm and give the publishing account access to the scope. The release registry check intentionally fails if an existing package name points to another repository.
2. In GitHub, enable Actions to create and approve pull requests under **Settings → Actions → General → Workflow permissions**.
3. Create a GitHub Environment named `npm` under **Settings → Environments**. Add the required reviewers who may approve a publication.
4. Create an npm automation or granular access token that can publish the `@adp-devtools` scope. Add it as an environment secret named `NPM_TOKEN` in the `npm` environment.
5. Merge or manually run `.github/workflows/release.yml`. The initial `0.1.0` publication uses this token and pauses for approval at the `npm` environment gate.

The workflow uses Node.js 24, npm 11, public access, and npm provenance. It validates and installs the generated tarballs before publishing them.

## Move to npm Trusted Publishing

After each package exists on npm, configure a trusted publisher in the npm package settings with these exact values:

- Provider: GitHub Actions
- Organization or user: `RSamaium`
- Repository: `agent-devtools`
- Workflow filename: `release.yml`
- Environment: `npm`

Repeat this for all nine public packages: `protocol`, `core`, `runtime`, `browser`, `angular`, `pixi`, `testing`, `cli`, and `mcp`. Once one OIDC-backed release succeeds, remove the `NPM_TOKEN` environment secret. The workflow already grants only the publish job `id-token: write`, so no workflow change is needed.

## Prepare a release

For every pull request that affects a public package:

```bash
pnpm changeset
```

Choose the affected packages, the semantic version impact, and a concise user-facing summary. After the pull request is merged into `master`, the release workflow creates or updates `chore: release packages`. Review and merge that pull request when the accumulated changes are ready to ship. An authorized reviewer must then approve the `npm` environment deployment.

Publication can also be retried with **Actions → Release → Run workflow**. The registry check skips versions that already exist, preventing an empty republish attempt.

## Local release validation

```bash
pnpm release:check
```

This builds and packs every public package, rejects workspace or private dependency leaks, verifies all exported files, installs the tarballs into a clean consumer project, and smoke-tests both command-line binaries. It never publishes.
