# RFC-0008: Performance budgets

**Status:** Accepted

Every capture may specify maximum depth, array length, string length, property count, total bytes and redacted paths. Adapters reuse the runtime serializer and return truncation metadata. Event retention and snapshot work are bounded; profiling is an explicit read-only adapter command.
