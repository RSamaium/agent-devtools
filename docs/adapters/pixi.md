# PixiJS adapter

`@agent-devtools/pixi` observes PixiJS 8 applications through the standard ADP `scene-graph`, `rendering` and `assets` domains. It does not claim `application`, so PixiJS and Angular can be inspected in the same page.

## Registration

Prefer the official PixiJS DevTools registration API:

```ts
import { initDevtools } from '@pixi/devtools';

await initDevtools({ app, version: PIXI.VERSION });
```

The adapter reads `window.__PIXI_DEVTOOLS__`. Historical `__PIXI_APP__`, `__PIXI_STAGE__` and `__PIXI_RENDERER__` globals remain best-effort fallbacks and produce `PIXI_DISCOVERY_PARTIAL`.

## Domains

- `scene-graph.nodes` contains stable per-generation references, hierarchy, allowlisted transforms, visibility and texture relations.
- `rendering` reports the backend, dimensions, resolution and compact scene counters.
- `assets.textures` contains metadata for renderer-managed texture sources. Pixels, data URLs and the logical `Assets` cache are not captured.

Capture is read-only, cycle-safe and bounded by the snapshot collection budget. PixiJS 7, overlays, frame capture and mutations are outside the V1 compatibility contract.
