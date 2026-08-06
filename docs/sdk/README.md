# SDK

Use `AgentDevToolsClient` from `@adp-devtools/core` with any ADP transport. `@adp-devtools/browser` supplies the generic Playwright/CDP transport; `@adp-devtools/angular/browser` composes it with the Angular adapter.

Queries use `{ domain, resource?, where?, limit?, cursor?, generation? }`. Domain commands use `client.execute(domain, command, params)`. Call `client.close()` for browser clients created by the SDK.
