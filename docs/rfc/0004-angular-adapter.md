# RFC-0004: Angular reference adapter

**Status:** Accepted

The Angular adapter aggregates application, components, routing, dependency-injection, state, forms and performance. Its private capture modules may use Angular debug APIs and optional instrumentation; generic packages may not import them.

Angular 20–22 development builds are the V1 compatibility target. A production marker without debug APIs is reported but never bypassed.
