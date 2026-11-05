// In-memory stand-in for the subset of the Dexie API that the sync layer uses
// (fake-indexeddb is not installed). Rows are cloned on the way in and out so
// tests see the same copy semantics as IndexedDB.
type Row = Record<string, unknown>;
type Pred = (r: Row) => boolean;

const clone = <T>(v: T): T => (v === undefined ? v : (structuredClone(v) as T));

class MemCollection {
  constructor(
    private table: MemTable,
    private preds: Pred[] = [],
    private max = Infinity,
  ) {}
  private rows(): Row[] {
    return this.table
      .all()
      .filter((r) => this.preds.every((p) => p(r)))
      .slice(0, this.max);
  }
  filter(fn: Pred) {
    return new MemCollection(this.table, [...this.preds, fn], this.max);
  }
  limit(n: number) {
    return new MemCollection(this.table, this.preds, n);
  }
  async toArray() {
    return this.rows().map(clone);
  }
  async count() {
    return this.rows().length;
  }
  async modify(patch: Row) {
    const rows = this.rows();
    for (const r of rows) Object.assign(r, clone(patch));
    return rows.length;
  }
  async delete() {
    const rows = this.rows();
    for (const r of rows) this.table.remove(r);
    return rows.length;
  }
}

export class MemTable {
  readonly map = new Map<unknown, Row>();
  private seq = 0;
  constructor(
    private pk: string,
    private auto = false,
  ) {}
  all(): Row[] {
    return [...this.map.values()];
  }
  remove(r: Row) {
    this.map.delete(r[this.pk]);
  }
  async get(key: unknown): Promise<Row | undefined> {
    return clone(this.map.get(key));
  }
  async bulkGet(keys: unknown[]): Promise<(Row | undefined)[]> {
    return keys.map((k) => clone(this.map.get(k)));
  }
  async put(row: Row) {
    const r = clone(row);
    if (this.auto && r[this.pk] == null) r[this.pk] = ++this.seq;
    this.map.set(r[this.pk], r);
    return r[this.pk];
  }
  async add(row: Row) {
    return this.put(row);
  }
  async bulkPut(rows: Row[]) {
    for (const r of rows) await this.put(r);
  }
  async delete(key: unknown) {
    this.map.delete(key);
  }
  async update(key: unknown, patch: Row) {
    const r = this.map.get(key);
    if (!r) return 0;
    Object.assign(r, clone(patch));
    return 1;
  }
  async count() {
    return this.map.size;
  }
  async toArray() {
    return this.all().map(clone);
  }
  async clear() {
    this.map.clear();
  }
  filter(fn: Pred) {
    return new MemCollection(this, [fn]);
  }
  where(field: string) {
    return {
      equals: (v: unknown) => new MemCollection(this, [(r) => r[field] === v]),
      anyOf: (vs: unknown[]) => new MemCollection(this, [(r) => vs.includes(r[field])]),
    };
  }
}

export interface MemDb {
  countryProgress: MemTable;
  gameSessions: MemTable;
  challengeAttempts: MemTable;
  unlocks: MemTable;
  meta: MemTable;
  outbox: MemTable;
  sync_meta: MemTable;
  concept_progress: MemTable;
  question_history: MemTable;
  daily_summary: MemTable;
  hardcore_progress: MemTable;
  transaction: (...args: unknown[]) => Promise<unknown>;
  close: () => void;
}

export function createMemDb(): MemDb {
  return {
    countryProgress: new MemTable("iso3"),
    gameSessions: new MemTable("id", true),
    challengeAttempts: new MemTable("id", true),
    unlocks: new MemTable("key"),
    meta: new MemTable("id"),
    outbox: new MemTable("id", true),
    sync_meta: new MemTable("key"),
    concept_progress: new MemTable("conceptId"),
    question_history: new MemTable("op_id"),
    daily_summary: new MemTable("dateKey"),
    hardcore_progress: new MemTable("continent"),
    // transaction(mode, ...tables, fn): runs fn directly (no isolation needed in tests).
    transaction: async (...args: unknown[]) => (args[args.length - 1] as () => unknown)(),
    close: () => {},
  };
}
