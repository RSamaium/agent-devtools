# Angular reference adapter

`@adp-devtools/angular` is the first official ADP adapter and the reference implementation for multi-domain capture.

It implements:

- `application`: Angular version, development mode, roots and render mode;
- `components`: components and directives;
- `routing`: Router configuration, active state and observed events;
- `dependency-injection`: injectors, providers and observed resolution;
- `state`: Signals, NgRx Store and NgRx SignalStore;
- `forms`: Reactive Forms, template-driven Forms and Signal Forms;
- `performance`: captured measures and profiling windows.

The package exports `angularRuntimeAdapter()`, `connectAngularBrowser()` and optional Angular DI instrumentation through `provideAgentDevtools()`. Private modules under `packages/adapters` are implementation details and are not separate public adapters.

Production builds without Angular debug APIs produce a `PRODUCTION_BUILD` warning. Discovery is observational and must not instantiate providers or invoke application methods.
