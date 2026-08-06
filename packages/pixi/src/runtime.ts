import type {
  AdapterCapture, RuntimeAdapter, RuntimeContext,
} from '@adp-devtools/runtime';
import { serialize } from '@adp-devtools/runtime';
import type {
  AdapterDescriptor, Explanation, RuntimeRef, Truncation,
} from '@adp-devtools/protocol';
import type {
  PixiAssetsSnapshot, PixiPointSnapshot, PixiRenderingSnapshot,
  PixiSceneGraphSnapshot, PixiSceneNodeSnapshot, PixiTextureSnapshot,
} from './types.js';

type UnknownRecord = Record<string, unknown>;

interface PixiRegistration extends UnknownRecord {
  app?: UnknownRecord;
  stage?: UnknownRecord;
  renderer?: UnknownRecord;
  pixi?: UnknownRecord;
  version?: string;
}

interface PixiRuntimeObjects {
  stage?: UnknownRecord;
  renderer?: UnknownRecord;
  pixi?: UnknownRecord;
  version?: string;
  discovery: 'instrumented' | 'partial';
  source: 'official' | 'fallback';
}

interface LatestCapture {
  scene: PixiSceneGraphSnapshot;
  assets: PixiAssetsSnapshot;
}

const domain = (id: string, capabilities: string[]) => ({ id, version: '1.0.0', capabilities });
const record = (value: unknown): UnknownRecord | undefined => value !== null && typeof value === 'object' ? value as UnknownRecord : undefined;
const finite = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const string = (value: unknown): string | undefined => typeof value === 'string' ? value : undefined;
const boolean = (value: unknown): boolean | undefined => typeof value === 'boolean' ? value : undefined;
const put = (target: UnknownRecord, key: string, value: unknown): void => { if (value !== undefined) target[key] = value; };

const point = (value: unknown): PixiPointSnapshot | undefined => {
  const candidate = record(value); const x = finite(candidate?.['x']); const y = finite(candidate?.['y']);
  return x === undefined || y === undefined ? undefined : { x, y };
};

const childrenOf = (node: UnknownRecord): UnknownRecord[] => {
  const children = node['children'];
  return Array.isArray(children) ? children.map(record).filter((child): child is UnknownRecord => !!child) : [];
};

const constructorName = (value: UnknownRecord): string => {
  const name = string((value.constructor as { name?: unknown } | undefined)?.name) ?? 'Container';
  return name.startsWith('_') ? name.slice(1) : name;
};

const sourceType = (value: UnknownRecord): string | undefined => {
  const resource = record(value['resource']);
  return resource ? constructorName(resource) : undefined;
};

const iterableValues = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object' && Symbol.iterator in value) {
    try { return Array.from(value as Iterable<unknown>); } catch { return []; }
  }
  return [];
};

export class PixiRuntimeAdapter implements RuntimeAdapter {
  private latest?: LatestCapture;
  private version: string | undefined;

  get descriptor(): AdapterDescriptor {
    return {
      id: 'pixi', name: 'PixiJS Adapter', version: '0.1.0', protocolRange: '^1.0.0',
      framework: { name: 'pixi.js', ...(this.version ? { version: this.version } : {}) },
      domains: [
        domain('scene-graph', ['pixi.scene-graph', 'pixi.transforms']),
        domain('rendering', ['pixi.renderer', 'pixi.statistics']),
        domain('assets', ['pixi.textures']),
      ],
      capabilities: ['snapshot', 'query', 'explain', 'diff'],
    };
  }

  isAvailable(context: RuntimeContext): boolean {
    return this.discover(context.window).stage !== undefined;
  }

