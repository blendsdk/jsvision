/**
 * Specification tests (immutable oracles) — the read-only `EditableDataGrid<T>` container. It renders
 * `format(value)` cells over a `GridDataSource<T>` via the column adapter, renders identically from an
 * in-memory source and a windowed double (source-agnostic), and inherits the engine's sanitize
 * boundary so a control-byte cell value never reaches the frame as a raw escape.
 *
 * Expectations derive from the requirements, never the implementation.
 */
import { test, expect, vi } from 'vitest';
import { Group, Input, createEventLoop, createRenderRoot, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import type { GridDataSource } from '../src/data-source.js';
import type { OnCommit } from '../src/commit.js';
import { EditableDataGrid } from '../src/grid.js';
import { windowedSource } from './fixtures/windowed-source.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

interface Row {
  id: number;
  balance: number;
}
const data: Row[] = [
  { id: 1, balance: 1000 },
  { id: 2, balance: 9 },
];

const W = 22;
const H = 6;

/** Render a grid over `source` and return one string per screen row. */
function rowTexts(source: GridDataSource<Row>): string[] {
  const columns = [
    column({
      id: 'balance',
      title: 'Balance',
      value: (r: Row) => r.balance,
      format: (v) => eur.format(v),
      align: 'right',
    }),
  ];
  const grid = new EditableDataGrid<Row>({ columns, source });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const render = createRenderRoot({ width: W, height: H }, { caps });
  render.mount(root);
  const buf = render.buffer();
  const out: string[] = [];
  for (let y = 0; y < H; y += 1) {
    let s = '';
    for (let x = 0; x < W; x += 1) s += buf.get(x, y)?.char ?? ' ';
    out.push(s);
  }
  return out;
}

// ST-10 — the container renders the formatted display string, and the header shows the column title.
test('should render the formatted value cells and the header title', () => {
  const texts = rowTexts(fromRows(signal(data), { rowKey: (r) => r.id }));
  expect(texts[0]).toContain('Balance'); // the header title
  const body = texts.slice(1).join('\n');
  expect(body).toContain('€'); // the euro sign proves format() ran
  expect(body).not.toContain('1000'); // the raw numeric value never appears
});

// ST-10 + ST-7 — the same container code path renders identically from a windowed double.
test('should render identically from a windowed double over the same rows', () => {
  const inMemory = rowTexts(fromRows(signal(data), { rowKey: (r) => r.id }));
  const windowed = rowTexts(windowedSource(data, (r) => r.id));
  expect(windowed).toEqual(inMemory);
});

// ST-11 — a control-byte cell value reaches the screen through the engine's sanitize path, so the
// frame carries no raw ESC/BEL.
test('should sanitize a control-byte cell value (no raw ESC/BEL in the frame)', () => {
  interface Labelled {
    id: number;
    label: string;
  }
  const rows = signal<Labelled[]>([{ id: 1, label: '\x1b[31mX\x07' }]);
  const columns = [column({ id: 'label', title: 'L', value: (r: Labelled) => r.label })];
  const grid = new EditableDataGrid<Labelled>({ columns, source: fromRows(rows, { rowKey: (r) => r.id }) });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const render = createRenderRoot({ width: W, height: H }, { caps });
  render.mount(root);

  const buf = render.buffer();
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const ch = buf.get(x, y)?.char ?? '';
      expect(ch).not.toBe('\x1b');
      expect(ch).not.toBe('\x07');
    }
  }
  expect(render.serialize()).not.toContain('\x07'); // BEL is never legitimately emitted
});

// ---- Container integration (Phase 5): the container owns the cursor, threads onCommit, exposes isDirty ----

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function key(k: string) {
  return { type: 'key' as const, key: k, ctrl: false, alt: false, shift: false };
}

interface Person {
  id: number;
  name: string;
}

