# RFC-0009: Angular Signals

**Status:** Accepted

Signals belong to the standard `state` domain. The Angular adapter captures stable references, type, value, owner, writability and discovery confidence from debug APIs or explicit instrumentation. V1 never calls `set`, store methods or effects.
