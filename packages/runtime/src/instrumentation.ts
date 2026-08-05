export interface RuntimeInstrumentationRecord {
  id: string;
  kind: string;
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
  return (window as unknown as { __AGENT_DEVTOOLS_INSTRUMENTATION__?: RuntimeInstrumentationRegistry }).__AGENT_DEVTOOLS_INSTRUMENTATION__;
}
