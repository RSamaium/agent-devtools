# RFC-0007: Security

**Status:** Accepted

ADP V1 is read-only. Mutation, replay and application interaction are absent from protocol and clients. Serialization does not evaluate getters or application methods, applies configured redaction and reports truncation. Browser debugging endpoints must remain local and trusted.
