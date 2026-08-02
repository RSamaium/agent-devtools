import type { RuntimeRef, SerializedValue, Snapshot } from '@ng-agent/protocol';

export interface DiffEntry {
  operation: 'added' | 'removed' | 'changed';
  path: string;
  before?: SerializedValue;
  after?: SerializedValue;
  ref?: RuntimeRef;
}
export interface SnapshotDiff { from: string; to: string; entries: DiffEntry[] }

const stable = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => {
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
  }
  return item;
});

export function diffSnapshots(before: Snapshot, after: Snapshot): SnapshotDiff {
  const entries: DiffEntry[] = [];
  const domains = ['components', 'directives', 'injectors', 'providers', 'signals', 'forms', 'signalForms', 'stores'] as const;
  for (const domain of domains) {
    const previous = new Map(before[domain].map(item => [item.ref.id, item]));
    const next = new Map(after[domain].map(item => [item.ref.id, item]));
    for (const [id, item] of previous) {
      const current = next.get(id);
      if (!current) entries.push({ operation: 'removed', path: `${domain}.${id}`, before: item as unknown as SerializedValue, ref: item.ref });
      else if (stable(item) !== stable(current)) entries.push({ operation: 'changed', path: `${domain}.${id}`, before: item as unknown as SerializedValue, after: current as unknown as SerializedValue, ref: current.ref });
    }
    for (const [id, item] of next) if (!previous.has(id)) entries.push({ operation: 'added', path: `${domain}.${id}`, after: item as unknown as SerializedValue, ref: item.ref });
  }
  if (stable(before.router) !== stable(after.router)) entries.push({ operation: 'changed', path: 'router', before: (before.router ?? null) as unknown as SerializedValue, after: (after.router ?? null) as unknown as SerializedValue });
  return { from: before.id, to: after.id, entries };
}
