import { describe, expect, it } from 'vitest';
import type { CommandName, RpcRequest, Snapshot } from '@agent-devtools/protocol';
import { RuntimeEngine } from '@agent-devtools/runtime';
import type { PixiAssetsSnapshot, PixiRenderingSnapshot, PixiSceneGraphSnapshot } from './types.js';
import { pixiRuntimeAdapter } from './runtime.js';

class Container {
  children: Container[] = [];
  parent?: Container;
  visible = true;
  renderable = true;
  alpha = 1;
  position = { x: 0, y: 0 };
  scale = { x: 1, y: 1 };
  constructor(public label: string) {}
  add(child: Container): void { child.parent = this; this.children.push(child); }
}

class Sprite extends Container {
  constructor(label: string, readonly texture: { source: object }) { super(label); }
}

const fixture = (official = true): { window: Window; stage: Container; source: Record<string, unknown> } => {
  const source = { uid: 7, label: 'hero.png', width: 64, height: 32, pixelWidth: 128, pixelHeight: 64, format: 'rgba8unorm', resource: { privatePixels: 'not-serialized' } };
  const stage = new Container('Stage'); stage.add(new Sprite('Hero', { source }));
  const renderer = { name: 'webgl', context: { webGLVersion: 2 }, width: 800, height: 600, resolution: 2, texture: { managedTextures: new Set([source]) }, lastObjectRendered: stage };
  const window = {
    location: { href: 'https://example.test/', pathname: '/', hostname: 'example.test' }, navigator: { userAgent: 'test' }, document: { title: 'Pixi test', querySelector: () => null, querySelectorAll: () => [] },
    ...(official ? { __PIXI_DEVTOOLS__: { stage, renderer, version: '8.14.3' } } : { __PIXI_STAGE__: stage, __PIXI_RENDERER__: renderer, PIXI: { VERSION: '8.14.3' } }),
  } as unknown as Window;
  return { window, stage, source };
};

describe('PixiRuntimeAdapter', () => {
  it('captures the official scene, renderer and managed textures', async () => {
    const { window } = fixture(); const engine = new RuntimeEngine(window, { adapters: [pixiRuntimeAdapter()] });
    const snapshot = result(await engine.handle(request('snapshot', {}))) as Snapshot;
    const scene = snapshot.domains['scene-graph']!.data as PixiSceneGraphSnapshot;
    const rendering = snapshot.domains['rendering']!.data as PixiRenderingSnapshot;
    const assets = snapshot.domains['assets']!.data as PixiAssetsSnapshot;
    expect(snapshot.adapters).toEqual([expect.objectContaining({ id: 'pixi' })]);
    expect(scene).toMatchObject({ discovery: 'instrumented', nodes: [{ name: 'Stage', children: [expect.objectContaining({ domain: 'scene-graph' })] }, { name: 'Hero', type: 'Sprite', texture: expect.objectContaining({ domain: 'assets' }) }] });
    expect(rendering).toMatchObject({ backend: 'webgl2', width: 800, height: 600, nodeCount: 2, visibleNodeCount: 2, textureCount: 1 });
    expect(assets).toMatchObject({ total: 1, textures: [{ uid: 7, label: 'hero.png', width: 64, height: 32, sourceType: 'Object' }] });
    expect(JSON.stringify(assets)).not.toContain('privatePixels');
  });

  it('explains observed scene and texture relationships', async () => {
    const { window } = fixture(); const engine = new RuntimeEngine(window, { adapters: [pixiRuntimeAdapter()] });
    const snapshot = result(await engine.handle(request('snapshot', {}))) as Snapshot;
    const scene = snapshot.domains['scene-graph']!.data as PixiSceneGraphSnapshot; const hero = scene.nodes[1]!;
    const explanation = result(await engine.handle(request('explain', { subject: hero.ref }))) as { facts: Array<{ relation: string }> };
    expect(explanation.facts.map(fact => fact.relation)).toEqual(expect.arrayContaining(['child-of', 'uses-texture', 'visible']));
  });

  it('marks legacy globals as partial discovery', async () => {
    const { window } = fixture(false); const snapshot = result(await new RuntimeEngine(window, { adapters: [pixiRuntimeAdapter()] }).handle(request('snapshot', {}))) as Snapshot;
    expect(snapshot.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'PIXI_DISCOVERY_PARTIAL' })]));
    expect(snapshot.domains['scene-graph']?.data).toMatchObject({ discovery: 'partial' });
  });

  it('bounds cyclic scene graphs and texture lists with snapshot budgets', async () => {
    const { window, stage, source } = fixture(); stage.children[0]!.children.push(stage);
    const registration = (window as unknown as { __PIXI_DEVTOOLS__: { renderer: { texture: { managedTextures: unknown[] } } } }).__PIXI_DEVTOOLS__;
    registration.renderer.texture.managedTextures = [source, { uid: 8 }];
    const snapshot = result(await new RuntimeEngine(window, { adapters: [pixiRuntimeAdapter()] }).handle(request('snapshot', { budget: { maxArrayLength: 1 } }))) as Snapshot;
    expect((snapshot.domains['scene-graph']!.data as PixiSceneGraphSnapshot).nodes).toHaveLength(1);
    expect((snapshot.domains['assets']!.data as PixiAssetsSnapshot).textures).toHaveLength(1);
    expect(snapshot.truncations.map(item => item.path)).toEqual(expect.arrayContaining(['scene-graph.nodes', 'assets.textures']));
  });
});

let sequence = 0;
const request = <C extends CommandName>(method: C, params: RpcRequest<C>['params']): RpcRequest<C> => ({ jsonrpc: '2.0', id: String(++sequence), protocolVersion: '1.0.0', sessionId: 'test', timestamp: Date.now(), method, params });
const result = (response: Awaited<ReturnType<RuntimeEngine['handle']>>): unknown => { if ('error' in response) throw new Error(response.error.message); return response.result; };
