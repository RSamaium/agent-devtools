# `@adp-devtools/pixi`

Read-only PixiJS 8 adapter for Agent DevTools. It captures the scene graph, renderer metadata and managed GPU texture metadata through ADP.

Register the application with the official PixiJS DevTools API:

```ts
import { initDevtools } from '@pixi/devtools';

await initDevtools({ app, version: '8' });
```

Then connect an agent:

```ts
import { connectPixiBrowser } from '@adp-devtools/pixi/browser';

const client = await connectPixiBrowser({ url: 'http://localhost:5173' });
const scene = await client.query({ domain: 'scene-graph', resource: 'nodes' });
```

Legacy `__PIXI_APP__`, `__PIXI_STAGE__` and `__PIXI_RENDERER__` globals are supported as partial-discovery fallbacks. Pixel data, logical Assets cache aliases, overlays and runtime mutation are intentionally excluded.
