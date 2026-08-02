import type { DependencyGraph, Diagnostic, RuntimeEvent, Snapshot, SnapshotOptions } from '@ng-agent/protocol';
import type { ReferenceRegistry } from './refs.js';

export interface RuntimeContext {
  readonly window: Window;
  readonly document: Document;
  readonly refs: ReferenceRegistry;
  readonly options: SnapshotOptions;
  warn(code: string, message: string, domain?: string): void;
  emit(event: Omit<RuntimeEvent, 'id' | 'sequence'>): void;
}

export interface RuntimeAdapter {
  readonly name: string;
  readonly priority?: number;
  isAvailable(context: RuntimeContext): boolean;
  capture(snapshot: Snapshot, context: RuntimeContext): void | Promise<void>;
  graph?(snapshot: Snapshot, graph: DependencyGraph, context: RuntimeContext): void | Promise<void>;
  diagnostics?(snapshot: Snapshot, context: RuntimeContext): Diagnostic[] | Promise<Diagnostic[]>;
  replay?(event: RuntimeEvent, context: RuntimeContext): boolean | Promise<boolean>;
  dispose?(): void | Promise<void>;
}
