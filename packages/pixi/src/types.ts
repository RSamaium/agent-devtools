import type { DiscoveryLevel, RuntimeRef } from '@adp-devtools/protocol';

export interface PixiPointSnapshot { x: number; y: number }

export interface PixiSceneNodeSnapshot {
  ref: RuntimeRef;
  name: string;
  type: string;
  parent?: RuntimeRef;
  children: RuntimeRef[];
  visible?: boolean;
  renderable?: boolean;
  alpha?: number;
  worldAlpha?: number;
  position?: PixiPointSnapshot;
  scale?: PixiPointSnapshot;
  pivot?: PixiPointSnapshot;
  skew?: PixiPointSnapshot;
  rotation?: number;
  zIndex?: number;
  width?: number;
  height?: number;
  eventMode?: string;
  texture?: RuntimeRef;
}

export interface PixiSceneGraphSnapshot {
  roots: RuntimeRef[];
  nodes: PixiSceneNodeSnapshot[];
  discovery: DiscoveryLevel;
}

export interface PixiRenderingSnapshot {
  backend: 'webgl' | 'webgl2' | 'webgpu' | 'unknown';
  width?: number;
  height?: number;
  resolution?: number;
  antialias?: boolean;
  backgroundColor?: string | number;
  backgroundAlpha?: number;
  nodeCount: number;
  visibleNodeCount: number;
  textureCount: number;
  discovery: DiscoveryLevel;
}

export interface PixiTextureSnapshot {
  ref: RuntimeRef;
  uid?: number | string;
  label?: string;
  width?: number;
  height?: number;
  pixelWidth?: number;
  pixelHeight?: number;
  resolution?: number;
  format?: string;
  dimension?: string;
  mipLevelCount?: number;
  autoGenerateMipmaps?: boolean;
  alphaMode?: string;
  antialias?: boolean;
  destroyed?: boolean;
  isPowerOfTwo?: boolean;
  autoGarbageCollect?: boolean;
  sourceType?: string;
}

export interface PixiAssetsSnapshot {
  textures: PixiTextureSnapshot[];
  total: number;
  discovery: DiscoveryLevel;
}
