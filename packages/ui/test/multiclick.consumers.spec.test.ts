/**
 * Specification tests (immutable oracles) — row-family double-click activation (double-click-
 * activation FR-3/FR-4/FR-5/FR-7, AR-5/AR-6/AR-7/AR-10/AR-15). Consumers of the loop primitive.
 *
 * Driven through a real `createEventLoop` with an injected `now` clock: two same-cell `down`s within
 * the 500ms window register as a double-click (`clickCount === 2`) and activate the row; a lone
 * `down` (`clickCount === 1`) focuses + selects only. TV oracle: `TListViewer::handleEvent`
 * (`tlstview.cpp:271-277` — `meDoubleClick` ⇒ `selectItem`) and `TOutlineViewer::handleEvent`
 * (`toutline.cpp:465-472` — `meDoubleClick` ⇒ `selected`; single graph-zone click ⇒ toggle; single
 * text click ⇒ nothing). Expectations derive from those decodes + the FR/AR, never from the
 * implementation. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent as CoreMouseEvent } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext, DispatchEvent } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { ListView } from '../src/list/index.js';
import { DataGrid } from '../src/table/index.js';
import type { Column } from '../src/table/index.js';
import { Tree } from '../src/tree/index.js';
import type { TreeNode } from '../src/tree/index.js';
import { flattenVisible } from '../src/tree/graph.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function mouseDown(x: number, y: number): CoreMouseEvent {
  return { type: 'mouse', kind: 'down', button: 0, x, y };
}
function node<T>(value: T, children: TreeNode<T>[] = []): TreeNode<T> {
  return { value, children };
}

/** A post-process spy recording every command dispatched on the tick. */
class CommandSpy extends View {
  override postProcess = true;
  readonly commands: string[] = [];
  draw(_ctx: DrawContext): void {}
  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'command') this.commands.push(ev.event.command);
  }
}

/** A clock cell whose value the test advances between dispatches. */
function clockOf(box: { t: number }) {
  return () => box.t;
}

// ── ST-5 / FR-3 — ListRows: double-click activates; single click focuses + selects only ───────────
test('ST-5: ListRows double-click activates (onSelect + emit once); single click does not', () => {
  const box = { t: 0 };
  const items = signal(['Alpha', 'Bravo', 'Charlie', 'Delta']);
  const focused = signal(0);
  const selected = signal(-1);
  const picks: Array<{ index: number; item: string }> = [];
  const list = new ListView<string>({
    items,
    getText: (s) => s,
    focused,
    selected,
    command: 'chosen',
    onSelect: (index, item) => picks.push({ index, item }),
  });
  list.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 20, height: 6 } };
  const spy = new CommandSpy();
  const root = new Group();
  root.add(list);
  root.add(spy);
  const loop = createEventLoop({ width: 20, height: 6 }, { caps, now: clockOf(box) });
  loop.mount(root);
  loop.focusView(list.rows);

  // Double-click row 0: two same-cell downs at 1-based (1,1) → view-local (0,0) → item 0.
  box.t = 0;
  loop.dispatch(mouseDown(1, 1));
  box.t = 100;
  loop.dispatch(mouseDown(1, 1));

  expect(picks).toEqual([{ index: 0, item: 'Alpha' }]); // onSelect fired exactly once (on the 2nd down)
  expect(spy.commands.filter((c) => c === 'chosen')).toHaveLength(1); // command emitted exactly once

  // A later single click on row 2 focuses + selects but does NOT activate (no new onSelect/emit).
  box.t = 1000; // well past the window ⇒ clickCount resets to 1
  loop.dispatch(mouseDown(1, 3)); // 1-based (1,3) → local (0,2) → item 2
  expect(focused()).toBe(2);
  expect(selected()).toBe(2);
  expect(picks).toHaveLength(1); // unchanged — a single click never activates
  expect(spy.commands.filter((c) => c === 'chosen')).toHaveLength(1);
});

