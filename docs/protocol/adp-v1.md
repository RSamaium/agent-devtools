# Agent DevTools Protocol v1

ADP version `1.0.0` is independent from workspace package versions. Messages use JSON-RPC 2.0 and all public values are JSON serializable.

## Core methods

| Method | Result |
|---|---|
| `status` | Active adapters, domains and capabilities |
| `snapshot` | Correlated multi-domain snapshot |
| `query` | Filtered values from a domain resource |
| `events` | Normalized events after a sequence number |
| `explain` | Evidence-based adapter explanation |
| `execute` | Read-only domain command declared by an adapter |

## Adapters and domains

An `AdapterDescriptor` declares `id`, `name`, `version`, `protocolRange`, optional framework metadata, domains and capabilities. A `DomainDescriptor` declares its `id`, schema version, capabilities and commands.

Standard domain identifiers are `application`, `components`, `routing`, `dependency-injection`, `state`, `forms`, `performance`, `rendering`, `scene-graph`, `assets`, `network` and `diagnostics`. A third-party identifier must be namespaced, for example `company.example/state`.

`rendering`, `scene-graph`, `assets`, `network` and `diagnostics` are reserved but have no official V1 implementation.

## Snapshots and references

```ts
interface Snapshot {
  id: string;
  generation: number;
  runtime: RuntimeMetadata;
  adapters: AdapterDescriptor[];
  domains: Record<string, DomainSnapshot>;
  warnings: RuntimeWarning[];
  truncations: Truncation[];
}

interface RuntimeRef {
  id: string;
  domain: string;
  kind: string;
  generation: number;
}
```

A reference is valid only for its generation. Clients must ignore unknown object fields. Additive fields are compatible within protocol major 1; removal or reinterpretation requires a new major version.

## Safety and limits

Serialization limits depth, arrays, strings, properties and total bytes. Redacted or truncated paths are reported. V1 has no mutation, replay or interaction method.
