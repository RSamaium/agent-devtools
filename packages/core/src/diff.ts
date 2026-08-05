import type { RuntimeRef, SerializedValue, Snapshot } from '@agent-devtools/protocol';

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
  const domainIds = [...new Set([...Object.keys(before.domains), ...Object.keys(after.domains)])].sort();
  for (const id of domainIds) {
    const previous = before.domains[id]; const next = after.domains[id];
    if (!previous && next) entries.push({ operation: 'added', path: `domains.${id}`, after: next.data as SerializedValue });
    else if (previous && !next) entries.push({ operation: 'removed', path: `domains.${id}`, before: previous.data as SerializedValue });
    else if (previous && next && stable(previous.data) !== stable(next.data)) entries.push({ operation: 'changed', path: `domains.${id}`, before: previous.data as SerializedValue, after: next.data as SerializedValue });
  }
  return { from: before.id, to: after.id, entries };
}