// ── ST-6 / FR-4 — GridRows (DataGrid): double-click activates; single click does not ──────────────
test('ST-6: GridRows double-click activates once; single click focuses + selects only', () => {
  const box = { t: 0 };
  interface Person {
    name: string;
    age: number;
  }
  const rows = signal<Person[]>([
    { name: 'P0', age: 20 },
    { name: 'P1', age: 21 },
    { name: 'P2', age: 22 },
  ]);
  const columns: Column<Person>[] = [
    { title: 'Name', accessor: (p) => p.name, width: 8 },
    { title: 'Age', accessor: (p) => String(p.age), width: '1fr' },
  ];
  const focused = signal(0);
  const selected = signal(-1);
  const picks: Array<{ index: number; name: string }> = [];
  const grid = new DataGrid<Person>({
    rows,
    columns,
    focused,
    selected,
    command: 'grid-open',
    onSelect: (index, row) => picks.push({ index, name: row.name }),
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 20, height: 8 } };
  const spy = new CommandSpy();
  const root = new Group();
  root.add(grid);
  root.add(spy);
  const loop = createEventLoop({ width: 20, height: 8 }, { caps, now: clockOf(box) });
  loop.mount(root);
  loop.focusView(grid.rows);

  // Data row 0 sits below the sticky header: screen y=1 (1-based (1,2)) ⇒ body-local row 0.
  box.t = 0;
  loop.dispatch(mouseDown(1, 2));
  box.t = 100;
  loop.dispatch(mouseDown(1, 2));

  expect(picks).toEqual([{ index: 0, name: 'P0' }]);
  expect(spy.commands.filter((c) => c === 'grid-open')).toHaveLength(1);

  // Single click on data row 1 (screen y=2) → focus + select only.
  box.t = 1000;
  loop.dispatch(mouseDown(1, 3));
  expect(focused()).toBe(1);
  expect(selected()).toBe(1);
  expect(picks).toHaveLength(1);
});

// ── ST-7 / FR-5 — TreeRows fidelity: text single click = focus only (no emit); text double click =
// activate; graph-zone single click = toggle; graph-zone double click = toggle (accepted AR-15
// deviation, no activate/emit). ───────────────────────────────────────────────────────────────────
test('ST-7: TreeRows — text single click focuses only, no emit (TV toutline.cpp:465)', () => {
  const box = { t: 0 };
  const focused = signal(0);
  const selected = signal(-1);
  const roots = signal<TreeNode<string>[]>([node('A', [node('A1'), node('A2')])]);
  const tree = new Tree<string>({ roots, getText: (v) => v, focused, selected, command: 'open' });
  tree.expand(roots()[0]); // flatten = [A, A1, A2]
  tree.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 20, height: 10 } };
  const spy = new CommandSpy();
  const root = new Group();
  root.add(tree);
  root.add(spy);
  const loop = createEventLoop({ width: 20, height: 10 }, { caps, now: clockOf(box) });
  loop.mount(root);
  loop.focusView(tree.rows);

  // Single click on A1's TEXT (1-based (7,2) → local (6,1), x=6 ≥ graphWidth(1)=6) → focus only.
  box.t = 0;
  loop.dispatch(mouseDown(7, 2));
  expect(focused()).toBe(1);
  expect(selected()).toBe(-1); // NOT selected — the non-TV single-click emit is dropped (AR-5)
  expect(spy.commands).not.toContain('open');
});

test('ST-7: TreeRows — text double click activates (select + emit once)', () => {
  const box = { t: 0 };
  const focused = signal(0);
  const selected = signal(-1);
  const roots = signal<TreeNode<string>[]>([node('A', [node('A1'), node('A2')])]);
  const tree = new Tree<string>({ roots, getText: (v) => v, focused, selected, command: 'open' });
  tree.expand(roots()[0]);
  tree.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 20, height: 10 } };
  const spy = new CommandSpy();
  const root = new Group();
  root.add(tree);
  root.add(spy);
  const loop = createEventLoop({ width: 20, height: 10 }, { caps, now: clockOf(box) });
  loop.mount(root);
  loop.focusView(tree.rows);

  box.t = 0;
  loop.dispatch(mouseDown(7, 2)); // 1st text down on A1
  box.t = 100;
  loop.dispatch(mouseDown(7, 2)); // 2nd → clickCount 2 → activate

  expect(selected()).toBe(1);
  expect(spy.commands.filter((c) => c === 'open')).toHaveLength(1);
});

