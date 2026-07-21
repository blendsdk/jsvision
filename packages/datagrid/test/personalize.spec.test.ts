/**
 * Specification tests (immutable oracle) — the grid read API the personalization dialog is built on:
 * `columns()` (the full reactive column-metadata list), `defaultColumnLayout()` (the construction-time
 * baseline for Reset), and `clearColumnWidth()` (return a column to auto width). The dialog and its
 * `personalizeGrid` helper add further cases to this file in later phases. Expectations derive from
 * the requirements + the 03-XX specs, never from the implementation.
 */
import { test, expect } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal, effect, createRoot, Commands } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import { personalizeGrid } from '../src/personalize.js';
import { createMemoryVariantStore } from '../src/variant-store.js';
import type { PersonalizeDialog } from '../src/personalize-dialog.js';
import type { GridVariant } from '../src/variant.js';

/** A fake execView-capable modal host that captures added/removed windows into a mounted root (the
 * form-dialog.spec pattern). The dialog runs in its own loop, independent of the grid's. */
function makeHost(w = 70, h = 24) {
  const root = new Group();
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  const added: View[] = [];
  const removed: View[] = [];
  const host = {
    loop,
    desktop: {
      addWindow: (v: View) => {
        added.push(v);
        root.add(v);
      },
      removeWindow: (v: View) => {
        removed.push(v);
        root.remove(v);
      },
      bounds: { x: 0, y: 0, width: w, height: h },
    },
  };
  return { loop, host, added, removed };
}

/** Open the dialog and hand back the live `PersonalizeDialog` (captured via the host's addWindow) plus
 * the pending result promise and the loop — the driving handle for the column-region oracles. */
function open(grid: EditableDataGrid<Emp>, store = createMemoryVariantStore()) {
  const { loop, host, added, removed } = makeHost();
  const result = personalizeGrid(grid, { store, host });
  const dlg = added[0] as unknown as PersonalizeDialog<Emp>;
  return { loop, dlg, result, added, removed, store };
}

const key = (k: string, mods: { alt?: boolean; shift?: boolean; ctrl?: boolean } = {}) => ({
  type: 'key' as const,
  key: k,
  ctrl: mods.ctrl ?? false,
  alt: mods.alt ?? false,
  shift: mods.shift ?? false,
});

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

interface Emp {
  id: number;
  name: string;
  dept: string;
  total: number;
  note: string;
  active: boolean;
}

const EMPS: Emp[] = [
  { id: 1, name: 'Ann', dept: 'Eng', total: 10, note: 'a', active: true },
  { id: 2, name: 'Bob', dept: 'Ops', total: 30, note: 'b', active: false },
  { id: 3, name: 'Cy', dept: 'Eng', total: 20, note: 'c', active: true },
];

const CONSTRUCTION_ORDER = ['id', 'name', 'dept', 'total', 'note', 'active'];

const COLS = () => [
  column<Emp, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 5 }),
  column<Emp, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 8 }),
  column<Emp, string>({ id: 'dept', title: 'Dept', value: (r) => r.dept, width: 8 }),
  column<Emp, number>({ id: 'total', title: 'Total', value: (r) => r.total, width: 6, minWidth: 4, maxWidth: 40 }),
  column<Emp, string>({ id: 'note', title: 'Note', value: (r) => r.note, width: 6 }),
  column<Emp, boolean>({ id: 'active', title: 'Active', value: (r) => r.active, width: 6 }),
];

/** Mount a fresh grid; `w` wide enough (default 50) that nothing over-pins, narrow to force over-pin. */
function buildGrid(w = 50, h = 8): EditableDataGrid<Emp> {
  const grid = new EditableDataGrid<Emp>({
    columns: COLS(),
    source: fromRows(signal(EMPS.slice()), { rowKey: (r) => r.id }),
  });
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  return grid;
}

