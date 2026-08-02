export interface RuntimeInstrumentationRecord {
  id: string;
  kind: 'signal' | 'effect' | 'form' | 'signal-form' | 'store' | 'service' | 'injector';
  name: string;
  value: unknown;
  owner?: object;
  metadata?: Record<string, unknown>;
  registeredAt: number;
}
export interface RuntimeInstrumentationEvent { type: string; timestamp: number; source?: string; value?: unknown; origin?: string }
export interface RuntimeInstrumentationRegistry {
  options: Record<string, unknown>;
  records: Map<string, RuntimeInstrumentationRecord>;
  events: RuntimeInstrumentationEvent[];
}
export function getInstrumentation(window: Window): RuntimeInstrumentationRegistry | undefined {
  return (window as unknown as { __NG_AGENT_INSTRUMENTATION__?: RuntimeInstrumentationRegistry }).__NG_AGENT_INSTRUMENTATION__;
}