/** A promise-returning onCommit whose resolution the test controls (a deferred veto). */
function deferredCommit(): { spy: OnCommit<Person>; resolve: (v: boolean) => void } {
  let resolve!: (v: boolean) => void;
  const promise = new Promise<boolean>((r) => {
    resolve = r;
  });
  return { spy: vi.fn<OnCommit<Person>>(() => promise), resolve };
}

/** Build an editable container over a fresh copy of `people`, focus its body, and return the handles. */
function buildEditable(opts: { onCommit?: OnCommit<Person> } = {}) {
  const rows = signal<Person[]>([
    { id: 1, name: 'Ada' },
    { id: 2, name: 'Bo' },
  ]);
  const columns = [
    column<Person, string>({
      id: 'name',
      title: 'Name',
      value: (r) => r.name,
      parse: (t) => t,
      set: (r, v) => {
        r.name = v;
      },
      width: 8,
    }),
  ];
  const grid = new EditableDataGrid<Person>({
    columns,
    source: fromRows(rows, { rowKey: (r) => r.id }),
    onCommit: opts.onCommit,
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows); // focus the body renderer, not the Group
  return { grid, loop, rows };
}

/** The characters painted on each screen row of the loop's frame. */
function frameRows(loop: ReturnType<typeof buildEditable>['loop']): string[] {
  const buf = loop.renderRoot.buffer();
  const out: string[] = [];
  for (let y = 0; y < H; y += 1) {
    let s = '';
    for (let x = 0; x < W; x += 1) s += buf.get(x, y)?.char ?? ' ';
    out.push(s);
  }
  return out;
}

// AC-5 / AC-3 end-to-end — an edit committed through the container calls the container's onCommit once
// with the full change, writes the record, and repaints the new value via the container's version bump.
test('threads onCommit through the container and repaints the committed value', async () => {
  const spy = vi.fn<OnCommit<Person>>(() => true);
  const { loop, rows } = buildEditable({ onCommit: spy });
  loop.dispatch(key('f2'));
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set('Zed');
  loop.dispatch(key('enter'));
  await tick();
  loop.renderRoot.flush();
  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy.mock.calls[0][0]).toMatchObject({ rowKey: 1, columnId: 'name', value: 'Zed', previous: 'Ada' });
  expect(rows()[0].name).toBe('Zed'); // set() wrote the record
  expect(frameRows(loop).slice(1).join('\n')).toContain('Zed'); // repainted on the now-unfocused row 0
});

// AC-3 end-to-end — Enter commits and advances the cursor to the next row, keeping the column: a second
// begin-edit seeds from the next row's value.
test('Enter commits and advances to the next row through the container', async () => {
  const { loop } = buildEditable(); // no onCommit → commits
  loop.dispatch(key('f2'));
  let editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set('Zed');
  loop.dispatch(key('enter'));
  await tick();
  loop.dispatch(key('f2')); // the cursor advanced to row 1
  editor = loop.getFocused();
  expect(editor).toBeInstanceOf(Input);
  if (editor instanceof Input) expect(editor.getValueSignal()()).toBe('Bo'); // seeded from row 1
});

// AC-7 end-to-end — the container's isDirty/isRowDirty/isGridDirty report a cell pending across a
// deferred async commit and clear once it resolves.
test('exposes isDirty / isRowDirty / isGridDirty across a pending async commit', async () => {
  const { spy, resolve } = deferredCommit();
  const { grid, loop } = buildEditable({ onCommit: spy });
  expect(grid.isGridDirty()).toBe(false);
  expect(grid.isDirty(1, 'name')).toBe(false);
  loop.dispatch(key('f2'));
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set('X');
  loop.dispatch(key('enter'));
  await tick();
  expect(grid.isDirty(1, 'name')).toBe(true);
  expect(grid.isRowDirty(1)).toBe(true);
  expect(grid.isGridDirty()).toBe(true);
  resolve(true);
  await tick();
  expect(grid.isDirty(1, 'name')).toBe(false);
  expect(grid.isRowDirty(1)).toBe(false);
  expect(grid.isGridDirty()).toBe(false);
});
