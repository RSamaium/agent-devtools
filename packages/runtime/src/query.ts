import type { QueryResult, SerializedValue, Snapshot, StructuredQuery } from '@agent-devtools/protocol';

const getPath = (value: unknown, path: string): unknown => path.split('.').reduce<unknown>((current, segment) => current && typeof current === 'object' ? (current as Record<string, unknown>)[segment] : undefined, value);
const matches = (item: unknown, where: Record<string, SerializedValue>): boolean => Object.entries(where).every(([path, expected]) => {
  const actual = getPath(item, path);
  return typeof expected === 'string' && typeof actual === 'string' ? actual.toLocaleLowerCase().includes(expected.toLocaleLowerCase()) : JSON.stringify(actual) === JSON.stringify(expected);
});

export function querySnapshot(snapshot: Snapshot, query: StructuredQuery): QueryResult {
  const domain = snapshot.domains[query.domain];
  if (!domain) return { items: [], total: 0, generation: snapshot.generation };
  const data = query.resource && domain.data && typeof domain.data === 'object' && !Array.isArray(domain.data)
    ? (domain.data as Record<string, unknown>)[query.resource]
    : domain.data;
  const source = Array.isArray(data) ? data : data === undefined ? [] : [data];
  const filtered = source.filter(item => matches(item, query.where ?? {}));
  const offset = query.cursor ? Number.parseInt(query.cursor, 10) : 0; const limit = Math.min(query.limit ?? 100, 1_000);
  const items = filtered.slice(offset, offset + limit) as SerializedValue[]; const nextOffset = offset + items.length;
  return { items, total: filtered.length, generation: snapshot.generation, ...(nextOffset < filtered.length ? { nextCursor: String(nextOffset) } : {}) };
}
