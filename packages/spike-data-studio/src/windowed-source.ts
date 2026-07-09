/**
 * A windowed, server-paged dense-array source shared by the paging verdict (Probe 3b) and the scale
 * smoke (Probe 7). It presents a JS `Proxy` whose `length` is the full row count but which materialises
 * only the pages the grid actually touches — so the UNMODIFIED `DataGrid` can scroll a 100k-row table
 * without loading it. Integer-index accesses are counted (the paging-cost meter).
 */
import { signal } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';
import { selectPage } from './crud.js';

export type Row = Record<string, unknown>;

/** A windowed source over `schema.table`, ordered by `orderBy`, paged at `pageSize`. */
export class WindowedSource {
  readonly rowsSignal: Signal<Row[]>;
  private readonly store = new Map<number, Row[]>();
  private readonly inflight = new Set<number>();
  /** Integer-index gets since the last {@link resetCounters}. */
  accesses = 0;
  pagesFetched = 0;
  /** When false, a miss only counts + returns a placeholder (never fetches) — for scan-cost demos. */
  fetchOnMiss = true;

  constructor(
    readonly total: number,
    private readonly schema: string,
    private readonly table: string,
    private readonly orderBy: readonly string[],
    private readonly pageSize = 200,
  ) {
    this.rowsSignal = signal(this.makeProxy());
  }

  resetCounters(): void {
    this.accesses = 0;
    this.pagesFetched = 0;
  }

  /** Pages currently materialised in memory. */
  get pagesInMemory(): number {
    return this.store.size;
  }

  private placeholder(i: number): Row {
    return { __loading: true, id: i, label: '…', amount: '', flag: false, made_on: '' };
  }

  private rowAt(i: number): Row {
    const page = Math.floor(i / this.pageSize);
    const have = this.store.get(page);
    if (have) return have[i % this.pageSize] ?? this.placeholder(i);
    if (this.fetchOnMiss) void this.ensurePage(page);
    return this.placeholder(i);
  }

  private async ensurePage(page: number): Promise<void> {
    if (this.store.has(page) || this.inflight.has(page)) return;
    this.inflight.add(page);
    const res = await selectPage<Row>(this.schema, this.table, this.orderBy, this.pageSize, page * this.pageSize);
    this.store.set(page, res.rows);
    this.inflight.delete(page);
    this.pagesFetched += 1;
    this.rowsSignal.set(this.makeProxy()); // fresh identity → the grid's display-change bind repaints
  }

  /** Await any pages kicked off during the last compose. */
  async settle(): Promise<void> {
    for (let i = 0; i < 10 && this.inflight.size > 0; i++) await new Promise((r) => setTimeout(r, 10));
  }

  private makeProxy(): Row[] {
    const self = this;
    return new Proxy<Row[]>([], {
      get(target, prop, recv) {
        if (prop === 'length') return self.total;
        if (typeof prop === 'string' && /^\d+$/.test(prop)) {
          self.accesses += 1;
          return self.rowAt(Number(prop));
        }
        return Reflect.get(target, prop, recv);
      },
      has(target, prop) {
        if (prop === 'length') return true;
        if (typeof prop === 'string' && /^\d+$/.test(prop)) return Number(prop) < self.total;
        return Reflect.has(target, prop);
      },
    });
  }
}
