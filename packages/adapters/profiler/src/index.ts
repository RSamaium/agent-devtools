import { getInstrumentation, type CaptureAdapter, type RuntimeContext } from '@agent-devtools/runtime';
import type { StandardCaptureSnapshot } from '@agent-devtools/protocol';
export class ProfilerAdapter implements CaptureAdapter<StandardCaptureSnapshot> {
  readonly name = 'profiler'; readonly priority = 90;
  isAvailable() { return typeof performance !== 'undefined'; }
  capture(snapshot: StandardCaptureSnapshot, context: RuntimeContext): void {
    const records = performance.getEntriesByType('measure').filter(item => item.name.startsWith('agent-devtools:')).slice(-100);
    const instrumented = getInstrumentation(context.window)?.events.filter(item => item.type === 'change-detection-cycle') ?? [];
    if (!records.length && !instrumented.length) return;
    const entries = records.map(item => ({ name: item.name.slice(9), kind: 'cycle' as const, start: item.startTime, duration: item.duration }));
    entries.push(...instrumented.map((item, index) => ({ name: item.source ?? `cycle-${index}`, kind: 'cycle' as const, start: item.timestamp, duration: typeof item.value === 'number' ? item.value : 0 })));
    snapshot.profile = { startedAt: Math.min(...entries.map(item => item.start)), stoppedAt: Math.max(...entries.map(item => item.start + item.duration)), entries, budgetExceeded: false };
  }
}
export const profilerAdapter = () => new ProfilerAdapter();