// columns() returns one entry per column in the full construction/display order (hidden included),
// each carrying resolved id/title/visible/frozen/width.
test('columns() returns every column (hidden included) in full order with resolved metadata', () => {
  const grid = buildGrid();
  grid.setColumnVisible('dept', false); // hide one
  grid.setFrozen(['id'], []); // freeze one left
  grid.setColumnWidth('total', 22); // override one width (within [4,40])
  const cols = grid.columns();
  expect(cols.map((c) => c.id)).toEqual(CONSTRUCTION_ORDER); // full order, hidden interleaved in place
  const byId = new Map(cols.map((c) => [c.id, c]));
  expect(byId.get('dept')!.visible).toBe(false); // hidden
  expect(byId.get('name')!.visible).toBe(true);
  expect(byId.get('id')!.frozen).toBe('left'); // pinned left
  expect(byId.get('name')!.frozen).toBe('none');
  expect(byId.get('total')!.width).toBe(22); // overridden width, resolved
  expect(byId.get('id')!.title).toBe('ID'); // header title carried
});

// Reading columns() inside an effect re-runs on each layout change (reactive). Asserted per-change
// (the effect grew after every mutation), not by an exact total — the reactive graph may fan out
// more than one re-run per change, but the contract is only that each change re-runs it.
test('reading columns() inside an effect re-runs on each layout change', () => {
  const grid = buildGrid();
  const runs: number[] = [];
  const dispose = createRoot((d) => {
    effect(() => {
      runs.push(grid.columns().length); // reading establishes the reactive dependency
    });
    return d;
  });
  const afterMount = runs.length; // the effect ran on creation
  grid.setColumnVisible('note', false); // hide
  const afterHide = runs.length;
  grid.setColumnVisible('note', true); // show
  const afterShow = runs.length;
  grid.setFrozen(['id'], []); // freeze
  const afterFreeze = runs.length;
  grid.setColumnWidth('total', 15); // resize
  const afterResize = runs.length;
  dispose();
  expect(afterHide).toBeGreaterThan(afterMount); // hide re-ran the effect
  expect(afterShow).toBeGreaterThan(afterHide); // show re-ran the effect
  expect(afterFreeze).toBeGreaterThan(afterShow); // freeze re-ran the effect
  expect(afterResize).toBeGreaterThan(afterFreeze); // resize re-ran the effect
});

// columns() reports the RESOLVED freeze partition — an over-pinned column reads 'none', matching
// grid.frozen() membership exactly.
test("columns() reports the resolved freeze partition — an over-pinned column reads 'none'", () => {
  const grid = buildGrid(12); // narrow viewport
  grid.setFrozen(['id', 'name', 'dept'], []); // request more frozen width than fits
  const resolved = grid.frozen();
  const cols = grid.columns();
  for (const c of cols) {
    const expected = resolved.left.includes(c.id) ? 'left' : resolved.right.includes(c.id) ? 'right' : 'none';
    expect(c.frozen).toBe(expected); // columns() matches the resolved partition cell-for-cell
  }
  expect(resolved.left.length).toBeLessThan(3); // the over-pin guard peeled at least one back
  const peeled = ['id', 'name', 'dept'].find((id) => !resolved.left.includes(id))!;
  expect(cols.find((c) => c.id === peeled)!.frozen).toBe('none'); // the peeled column reads 'none'
});

// defaultColumnLayout() is the construction baseline regardless of the current mutations: every column
// visible, construction order, no freeze, declared/auto widths (no overrides).
test('defaultColumnLayout() is the construction baseline regardless of current mutations', () => {
  const grid = buildGrid();
  grid.setColumnVisible('dept', false);
  grid.setFrozen(['id'], []);
  grid.setColumnWidth('total', 30);
  grid.setColumnOrder([...grid.columnOrder()].reverse()); // reorder the visible columns
  const base = grid.defaultColumnLayout();
  expect(base.map((c) => c.id)).toEqual(CONSTRUCTION_ORDER); // construction order
  expect(base.every((c) => c.visible)).toBe(true); // all visible
  expect(base.every((c) => c.frozen === 'none')).toBe(true); // no freeze
  expect(base.find((c) => c.id === 'total')!.width).toBe(6); // declared width — NOT the 30 override
});

