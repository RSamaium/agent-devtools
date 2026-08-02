import type { SerializedValue, SerializationBudget, Truncation } from '@ng-agent/protocol';

export const DEFAULT_BUDGET: SerializationBudget = {
  maxDepth: 6, maxArrayLength: 100, maxStringLength: 10_000,
  maxProperties: 500, maxTotalBytes: 1_000_000, redact: [],
};

export interface SerializationResult { value: SerializedValue; truncations: Truncation[] }

const shouldRedact = (path: string, patterns: string[]) => patterns.some(pattern => {
  if (pattern === path) return true;
  if (pattern.endsWith('.*')) return path.startsWith(pattern.slice(0, -1));
  return false;
});

export function serialize(value: unknown, options: Partial<SerializationBudget> = {}, initialPath = ''): SerializationResult {
  const budget = { ...DEFAULT_BUDGET, ...options };
  const truncations: Truncation[] = [];
  const seen = new WeakSet<object>();
  let properties = 0;
  let bytes = 0;
  const addBytes = (input: string) => { bytes += new TextEncoder().encode(input).byteLength; };

  const visit = (input: unknown, path: string, depth: number): SerializedValue => {
    if (shouldRedact(path, budget.redact)) {
      truncations.push({ path, reason: 'redacted' }); addBytes('[REDACTED]'); return '[REDACTED]';
    }
    if (bytes >= budget.maxTotalBytes) {
      truncations.push({ path, reason: 'budget' }); return '[TRUNCATED]';
    }
    if (input === null || typeof input === 'boolean') { addBytes(String(input)); return input; }
    if (typeof input === 'number') { addBytes(String(input)); return Number.isFinite(input) ? input : String(input); }
    if (typeof input === 'string') {
      addBytes(input);
      if (input.length > budget.maxStringLength) {
        truncations.push({ path, reason: 'string-length', originalSize: input.length });
        return input.slice(0, budget.maxStringLength);
      }
      return input;
    }
    if (typeof input === 'bigint') return `${String(input)}n`;
    if (typeof input === 'undefined') return '[undefined]';
    if (typeof input === 'symbol') return String(input);
    if (typeof input === 'function') return `[Function ${(input as { name?: string }).name || 'anonymous'}]`;
    if (depth >= budget.maxDepth) {
      truncations.push({ path, reason: 'depth' }); return '[MaxDepth]';
    }
    if (seen.has(input as object)) {
      truncations.push({ path, reason: 'unsupported' }); return '[Circular]';
    }
    seen.add(input as object);
    try {
      if (input instanceof Date) return input.toISOString();
      if (input instanceof Error) return { name: input.name, message: input.message };
      if (Array.isArray(input)) {
        const items = input.slice(0, budget.maxArrayLength).map((item, index) => visit(item, `${path}.${index}`, depth + 1));
        if (input.length > items.length) truncations.push({ path, reason: 'array-length', originalSize: input.length });
        return items;
      }
      const output: Record<string, SerializedValue> = {};
      for (const key of Object.keys(input as object)) {
        if (properties++ >= budget.maxProperties) { truncations.push({ path, reason: 'budget' }); break; }
        addBytes(key);
        const childPath = path ? `${path}.${key}` : key;
        try {
          const descriptor = Object.getOwnPropertyDescriptor(input as object, key);
          if (descriptor?.get) { output[key] = '[Getter]'; truncations.push({ path: childPath, reason: 'unsupported' }); continue; }
          output[key] = visit(descriptor && 'value' in descriptor ? descriptor.value : '[Unavailable]', childPath, depth + 1);
        }
        catch { output[key] = '[Getter threw]'; }
      }
      return output;
    } finally { seen.delete(input as object); }
  };
  return { value: visit(value, initialPath, 0), truncations };
}
