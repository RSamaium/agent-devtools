# Security policy

Report vulnerabilities privately to the project maintainers before public disclosure.

Runtime inspection is restricted to Angular development builds. Read operations are the default. Mutation requests require all of the following: explicit client opt-in, runtime opt-in, an exact local capability token, an allowlisted operation, and a local origin. The built-in mutation handlers cover Signals, Signal Forms, Router, and NgRx only when their targets were explicitly instrumented. Non-local mutation requires a separate explicit runtime override.

Configure path redaction for credentials and personal data. Safe serialization enforces depth, collection, string, property, and byte budgets; breaks cycles; does not invoke ordinary methods; and never evaluates property getters.

Do not expose a Chrome debugging port to untrusted networks. Prefer loopback endpoints and disposable browser profiles.
