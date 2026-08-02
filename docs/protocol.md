# Protocol policy

The current protocol version is `1.0.0` and is independent of npm package versions.

- Messages are JSON-RPC 2.0 and all public values are JSON serializable.
- Clients must ignore unknown object fields.
- Additive fields and union members may be introduced in a minor protocol release.
- Existing required fields are not removed or reinterpreted within a major version.
- Deprecated fields remain available for at least one minor release and are documented before removal.
- Breaking schema or command changes require a new protocol major version.
- A reference whose generation differs from the active snapshot must produce `STALE_REFERENCE`.

Serialization budgets cap depth, array size, string size, property count, and total bytes. Responses report every redaction and truncation.
