import { getInstrumentation, serialize, type CaptureAdapter, type RuntimeContext } from '@adp-devtools/runtime';
import type { RuntimeKind, StandardCaptureSnapshot } from '@adp-devtools/protocol';

interface DebugSignalNode { kind: string; id: string; epoch?: number; label?: string; value?: unknown; debuggableFn?: () => unknown }
interface DebugSignalGraph { nodes: DebugSignalNode[]; edges: Array<{ consumer: number; producer: number }> }
interface SignalDebugApi { ɵgetSignalGraph?(injector: object): DebugSignalGraph | undefined }

const runtimeKind = (kind: string): RuntimeKind => kind === 'effect' || kind === 'afterRenderEffectPhase' ? 'effect' : kind === 'template' ? 'selector' : kind === 'computed' || kind === 'linkedSignal' ? 'computed' : 'signal';

export class SignalsAdapter implements CaptureAdapter<StandardCaptureSnapshot> {
  readonly name = 'signals';
  readonly priority = 30;
  private readonly graphObjects = new Map<string, object>();

  isAvailable(context: RuntimeContext) { return !!getInstrumentation(context.window) || typeof (context.window as unknown as { ng?: SignalDebugApi }).ng?.ɵgetSignalGraph === 'function'; }

  capture(snapshot: StandardCaptureSnapshot, context: RuntimeContext): void {
    const registry = getInstrumentation(context.window);
    for (const record of registry?.records.values() ?? []) if (record.kind === 'signal') {
      const signal = record.value as (() => unknown); let value: unknown; let error: string | undefined;
      try { value = typeof signal === 'function' ? signal() : signal; } catch (caught) { error = caught instanceof Error ? caught.message : String(caught); value = '[Signal error]'; }
      const serialized = serialize(value, context.options.budget, record.name); snapshot.truncations.push(...serialized.truncations);
      const ref = context.refs.ref(record.value as object, record.metadata?.['type'] === 'computed' ? 'computed' : 'signal');
      if (!snapshot.signals.some(item => item.ref.id === ref.id)) snapshot.signals.push({ ref, signalType: record.metadata?.['type'] === 'computed' ? 'computed' : record.metadata?.['type'] === 'input' ? 'input' : record.metadata?.['type'] === 'model' ? 'model' : 'signal', name: record.name, ...(record.owner ? { owner: context.refs.ref(record.owner, 'component') } : {}), value: serialized.value, writable: typeof signal === 'function' && 'set' in signal, ...(error ? { error } : {}), discovery: 'instrumented' });
    }

    for (const graph of this.debugGraphs(snapshot, context)) for (const node of graph.nodes) {
      if (!['signal', 'computed', 'linkedSignal', 'childSignalProp'].includes(node.kind)) continue;
      const identity = this.identity(node); const kind = runtimeKind(node.kind); const ref = context.refs.ref(identity, kind);
      if (snapshot.signals.some(item => item.ref.id === ref.id)) continue;
      const result = serialize(node.value ?? '[Unavailable]', context.options.budget, node.label ?? node.id);
      snapshot.signals.push({ ref, signalType: node.kind === 'computed' || node.kind === 'linkedSignal' ? 'computed' : 'signal', name: node.label ?? node.id, value: result.value, writable: node.kind === 'signal', discovery: 'complete' });
      snapshot.truncations.push(...result.truncations);
    }
  }

  private debugGraphs(snapshot: StandardCaptureSnapshot, context: RuntimeContext): DebugSignalGraph[] {
    const api = (context.window as unknown as { ng?: SignalDebugApi }).ng; if (!api?.ɵgetSignalGraph) return [];
    const result: DebugSignalGraph[] = [];
    for (const injector of snapshot.injectors) {
      const object = context.refs.resolve(injector.ref); if (!object) continue;
      try { const graph = api.ɵgetSignalGraph(object); if (graph?.nodes.length) result.push(graph); } catch { /* Unsupported injector type on this Angular version. */ }
    }
    return result;
  }

  private identity(node: DebugSignalNode): object {
    if (node.debuggableFn) return node.debuggableFn;
    const existing = this.graphObjects.get(node.id); if (existing) return existing;
    const identity = {}; this.graphObjects.set(node.id, identity); return identity;
  }
}

export const signalsAdapter = (): SignalsAdapter => new SignalsAdapter();