  capture(context: RuntimeContext): AdapterCapture {
    const runtime = this.discover(context.window); this.version = runtime.version;
    if (!runtime.stage) return { domains: {}, warnings: [{ code: 'PIXI_STAGE_NOT_FOUND', message: 'PixiJS was detected without an inspectable stage.', domain: 'scene-graph' }] };
    const warnings = runtime.source === 'fallback' ? [{ code: 'PIXI_DISCOVERY_PARTIAL', message: 'PixiJS was discovered through legacy globals; use @pixi/devtools initDevtools() for deterministic discovery.', domain: 'scene-graph' }] : [];
    if (runtime.version && runtime.version.split('.')[0] !== '8') warnings.push({ code: 'PIXI_UNSUPPORTED_VERSION', message: `PixiJS ${runtime.version} is outside the supported 8.x range.`, domain: 'scene-graph' });
    if (!runtime.renderer) warnings.push({ code: 'PIXI_RENDERER_NOT_FOUND', message: 'The PixiJS renderer is unavailable; rendering and texture metadata are partial.', domain: 'rendering' });

    const truncations: Truncation[] = [];
    const textures = this.captureTextures(runtime.renderer, context, truncations);
    const textureRefs = new Map<object, RuntimeRef>();
    for (const item of textures.entries) textureRefs.set(item.source, item.snapshot.ref);
    const scene = this.captureScene(runtime.stage, runtime.discovery, textureRefs, context, truncations);
    const assets: PixiAssetsSnapshot = { textures: textures.entries.map(item => item.snapshot), total: textures.total, discovery: runtime.discovery };
    const rendering = this.captureRendering(runtime.renderer, scene, assets, runtime.discovery);
    this.latest = { scene, assets };
    const serialized = serialize({ 'scene-graph': scene, rendering, assets }, context.options.budget);
    truncations.push(...serialized.truncations);
    const domainData = serialized.value as unknown as Record<string, unknown>;
    return {
      domains: {
        'scene-graph': { id: 'scene-graph', version: '1.0.0', data: domainData['scene-graph'] },
        rendering: { id: 'rendering', version: '1.0.0', data: domainData['rendering'] },
        assets: { id: 'assets', version: '1.0.0', data: domainData['assets'] },
      },
      warnings, truncations,
    };
  }

  explain(subject: RuntimeRef | string): Explanation {
    const label = typeof subject === 'string' ? subject : `${subject.kind} ${subject.id}`;
    if (typeof subject === 'string' || !this.latest) return { subject, summary: label, facts: [], evidence: [], limitations: ['No matching captured PixiJS reference.'] };
    const node = this.latest.scene.nodes.find(item => item.ref.id === subject.id);
    const texture = this.latest.assets.textures.find(item => item.ref.id === subject.id);
    const facts: Explanation['facts'] = [];
    if (node?.parent) facts.push({ relation: 'child-of', value: node.parent.id, confidence: 'observed' });
    if (node) facts.push({ relation: 'has-children', value: node.children.length, confidence: 'observed' });
    if (node?.texture) facts.push({ relation: 'uses-texture', value: node.texture.id, confidence: 'observed' });
    if (node?.visible !== undefined) facts.push({ relation: 'visible', value: node.visible, confidence: 'observed' });
    if (texture) facts.push({ relation: 'dimensions', value: { width: texture.width ?? null, height: texture.height ?? null }, confidence: 'observed' });
    const evidence = node || texture ? [subject] : [];
    return { subject, summary: `${label} has ${facts.length} observed relation(s).`, facts, evidence, limitations: ['Only allowlisted PixiJS runtime properties are reported.'] };
  }

  private discover(window: Window): PixiRuntimeObjects {
    const globals = window as unknown as Record<string, unknown>;
    const registration = record(globals['__PIXI_DEVTOOLS__']) as PixiRegistration | undefined;
    const officialApp = record(registration?.app);
    const officialRenderer = record(registration?.renderer) ?? record(officialApp?.['renderer']);
    const officialStage = record(registration?.stage) ?? record(officialApp?.['stage']) ?? record(officialRenderer?.['lastObjectRendered']);
    const fallbackApp = record(globals['__PIXI_APP__']);
    const fallbackRenderer = record(fallbackApp?.['renderer']) ?? record(globals['__PIXI_RENDERER__']);
    const fallbackStage = record(fallbackApp?.['stage']) ?? record(globals['__PIXI_STAGE__']) ?? record(fallbackRenderer?.['lastObjectRendered']);
    const renderer = officialRenderer ?? fallbackRenderer;
    const stage = officialStage ?? fallbackStage;
    const pixi = record(registration?.pixi) ?? record(globals['__PIXI__']) ?? record(globals['PIXI']);
    const version = string(registration?.version) ?? string(pixi?.['VERSION']);
    const official = !!officialStage && (!fallbackRenderer || !!officialRenderer);
    return { ...(stage ? { stage } : {}), ...(renderer ? { renderer } : {}), ...(pixi ? { pixi } : {}), ...(version ? { version } : {}), discovery: official ? 'instrumented' : 'partial', source: official ? 'official' : 'fallback' };
  }