test('ST-7: TreeRows — graph-zone single click toggles; double click still just toggles (AR-15)', () => {
  const box = { t: 0 };
  const focused = signal(0);
  const selected = signal(-1);
  const a = node('A', [node('A1'), node('A2')]);
  const roots = signal<TreeNode<string>[]>([a]);
  const tree = new Tree<string>({ roots, getText: (v) => v, focused, selected, command: 'open' });
  tree.expand(a); // start expanded ⇒ flatten = [A, A1, A2]
  tree.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 20, height: 10 } };
  const spy = new CommandSpy();
  const root = new Group();
  root.add(tree);
  root.add(spy);
  const loop = createEventLoop({ width: 20, height: 10 }, { caps, now: clockOf(box) });
  loop.mount(root);
  loop.focusView(tree.rows);

  // `flatten` is a protected internal of `TreeRows` — recompute the same visible-row list from the
  // public pieces (the roots signal this test already holds + the public `isExpanded`).
  const flatLen = () => flattenVisible(roots(), (n) => tree.isExpanded(n)).length;
  expect(flatLen()).toBe(3); // expanded

  // Single graph-zone click on A (1-based (1,1) → local (0,0), x=0 < graphWidth(0)=3) → collapse.
  box.t = 0;
  loop.dispatch(mouseDown(1, 1));
  expect(flatLen()).toBe(1); // collapsed (A only)
  expect(selected()).toBe(-1); // no activate
  expect(spy.commands).not.toContain('open');

  // A graph-zone DOUBLE click toggles twice (re-expand then re-collapse), never activating — the
  // accepted AR-15 deviation (our two-down model already toggled on the first down).
  box.t = 100;
  loop.dispatch(mouseDown(1, 1)); // toggle → expand (flatten 3)
  box.t = 150;
  loop.dispatch(mouseDown(1, 1)); // toggle → collapse (flatten 1)
  expect(flatLen()).toBe(1);
  expect(selected()).toBe(-1); // still no activate on a graph-zone double click
  expect(spy.commands).not.toContain('open');
});

// ── ST-9 / FR-7 — ComboBox: single-click pick + close is unchanged; a double-click does not
// double-fire or reopen (the 2nd down lands after the popup closed). ─────────────────────────────
test('ST-9: ComboBox popup — a double-click picks once and does not reopen (AR-10)', async () => {
  const { ComboBox } = await import('../src/dropdown/index.js');
  const box = { t: 0 };
  const value = signal<string | null>(null);
  const combo = new ComboBox<string>({
    items: signal(['Red', 'Green', 'Blue']),
    getText: (s) => s,
    value,
    editable: false,
  });
  combo.layout = { position: 'absolute', rect: { x: 5, y: 3, width: 14, height: 1 } };
  const overlay = new Group();
  overlay.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 20 } };
  overlay.state.visible = false;
  const root = new Group();
  root.add(combo);
  root.add(overlay);
  const loop = createEventLoop({ width: 40, height: 20 }, { caps, now: clockOf(box) });
  loop.mount(root);
  loop.popupHost = { overlay, focusView: (v) => loop.focusView(v), getFocused: () => loop.getFocused() };

  // Open the popup (Alt+Down); the list mounts into the overlay, focus on row 0.
  loop.focusView(combo.input);
  loop.dispatch({ type: 'key', key: 'down', ctrl: false, alt: true, shift: false } as KeyEvent);
  const list = overlay.children
    .filter((c): c is Group => c instanceof Group)
    .flatMap((f) => f.children)
    .find((c): c is InstanceType<typeof ListView> => c instanceof ListView);
  expect(list).toBeDefined();
  const origin = loop.renderRoot.originOf(list!.rows);
  expect(origin).not.toBeNull();

  // Double-click popup row 0 (screen origin, 1-based). The FIRST down sets `selected` → the combo
  // picks + closes; the 2nd down lands on the now-closed popup and is inert.
  const cx = origin!.x + 2; // text column (1-based), inside row 0
  const cy = origin!.y + 1; // row 0 (1-based)
  box.t = 0;
  loop.dispatch(mouseDown(cx, cy));
  box.t = 100;
  loop.dispatch(mouseDown(cx, cy));

  expect(value()).toBe('Red'); // picked exactly the clicked row
  expect(overlay.state.visible).toBe(false); // popup closed — not reopened by the 2nd down
});
