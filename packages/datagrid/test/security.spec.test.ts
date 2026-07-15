/**
 * Specification test (immutable oracle) — `@jsvision/datagrid` ships no dynamic-code-execution sink:
 * the package source contains no `eval(`, `new Function(`, or dynamic `require(` call. There is no
 * user-supplied-code path in the grid, so a static source scan is a sufficient guarantee.
 */
import { test, expect, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Group, Input, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import type { GridDataSource } from '../src/data-source.js';
import type { SortKey } from '../src/sort.js';
import type { OnCommit } from '../src/commit.js';
import { EditableDataGrid } from '../src/grid.js';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..', 'src');

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function key(k: string) {
  return { type: 'key' as const, key: k, ctrl: false, alt: false, shift: false };
}

/** Recursively list every `.ts` source file under a directory. */
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

// No dynamic-code-execution sink anywhere in the package source.
test('should contain no eval / new Function / dynamic require in package source', () => {
  const forbidden = [/\beval\s*\(/, /\bnew\s+Function\s*\(/, /\brequire\s*\(/];
  const files = tsFiles(srcDir);
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const re of forbidden) {
      expect(re.test(text), `${file} must not match ${re}`).toBe(false);
    }
  }
});

const W = 16;
const H = 5;

interface Person {
  id: number;
  name: string;
}

// ST-11 — a control-byte value committed through the editor is stored raw in memory but never reaches
// the frame as a raw ESC/BEL (it passes the engine's sanitize boundary), and the ONLY record mutation
// is through the onCommit/set path (a spy confirms no out-of-band persistence).
test('should sanitize a control-byte edit at the frame and mutate only via onCommit', async () => {
  const rows = signal<Person[]>([{ id: 1, name: 'Ada' }]);
  const spy = vi.fn<OnCommit<Person>>(() => true);
  const columns = [
    column<Person, string>({
      id: 'name',
      title: 'Name',
      value: (r) => r.name,
      parse: (t) => t,
      set: (r, v) => {
        r.name = v;
      },
      width: 10,
    }),
  ];
  const grid = new EditableDataGrid<Person>({
    columns,
    source: fromRows(rows, { rowKey: (r) => r.id }),
    onCommit: spy,
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);

  loop.dispatch(key('f2'));
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set('\x1b[31mX\x07'); // an ESC/BEL-laden value
  loop.dispatch(key('enter'));
  await tick();
  loop.renderRoot.flush();

  // The commit seam is the only mutation path (no direct write behind the model's back).
  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy.mock.calls[0][0]).toMatchObject({ rowKey: 1, columnId: 'name', value: '\x1b[31mX\x07' });
  expect(rows()[0].name).toBe('\x1b[31mX\x07'); // stored raw in memory (the model is untouched by rendering)

  // …but nothing reaches the terminal unsanitized: no buffer cell holds a raw ESC/BEL glyph, and BEL —
  // which is never legitimately emitted — is absent from the serialized frame.
  const buf = loop.renderRoot.buffer();
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const ch = buf.get(x, y)?.char ?? '';
      expect(ch).not.toBe('\x1b');
      expect(ch).not.toBe('\x07');
    }
  }
  expect(loop.renderRoot.serialize()).not.toContain('\x07');
});

interface Cust {
  id: number;
  customerId: string;
}

// ST-11(a) — a lookup provider's label carrying control bytes is sanitized at the frame: opening the
// dropdown (wired popupHost) and rendering the row never puts a raw ESC/BEL in the buffer or the frame.
test('ST-11: a lookup label with control bytes renders sanitized at the frame', async () => {
  const LW = 20;
  const LH = 10;
  const rows = signal<Cust[]>([{ id: 1, customerId: '' }]);
  const columns = [
    column<Cust, string>({
      id: 'customerId',
      title: 'Customer',
      value: (r) => r.customerId,
      parse: (t) => t,
      set: (r, v) => {
        r.customerId = v;
      },
      width: 14,
      editor: { kind: 'lookup', items: async () => [{ key: '7', label: 'A\x1b[31mB\x07' }] },
    }),
  ];
  const grid = new EditableDataGrid<Cust>({ columns, source: fromRows(rows, { rowKey: (r) => r.id }) });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: LW, height: LH } };
  const overlay = new Group();
  overlay.layout = { position: 'absolute', rect: { x: 0, y: 0, width: LW, height: LH } };
  overlay.state.visible = false;
  const root = new Group();
  root.add(grid);
  root.add(overlay);
  const loop = createEventLoop({ width: LW, height: LH }, { caps });
  loop.mount(root);
  loop.popupHost = { overlay, focusView: (v) => loop.focusView(v), getFocused: () => loop.getFocused() };
  loop.focusView(grid.rows);

  loop.dispatch(key('f4')); // begin edit + open the value-help dropdown
  await tick(); // the async provider resolves → the malicious label populates the list
  loop.renderRoot.flush();

  const buf = loop.renderRoot.buffer();
  for (let y = 0; y < LH; y += 1) {
    for (let x = 0; x < LW; x += 1) {
      const ch = buf.get(x, y)?.char ?? '';
      expect(ch).not.toBe('\x1b');
      expect(ch).not.toBe('\x07');
    }
  }
  expect(loop.renderRoot.serialize()).not.toContain('\x07');
});