  private captureScene(stage: UnknownRecord, discovery: 'instrumented' | 'partial', textureRefs: Map<object, RuntimeRef>, context: RuntimeContext, truncations: Truncation[]): PixiSceneGraphSnapshot {
    const limit = context.options.budget?.maxArrayLength ?? 100;
    const queue: UnknownRecord[] = [stage]; const captured: UnknownRecord[] = []; const seen = new WeakSet<object>();
    while (queue.length && captured.length < limit) {
      const node = queue.shift()!; if (seen.has(node)) continue; seen.add(node); captured.push(node); queue.push(...childrenOf(node));
    }
    if (queue.length) truncations.push({ path: 'scene-graph.nodes', reason: 'array-length' });
    const included = new Set<object>(captured);
    const nodes = captured.map(node => this.captureNode(node, included, textureRefs, context));
    return { roots: [context.refs.ref(stage, 'pixi-node', 'scene-graph')], nodes, discovery };
  }

  private captureNode(node: UnknownRecord, included: Set<object>, textureRefs: Map<object, RuntimeRef>, context: RuntimeContext): PixiSceneNodeSnapshot {
    const type = constructorName(node); const parent = record(node['parent']); const texture = record(node['texture']); const textureSource = record(texture?.['source']);
    const snapshot: PixiSceneNodeSnapshot = {
      ref: context.refs.ref(node, 'pixi-node', 'scene-graph'),
      name: string(node['label']) ?? string(node['name']) ?? type,
      type,
      ...(parent && included.has(parent) ? { parent: context.refs.ref(parent, 'pixi-node', 'scene-graph') } : {}),
      children: childrenOf(node).filter(child => included.has(child)).map(child => context.refs.ref(child, 'pixi-node', 'scene-graph')),
    };
    put(snapshot as unknown as UnknownRecord, 'visible', boolean(node['visible']));
    put(snapshot as unknown as UnknownRecord, 'renderable', boolean(node['renderable']));
    put(snapshot as unknown as UnknownRecord, 'alpha', finite(node['alpha']));
    put(snapshot as unknown as UnknownRecord, 'worldAlpha', finite(node['worldAlpha']));
    put(snapshot as unknown as UnknownRecord, 'position', point(node['position']));
    put(snapshot as unknown as UnknownRecord, 'scale', point(node['scale']));
    put(snapshot as unknown as UnknownRecord, 'pivot', point(node['pivot']));
    put(snapshot as unknown as UnknownRecord, 'skew', point(node['skew']));
    put(snapshot as unknown as UnknownRecord, 'rotation', finite(node['rotation']));
    put(snapshot as unknown as UnknownRecord, 'zIndex', finite(node['zIndex']));
    put(snapshot as unknown as UnknownRecord, 'width', finite(node['width']));
    put(snapshot as unknown as UnknownRecord, 'height', finite(node['height']));
    put(snapshot as unknown as UnknownRecord, 'eventMode', string(node['eventMode']));
    if (textureSource && textureRefs.has(textureSource)) snapshot.texture = textureRefs.get(textureSource)!;
    return snapshot;
  }

