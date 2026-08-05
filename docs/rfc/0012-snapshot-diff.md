# RFC-0012: Snapshot and diff

**Status:** Accepted

Each snapshot is a correlated generation containing runtime metadata, active adapter descriptors and domain envelopes. The core diff compares domains deterministically and reports added, removed or changed domain payloads. Snapshot files remain portable JSON documents for CLI and MCP diff operations.
