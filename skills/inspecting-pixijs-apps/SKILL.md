---
name: inspecting-pixijs-apps
description: Inspect, query, diagnose, and explain a running PixiJS 8 development application with the Agent DevTools CLI or MCP server. Use when an agent needs runtime evidence about the scene graph, renderer, transforms, visibility, or managed textures.
---

# Inspect PixiJS Apps

Use structured runtime evidence before drawing conclusions from source code alone.

## Workflow

1. Confirm the target is a local PixiJS 8 application registered with `@pixi/devtools` when possible.
2. Start or attach to Chromium with `agent-devtools open <url>` or `agent-devtools connect --cdp <url>`.
3. Run `agent-devtools status --json` and confirm that the `pixi` adapter is active.
4. Capture `agent-devtools snapshot --json`, then narrow results with `scene tree`, `scene inspect`, `rendering info`, `assets textures`, or a generic ADP query.
5. Use runtime references from the current generation for `explain`; recapture after `STALE_REFERENCE`.
6. Close browser sessions owned by the agent with `agent-devtools close`.

## Evidence Rules

- Treat `instrumented` discovery as official PixiJS DevTools registration and `partial` discovery as a legacy-global fallback.
- Report missing renderer or texture metadata as unavailable rather than inferring it.
- Do not interpret a truncated scene or texture list as exhaustive.
- Keep inspection read-only; the adapter does not select, move, rename, delete, or modify PixiJS nodes.
- Texture snapshots contain metadata only, not pixel data or logical Assets cache entries.

## Useful Commands

```bash
agent-devtools scene tree --json
agent-devtools scene inspect Hero --json
agent-devtools rendering info --json
agent-devtools assets textures --json
agent-devtools query scene-graph --resource nodes visible=true --json
agent-devtools explain pixi-node ref-2 --json
```

When MCP is configured, prefer `pixi_scene_nodes`, `pixi_rendering`, and `pixi_textures` because their schemas and pagination are explicit.
