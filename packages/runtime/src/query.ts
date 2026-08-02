import type { QueryResult, SerializedValue, Snapshot, StructuredQuery } from '@ng-agent/protocol';

const getPath = (value: unknown, path: string): unknown => path.split('.').reduce<unknown>((current, segment) => current && typeof current === 'object' ? (current as Record<string, unknown>)[segment] : undefined, value);
const matches = (item: unknown, where: Record<string, SerializedValue>): boolean => Object.entries(where).every(([path, expected]) => {
  const actual = getPath(item, path);
  return typeof expected === 'string' && typeof actual === 'string' ? actual.toLocaleLowerCase().includes(expected.toLocaleLowerCase()) : JSON.stringify(actual) === JSON.stringify(expected);
});

export function querySnapshot(snapshot: Snapshot, query: StructuredQuery): QueryResult {
  const sources: Record<StructuredQuery['domain'], unknown[]> = {
    components: snapshot.components, directives: snapshot.directives, providers: snapshot.providers,
    signals: snapshot.signals, forms: snapshot.forms, 'signal-forms': snapshot.signalForms,
    fields: snapshot.signalForms.flatMap(form => form.fields), stores: snapshot.stores, routes: snapshot.router?.roots ?? [],
  };
  const filtered = sources[query.domain].filter(item => matches(item, query.where ?? {}));
  const offset = query.cursor ? Number.parseInt(query.cursor, 10) : 0; const limit = Math.min(query.limit ?? 100, 1_000);
  const items = filtered.slice(offset, offset + limit) as SerializedValue[]; const nextOffset = offset + items.length;
  return { items, total: filtered.length, generation: snapshot.generation, ...(nextOffset < filtered.length ? { nextCursor: String(nextOffset) } : {}) };
}
