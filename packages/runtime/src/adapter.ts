import type { AdapterDescriptor, DomainSnapshot, Explanation, RuntimeEvent, SerializedValue, SnapshotOptions, Truncation, RuntimeWarning } from '@agent-devtools/protocol';
import type { ReferenceRegistry } from './refs.js';

export interface RuntimeContext {
  readonly window: Window;
  readonly document: Document;
  readonly refs: ReferenceRegistry;
  readonly options: SnapshotOptions;
  warn(code: string, message: string, domain?: string): void;
  emit(event: Omit<RuntimeEvent, 'id' | 'sequence'>): void;
}

export interface AdapterCapture {
  domains: Record<string, DomainSnapshot>;
  warnings?: RuntimeWarning[];
  truncations?: Truncation[];
}

export interface RuntimeAdapter {
  readonly descriptor: AdapterDescriptor;
  isAvailable(context: RuntimeContext): boolean;
  capture(context: RuntimeContext): AdapterCapture | Promise<AdapterCapture>;
  execute?(domain: string, command: string, params: SerializedValue | undefined, context: RuntimeContext): SerializedValue | Promise<SerializedValue>;
  explain?(subject: import('@agent-devtools/protocol').RuntimeRef | string, question: string | undefined, context: RuntimeContext): Explanation | Promise<Explanation>;
  dispose?(): void | Promise<void>;
}

/** Internal composition hook; unlike RuntimeAdapter it is not an ADP plugin surface. */
export interface CaptureAdapter<TSnapshot> {
  readonly name: string;
  readonly priority?: number;
  isAvailable(context: RuntimeContext): boolean;
  capture(snapshot: TSnapshot, context: RuntimeContext): void | Promise<void>;
  dispose?(): void | Promise<void>;
}
