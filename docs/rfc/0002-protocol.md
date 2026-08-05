# RFC-0002: ADP core and domains

**Status:** Accepted

ADP V1 uses JSON-RPC 2.0 and defines status, snapshot, query, events, explain and read-only domain execution. Snapshots contain adapter-owned domain envelopes instead of framework fields. Standard domain IDs are reserved; third-party domains require a namespace such as `company.example/state`.

Clients ignore additive fields within a major version. References include domain, kind and generation. Unknown methods, incompatible majors and stale references return structured errors.
