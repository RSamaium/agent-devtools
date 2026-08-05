# RFC-0003: Runtime and adapter contract

**Status:** Accepted

The runtime manages adapter registration, protocol compatibility, capture generations, reference resolution, event retention and safe serialization. It contains no framework detection or behavior.

An adapter declares an `AdapterDescriptor`, availability, capture hook and optional read-only command and explain hooks. Duplicate adapter IDs, invalid domain IDs and incompatible protocol ranges are rejected.
