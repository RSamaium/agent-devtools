import type { QueryResult, SerializedValue, Snapshot, StructuredQuery } from '@ng-agent/protocol';

const flatten = <T extends { children?: T[] }>(items: T[]): T[] => items.flatMap(item => [item, ...flatten(item.children ?? [])]);

function getPath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => current && typeof current === 'object' ? (current as Record<string, unknown>)[segment] : undefined, value);
}

function matches(item: unknown, where: Record<string, SerializedValue>): boolean {
  return Object.entries(where).every(([path, expected]) => {
    const actual = getPath(item, path);
    return typeof expected === 'string' && typeof actual === 'string'
      ? actual.toLocaleLowerCase().includes(expected.toLocaleLowerCase())
      : JSON.stringify(actual) === JSON.stringify(expected);
  });
}

export function querySnapshot(snapshot: Snapshot, query: StructuredQuery): QueryResult {
  const sources: Record<StructuredQuery['domain'], unknown[]> = {
    components: snapshot.components, directives: snapshot.directives, providers: snapshot.providers,
    signals: snapshot.signals, forms: snapshot.forms, 'signal-forms': snapshot.signalForms,
    fields: [...snapshot.signalForms.flatMap(form => flatten(form.fields)), ...snapshot.forms.flatMap(form => flatten([form.root]))], stores: snapshot.stores,
    routes: flatten(snapshot.router?.roots ?? []),
  };
  const filtered = sources[query.domain].filter(item => matches(item, query.where ?? {}));
  const offset = query.cursor ? Number.parseInt(query.cursor, 10) : 0;
  const limit = Math.min(query.limit ?? 100, 1_000);
  const items = filtered.slice(offset, offset + limit) as SerializedValue[];
  const nextOffset = offset + items.length;
  return { items, total: filtered.length, generation: snapshot.generation, ...(nextOffset < filtered.length ? { nextCursor: String(nextOffset) } : {}) };
}