interface Q {
  id: number;
  qty: string;
}

// ST-11(b) — an integer editor's keystroke filter rejects a non-conforming character before commit, so
// the committed value is filter-conformant (the commit-time valid() gate is a later concern).
test('ST-11: an integer keystroke filter rejects a letter before commit', async () => {
  const rows = signal<Q[]>([{ id: 1, qty: '5' }]);
  const spy = vi.fn<OnCommit<Q>>(() => true);
  const columns = [
    column<Q, string>({
      id: 'qty',
      title: 'Qty',
      value: (r) => r.qty,
      parse: (t) => t,
      set: (r, v) => {
        r.qty = v;
      },
      width: 8,
      editor: { kind: 'integer' },
    }),
  ];
  const grid = new EditableDataGrid<Q>({ columns, source: fromRows(rows, { rowKey: (r) => r.id }), onCommit: spy });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);

  loop.dispatch(key('f2')); // begin edit (seed '5')
  loop.dispatch(key('a')); // a letter — rejected by filter('0-9-')
  loop.dispatch(key('9')); // a digit — accepted
  loop.dispatch(key('enter'));
  await tick();

  expect(spy).toHaveBeenCalledTimes(1);
  const committed = String(spy.mock.calls[0][0].value);
  expect(committed).not.toContain('a'); // the letter never entered the buffer
  expect(/^[0-9-]*$/.test(committed)).toBe(true); // filter-conformant
});

interface Ctl {
  id: number;
  v: number;
}

/** Assert no buffer cell holds a raw ESC/BEL and the serialized frame has no BEL. */
function expectNoControlBytes(loop: ReturnType<typeof createEventLoop>): void {
  const buf = loop.renderRoot.buffer();
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const ch = buf.get(x, y)?.char ?? '';
      expect(ch).not.toBe('\x1b');
      expect(ch).not.toBe('\x07');
    }
  }
  expect(loop.renderRoot.serialize()).not.toContain('\x07');
}

// ST-17 — a column `format` that emits ESC/BEL is sanitized at the frame: the control bytes flow
// through the accessor/alignCell paint path but never reach a buffer cell or the serialized output.
test('ST-17: a format result with control bytes renders sanitized at the frame', () => {
  const rows = signal<Ctl[]>([{ id: 1, v: 1 }]);
  const columns = [
    column<Ctl, number>({
      id: 'v',
      title: 'V',
      value: (r) => r.v,
      format: () => '\x1b[31mX\x07', // a formatter emitting a raw ESC + BEL
      width: 12,
    }),
  ];
  const grid = new EditableDataGrid<Ctl>({ columns, source: fromRows(rows, { rowKey: (r) => r.id }) });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  expectNoControlBytes(loop);
});

// ST-18 — a custom `render` hook that writes ESC/BEL is sanitized at the frame: the cell-local ctx
// still funnels through the engine's buffer-write sanitize boundary, so no raw control byte lands.
test('ST-18: a render hook writing control bytes renders sanitized at the frame', () => {
  const rows = signal<Ctl[]>([{ id: 1, v: 1 }]);
  const columns = [
    column<Ctl, number>({
      id: 'v',
      title: 'V',
      value: (r) => r.v,
      width: 12,
      render: (ctx) => ctx.text(0, 0, '\x1b[31mX\x07', { fg: 'brightRed', bg: 'cyan' }),
    }),
  ];
  const grid = new EditableDataGrid<Ctl>({ columns, source: fromRows(rows, { rowKey: (r) => r.id }) });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  expectNoControlBytes(loop);
});

interface Sale {
  region: string;
  qty: number;
}

// ST-21 — an unknown sort `columnId` is ignored by the sort API (no state change) and is never
// forwarded to a push-down source's `setSort` query. Structured `SortKey[]` only — never raw SQL.
test('ST-21: an unknown sort columnId is a no-op and never reaches a push-down setSort', () => {
  const setSort = vi.fn<(keys: SortKey[]) => void>();
  const source: GridDataSource<Sale> = {
    rowKey: (r) => r.region,
    length: () => 1,
    rowAt: () => ({ region: 'east', qty: 1 }),
    setSort,
  };
  const columns = [
    column<Sale, string>({ id: 'region', title: 'Region', value: (r) => r.region }),
    column<Sale, number>({ id: 'qty', title: 'Qty', value: (r) => r.qty }),
  ];
  const grid = new EditableDataGrid<Sale>({ columns, source });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);

  grid.sortBy('nope'); // unknown via the single-key API
  grid.addSort('nope', 'desc'); // unknown via the multi-key API
  expect(grid.sort()).toEqual([]); // no state change

  // Every push-down call carries only known columns — the unknown id never reaches the query.
  for (const call of setSort.mock.calls) {
    expect(call[0].some((k) => k.columnId === 'nope')).toBe(false);
  }
});