// clearColumnWidth removes a column's override (returns it to auto/declared); an unknown id is a no-op.
test('clearColumnWidth removes an override (unknown id is a no-op)', () => {
  const grid = buildGrid();
  grid.setColumnWidth('name', 20);
  expect(grid.columnWidth('name')).toBe(20);
  grid.clearColumnWidth('name');
  expect(grid.columnWidth('name')).toBe(8); // back to the declared width
  expect(() => grid.clearColumnWidth('nope')).not.toThrow(); // unknown id → silent no-op
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Dialog column region + personalizeGrid helper (ST-12…ST-20) — driven on a headless modal host.
// ───────────────────────────────────────────────────────────────────────────────────────────────

// OK commits the pending layout via applyVariant; Cancel and Esc leave the grid byte-identical.
test('OK applies the pending layout; Cancel and Esc leave the grid untouched', async () => {
  // OK path
  {
    const grid = buildGrid();
    const { loop, dlg, result } = open(grid);
    dlg.select(dlg.indexOf('note'));
    dlg.toggleSelectedVisibility(); // hide 'note' (pending only)
    loop.emitCommand(Commands.ok);
    await expect(result).resolves.toEqual({ ok: true });
    expect(grid.columnOrder()).not.toContain('note'); // committed
  }
  // Cancel path — pending edit discarded
  {
    const grid = buildGrid();
    const snapshot = JSON.stringify(grid.columns());
    const { loop, dlg, result } = open(grid);
    dlg.select(dlg.indexOf('note'));
    dlg.toggleSelectedVisibility();
    loop.emitCommand(Commands.cancel);
    await expect(result).resolves.toEqual({ ok: false });
    expect(JSON.stringify(grid.columns())).toBe(snapshot); // untouched
  }
  // Esc path — same as Cancel
  {
    const grid = buildGrid();
    const snapshot = JSON.stringify(grid.columns());
    const { loop, dlg, result } = open(grid);
    dlg.select(dlg.indexOf('note'));
    dlg.toggleSelectedVisibility();
    loop.dispatch(key('escape'));
    await expect(result).resolves.toEqual({ ok: false });
    expect(JSON.stringify(grid.columns())).toBe(snapshot);
  }
});

// Hiding a column removes it from the visible order (kept in columns() as visible:false); re-showing
// restores it.
test('hide a column then re-show it across two OK commits', async () => {
  const grid = buildGrid();
  {
    const { loop, dlg, result } = open(grid);
    dlg.select(dlg.indexOf('dept'));
    dlg.toggleSelectedVisibility(); // hide
    loop.emitCommand(Commands.ok);
    await result;
  }
  expect(grid.columnOrder()).not.toContain('dept'); // gone from the visible order
  expect(grid.columns().find((c) => c.id === 'dept')!.visible).toBe(false); // still present, hidden
  {
    const { loop, dlg, result } = open(grid);
    dlg.select(dlg.indexOf('dept'));
    dlg.toggleSelectedVisibility(); // show again
    loop.emitCommand(Commands.ok);
    await result;
  }
  expect(grid.columnOrder()).toContain('dept'); // restored
});

// The last visible column's toggle is a guarded no-op — a zero-visible layout is never committed.
test('the last visible column cannot be hidden (guard)', async () => {
  const grid = buildGrid();
  const { loop, dlg, result } = open(grid);
  // Hide every column but the first, one at a time.
  for (const id of ['name', 'dept', 'total', 'note', 'active']) {
    dlg.select(dlg.indexOf(id));
    dlg.toggleSelectedVisibility();
  }
  expect(dlg.visibleCount()).toBe(1);
  // Attempt to hide the last remaining visible column ('id') — guarded no-op.
  dlg.select(dlg.indexOf('id'));
  dlg.toggleSelectedVisibility();
  expect(dlg.visibleCount()).toBe(1); // still one visible; the guard held
  expect(dlg.workingColumns().find((c) => c.id === 'id')!.visible).toBe(true);
  loop.emitCommand(Commands.ok);
  await result;
  expect(grid.columnOrder().length).toBe(1); // a zero-visible layout was never committed
});

// Reorder moves the selected column up/down; a top column does not move up, a bottom column down.
test('reorder the selected column, with boundary no-ops', async () => {
  const grid = buildGrid();
  const { loop, dlg, result } = open(grid);
  // Move 'total' (index 3) up two positions → index 1.
  dlg.select(dlg.indexOf('total'));
  dlg.reorderSelected(-1);
  dlg.reorderSelected(-1);
  expect(dlg.workingColumns().map((c) => c.id)).toEqual(['id', 'total', 'name', 'dept', 'note', 'active']);
  // Boundary: the top column cannot move up.
  dlg.select(0);
  dlg.reorderSelected(-1);
  expect(dlg.workingColumns()[0].id).toBe('id'); // unchanged
  // Boundary: the bottom column cannot move down.
  dlg.select(dlg.workingColumns().length - 1);
  dlg.reorderSelected(1);
  expect(dlg.workingColumns().at(-1)!.id).toBe('active'); // unchanged
  loop.emitCommand(Commands.ok);
  await result;
  expect(grid.columnOrder()).toEqual(['id', 'total', 'name', 'dept', 'note', 'active']);
});

// The freeze control cycles none → left → right → none and commits to the frozen partition.
test('freeze cycles none → left → right → none and commits', async () => {
  const grid = buildGrid();
  const { loop, dlg, result } = open(grid);
  dlg.select(dlg.indexOf('id'));
  const sideOf = () => dlg.workingColumns().find((c) => c.id === 'id')!.freeze;
  dlg.cycleSelectedFreeze();
  expect(sideOf()).toBe('left');
  dlg.cycleSelectedFreeze();
  expect(sideOf()).toBe('right');
  dlg.cycleSelectedFreeze();
  expect(sideOf()).toBe('none');
  dlg.cycleSelectedFreeze(); // back to left for the commit
  loop.emitCommand(Commands.ok);
  await result;
  expect(grid.frozen().left).toContain('id');
  expect(grid.frozen().right).not.toContain('id');
});

// Width: below-min clamps up on OK, above-max clamps down, an empty field clears the override to auto.
test('width clamps up/down on OK and an empty field clears the override', async () => {
  // clamp up
  {
    const grid = buildGrid();
    const { loop, dlg, result } = open(grid);
    dlg.select(dlg.indexOf('total'));
    dlg.setSelectedWidth('1'); // below minWidth 4
    loop.emitCommand(Commands.ok);
    await result;
    expect(grid.columnWidth('total')).toBe(4); // clamped up on OK
  }
  // clamp down
  {
    const grid = buildGrid();
    const { loop, dlg, result } = open(grid);
    dlg.select(dlg.indexOf('total'));
    dlg.setSelectedWidth('999'); // above maxWidth 40
    loop.emitCommand(Commands.ok);
    await result;
    expect(grid.columnWidth('total')).toBe(40); // clamped down on OK
  }
  // clear → auto
  {
    const grid = buildGrid();
    grid.setColumnWidth('total', 22); // a prior override
    const { loop, dlg, result } = open(grid);
    dlg.select(dlg.indexOf('total'));
    dlg.setSelectedWidth(''); // empty → auto
    loop.emitCommand(Commands.ok);
    await result;
    expect(grid.columnWidth('total')).toBe(6); // override cleared → declared/auto width
  }
});

// Reset restores the column facets to the construction baseline (all visible, construction order, no
// freeze, no width overrides) but leaves the pending sort/filter untouched.
test('Reset restores column facets to defaults and leaves sort/filter', async () => {
  const grid = buildGrid();
  grid.setColumnVisible('note', false);
  grid.setFrozen(['id'], []);
  grid.setColumnWidth('total', 30);
  grid.sortBy('name', 'asc');
  grid.setFilter('dept', { kind: 'text', op: 'contains', value: 'Eng' });
  const { loop, dlg, result } = open(grid);
  dlg.reset();
  loop.emitCommand(Commands.ok);
  await result;
  expect(grid.columnOrder()).toEqual(['id', 'name', 'dept', 'total', 'note', 'active']); // all visible, construction order
  expect(grid.frozen()).toEqual({ left: [], right: [] }); // no freeze
  expect(grid.columnWidth('total')).toBe(6); // override cleared → declared
  expect(grid.sort()).toEqual([{ columnId: 'name', dir: 'asc' }]); // sort untouched by Reset
  expect(grid.filterModel().get('dept')).toEqual({ kind: 'text', op: 'contains', value: 'Eng' }); // filter untouched
});

// Keyboard-only operability: ↑/↓ move the selection, Space toggles visibility, Alt+↑/↓ reorder, Enter
// = OK, Esc = Cancel — all via dispatched keys, no mouse.
test('the dialog is fully keyboard-operable (↑/↓ · Space · Alt+arrows · Enter · Esc)', async () => {
  // Esc = Cancel
  {
    const grid = buildGrid();
    const { loop, result } = open(grid);
    loop.dispatch(key('escape'));
    await expect(result).resolves.toEqual({ ok: false });
  }
  // ↓ selects, Space toggles visibility, Alt+↑ reorders, Enter = OK.
  {
    const grid = buildGrid();
    const { loop, dlg, result } = open(grid);
    loop.dispatch(key('down')); // select index 1 ('name')
    loop.dispatch(key('down')); // select index 2 ('dept')
    expect(dlg.selected()).toBe(2);
    loop.dispatch(key('space')); // hide 'dept'
    expect(dlg.workingColumns().find((c) => c.id === 'dept')!.visible).toBe(false);
    loop.dispatch(key('up', { alt: true })); // reorder 'dept' up to index 1
    expect(dlg.workingColumns()[1].id).toBe('dept');
    loop.dispatch(key('enter')); // OK
    await expect(result).resolves.toEqual({ ok: true });
    expect(grid.columnOrder()).not.toContain('dept'); // committed hidden
  }
});

// A variant name with control bytes renders/stores sanitized, and the field is hard-capped at 64.
test('the variant-name field sanitizes control bytes and caps at 64 characters', () => {
  const grid = buildGrid();
  const { dlg } = open(grid);
  dlg.setName('a\x1bb\x07c'); // ESC + BEL embedded
  expect(dlg.sanitizedName()).toBe('abc'); // control bytes stripped
  expect(dlg.sanitizedName()).not.toMatch(/[\x00-\x08\x0e-\x1f]/); // no raw control bytes survive
  dlg.setName('x'.repeat(200));
  expect(dlg.nameValue().length).toBeLessThanOrEqual(64); // hard-capped at entry
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Variants panel (ST-21…ST-25) — save-as / apply / delete / set-default over the caller's store.
// ───────────────────────────────────────────────────────────────────────────────────────────────

const mkVariant = (name: string): GridVariant => ({
  name,
  columns: [{ id: 'id', visible: true }],
  freeze: { left: [], right: [] },
  sort: [],
  filter: [],
});

// Save-as writes a variant reflecting the pending layout (equal to the grid at open, all facets).
test('Save-as writes a variant reflecting the pending layout', async () => {
  const grid = buildGrid();
  grid.sortBy('name', 'asc');
  grid.setFilter('dept', { kind: 'text', op: 'contains', value: 'Eng' });
  const store = createMemoryVariantStore();
  const { dlg } = open(grid, store);
  dlg.setName('mine');
  expect(await dlg.saveAs()).toBe('saved');
  const saved = store.list().find((v) => v.name === 'mine')!;
  expect(saved).toBeDefined();
  expect(saved.columns.map((c) => c.id)).toEqual(['id', 'name', 'dept', 'total', 'note', 'active']); // pending columns
  expect(saved.sort).toEqual([{ columnId: 'name', dir: 'asc' }]); // pending sort
  expect(saved.filter).toEqual([{ columnId: 'dept', filter: { kind: 'text', op: 'contains', value: 'Eng' } }]); // pending filter
});

// Save-as rejects a blank/whitespace name, and a declined overwrite leaves the store unchanged.
test('Save-as rejects a blank name and honors a declined overwrite', async () => {
  const grid = buildGrid();
  const store = createMemoryVariantStore([mkVariant('dup')]);
  const { loop, dlg } = open(grid, store);
  dlg.setName('   '); // whitespace only
  expect(await dlg.saveAs()).toBe('blank');
  expect(store.list()).toHaveLength(1); // nothing written
  // Overwrite an existing name, then decline the confirm.
  dlg.setName('dup');
  const p = dlg.saveAs();
  await Promise.resolve(); // let the nested confirm open
  loop.emitCommand(Commands.no); // decline
  expect(await p).toBe('declined');
  expect(store.list().filter((v) => v.name === 'dup')).toHaveLength(1); // still the original, unchanged
});

// Apply re-renders the pending layout, reproduces it on OK, and drops an unknown column id.
test('Apply re-renders, reproduces on OK, and drops an unknown column', async () => {
  const grid = buildGrid();
  const variant: GridVariant = {
    name: 'v',
    columns: [
      { id: 'total', visible: true },
      { id: 'id', visible: true },
      { id: 'legacy', visible: true }, // not a current column → dropped on OK
      { id: 'name', visible: false }, // hidden
      { id: 'dept', visible: true },
      { id: 'note', visible: true },
      { id: 'active', visible: true },
    ],
    freeze: { left: ['id'], right: [] },
    sort: [{ columnId: 'total', dir: 'desc' }],
    filter: [],
  };
  const { loop, dlg, result } = open(grid);
  dlg.applyStored(variant);
  expect(dlg.workingColumns()[0].id).toBe('total'); // the column list re-rendered to the variant order
  loop.emitCommand(Commands.ok);
  await result;
  expect(grid.columnOrder()[0]).toBe('total'); // reproduced order
  expect(grid.columnOrder()).not.toContain('name'); // hidden
  expect(grid.columnOrder()).not.toContain('legacy'); // unknown id dropped, no throw
  expect(grid.frozen().left).toContain('id');
  expect(grid.sort()).toEqual([{ columnId: 'total', dir: 'desc' }]);
});

// Applying a variant carries its sort/filter onto OK; with no variant applied they are unchanged.
test('Apply restages the variant sort/filter on OK; no apply leaves them unchanged', async () => {
  // Applied → the variant's sort/filter are restaged on OK.
  {
    const grid = buildGrid();
    const variant: GridVariant = {
      name: 'v',
      columns: COLS().map((c) => ({ id: c.id, visible: true })),
      freeze: { left: [], right: [] },
      sort: [{ columnId: 'total', dir: 'desc' }],
      filter: [{ columnId: 'dept', filter: { kind: 'text', op: 'contains', value: 'Ops' } }],
    };
    const { loop, dlg, result } = open(grid);
    dlg.applyStored(variant);
    loop.emitCommand(Commands.ok);
    await result;
    expect(grid.sort()).toEqual([{ columnId: 'total', dir: 'desc' }]);
    expect(grid.filterModel().get('dept')).toEqual({ kind: 'text', op: 'contains', value: 'Ops' });
  }
  // Not applied → sort/filter unchanged (OK re-applies the same pending sort/filter).
  {
    const grid = buildGrid();
    grid.sortBy('id', 'asc');
    const { loop, result } = open(grid);
    loop.emitCommand(Commands.ok);
    await result;
    expect(grid.sort()).toEqual([{ columnId: 'id', dir: 'asc' }]); // unchanged
  }
});

// Delete removes a variant (confirmed) and clears the default if it named it; Set-default records the
// default without changing the grid (no auto-apply).
test('Delete (confirmed) clears the default; Set-default does not change the grid', async () => {
  const grid = buildGrid();
  const store = createMemoryVariantStore([mkVariant('a'), mkVariant('b')]);
  store.setDefault('a');
  const { loop, dlg } = open(grid, store);
  const before = JSON.stringify(grid.columns());
  const p = dlg.deleteStored('a'); // delete the default
  await Promise.resolve(); // let the nested confirm open
  loop.emitCommand(Commands.yes); // confirm
  expect(await p).toBe('deleted');
  expect(store.list().map((v) => v.name)).toEqual(['b']); // removed
  expect(store.getDefault()).toBeUndefined(); // deleting the default cleared it
  dlg.setDefaultStored('b');
  expect(store.getDefault()).toBe('b');
  expect(JSON.stringify(grid.columns())).toBe(before); // no auto-apply — grid layout unchanged
});