  private captureTextures(renderer: UnknownRecord | undefined, context: RuntimeContext, truncations: Truncation[]): { entries: Array<{ source: object; snapshot: PixiTextureSnapshot }>; total: number } {
    const textureSystem = record(renderer?.['texture']);
    const values = iterableValues(textureSystem?.['managedTextures']).map(record).filter((item): item is UnknownRecord => !!item);
    const limit = context.options.budget?.maxArrayLength ?? 100;
    if (values.length > limit) truncations.push({ path: 'assets.textures', reason: 'array-length', originalSize: values.length });
    return {
      total: values.length,
      entries: values.slice(0, limit).map(source => {
        const snapshot: PixiTextureSnapshot = { ref: context.refs.ref(source, 'pixi-texture', 'assets') };
        put(snapshot as unknown as UnknownRecord, 'uid', finite(source['uid']) ?? string(source['uid']));
        put(snapshot as unknown as UnknownRecord, 'label', string(source['label']));
        put(snapshot as unknown as UnknownRecord, 'width', finite(source['width']));
        put(snapshot as unknown as UnknownRecord, 'height', finite(source['height']));
        put(snapshot as unknown as UnknownRecord, 'pixelWidth', finite(source['pixelWidth']));
        put(snapshot as unknown as UnknownRecord, 'pixelHeight', finite(source['pixelHeight']));
        put(snapshot as unknown as UnknownRecord, 'resolution', finite(source['resolution']));
        put(snapshot as unknown as UnknownRecord, 'format', string(source['format']));
        put(snapshot as unknown as UnknownRecord, 'dimension', string(source['dimension']));
        put(snapshot as unknown as UnknownRecord, 'mipLevelCount', finite(source['mipLevelCount']));
        put(snapshot as unknown as UnknownRecord, 'autoGenerateMipmaps', boolean(source['autoGenerateMipmaps']));
        put(snapshot as unknown as UnknownRecord, 'alphaMode', string(source['alphaMode']));
        put(snapshot as unknown as UnknownRecord, 'antialias', boolean(source['antialias']));
        put(snapshot as unknown as UnknownRecord, 'destroyed', boolean(source['destroyed']));
        put(snapshot as unknown as UnknownRecord, 'isPowerOfTwo', boolean(source['isPowerOfTwo']));
        put(snapshot as unknown as UnknownRecord, 'autoGarbageCollect', boolean(source['autoGarbageCollect']));
        put(snapshot as unknown as UnknownRecord, 'sourceType', sourceType(source));
        return { source, snapshot };
      }),
    };
  }

  private captureRendering(renderer: UnknownRecord | undefined, scene: PixiSceneGraphSnapshot, assets: PixiAssetsSnapshot, discovery: 'instrumented' | 'partial'): PixiRenderingSnapshot {
    const name = string(renderer?.['name'])?.toLowerCase(); const type = finite(renderer?.['type']); const context = record(renderer?.['context']);
    const backend = name?.includes('webgpu') || type === 2 ? 'webgpu' : finite(context?.['webGLVersion']) === 2 ? 'webgl2' : name?.includes('webgl') || context ? 'webgl' : 'unknown';
    const background = record(renderer?.['background']); const view = record(renderer?.['view']); const canvas = record(renderer?.['canvas']) ?? record(view?.['canvas']) ?? view;
    const snapshot: PixiRenderingSnapshot = { backend, nodeCount: scene.nodes.length, visibleNodeCount: scene.nodes.filter(node => node.visible !== false && node.renderable !== false).length, textureCount: assets.textures.length, discovery };
    put(snapshot as unknown as UnknownRecord, 'width', finite(renderer?.['width']) ?? finite(canvas?.['width']));
    put(snapshot as unknown as UnknownRecord, 'height', finite(renderer?.['height']) ?? finite(canvas?.['height']));
    put(snapshot as unknown as UnknownRecord, 'resolution', finite(renderer?.['resolution']));
    put(snapshot as unknown as UnknownRecord, 'antialias', boolean(view?.['antialias']) ?? boolean(renderer?.['antialias']));
    put(snapshot as unknown as UnknownRecord, 'backgroundColor', string(background?.['color']) ?? finite(background?.['color']));
    put(snapshot as unknown as UnknownRecord, 'backgroundAlpha', finite(background?.['alpha']));
    return snapshot;
  }
}

export const pixiRuntimeAdapter = (): PixiRuntimeAdapter => new PixiRuntimeAdapter();
