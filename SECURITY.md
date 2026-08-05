# Security policy

Report vulnerabilities privately to the project maintainers before public disclosure.

Agent DevTools V1 is read-only. The protocol, client, runtime, CLI and MCP server expose no mutation, replay or interaction command. The Angular adapter observes development debug APIs and optional application-owned instrumentation without invoking provider factories, property getters or store methods.

Configure path redaction for credentials and personal data. Safe serialization enforces depth, collection, string, property and byte budgets, breaks cycles and reports truncation metadata.

Runtime references include their domain and snapshot generation. Consumers must reject stale references rather than resolving them against a later application state.

Do not expose a Chrome debugging port to untrusted networks. Bind CDP endpoints to loopback, use disposable browser profiles and avoid inspecting production pages containing real user data.

Future mutation or replay capabilities require a separate RFC and security review; they are not part of ADP V1.
