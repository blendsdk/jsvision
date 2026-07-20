/**
 * Specification tests — widgets own their constructor-time computeds (fix #37).
 *
 * Oracle (GitHub issue #37): the four core widgets that create a reactive `computed()` in their
 * CONSTRUCTOR — `ListRows`/`ListView`/`ListBox` (`displayItems`), `Tree` (`flattened`),
 * `DataGrid` (`autoWidths`/`display`), `ComboBox` (`filtered`) — must NOT leak an unowned computation
 * (which never auto-disposes and dev-warns onto a live TTY). After the fix each derived value is
 * owned by the view's own mount-time scope and disposed at unmount, while staying reactive across an
 * unmount→remount (the scope-keyed `View.derived()` helper).
 *
 * T-01.1 — bare construction (outside any reactive scope) emits no unowned-computation warning.
 * T-01.2 — (a) the derived value's owning scope is disposed on every unmount (no accumulation);
 *          (b) after an unmount→remount a source write still updates a read through the derived
 *          accessor (guards the scope-keyed re-derive — a one-time memo would read frozen here).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { signal, Show } from '../src/reactive/index.js';
import { Group, createRenderRoot } from '../src/view/index.js';
import { ListView, ListBox } from '../src/list/index.js';
import { Tree } from '../src/tree/index.js';
import type { TreeNode } from '../src/tree/index.js';
import { DataGrid } from '../src/table/index.js';
import type { Column } from '../src/table/index.js';
import { ComboBox } from '../src/dropdown/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Substring/pattern of the reactive core's unowned-computation dev warning (`owner.ts` `attachComputation`). */
const LEAK_WARNING = /created outside any createRoot|never be auto-disposed/;

/** Run `fn` with `console.warn` captured; restore it afterwards. Returns every warning's first arg. */
function captureWarnings(fn: () => void): string[] {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]): void => void warnings.push(String(args[0]));
  try {
    fn();
  } finally {
    console.warn = original;
  }
  return warnings;
}

// --- T-01.1: no unowned-computation warning on bare construction ---------------------------------

test('spec: constructing a ListBox outside any scope emits no unowned-computation warning', () => {
  const warnings = captureWarnings(() => new ListBox({ items: signal<string[]>(['a', 'b']) }));
  expect(warnings.filter((w) => LEAK_WARNING.test(w))).toEqual([]);
});

test('spec: constructing a ListView outside any scope emits no unowned-computation warning', () => {
  const warnings = captureWarnings(
    () => new ListView<string>({ items: signal<string[]>(['a', 'b']), getText: (s) => s }),
  );
  expect(warnings.filter((w) => LEAK_WARNING.test(w))).toEqual([]);
});

test('spec: constructing a Tree outside any scope emits no unowned-computation warning', () => {
  const roots = signal<TreeNode<string>[]>([{ value: 'root', children: [] }]);
  const warnings = captureWarnings(() => new Tree<string>({ roots, getText: (s) => s }));
  expect(warnings.filter((w) => LEAK_WARNING.test(w))).toEqual([]);
});

test('spec: constructing a DataGrid outside any scope emits no unowned-computation warning', () => {
  const columns: Column<{ n: string }>[] = [{ title: 'N', accessor: (r) => r.n, width: 'auto' }];
  const warnings = captureWarnings(() => new DataGrid<{ n: string }>({ rows: signal([{ n: 'a' }]), columns }));
  expect(warnings.filter((w) => LEAK_WARNING.test(w))).toEqual([]);
});

test('spec: constructing a ComboBox outside any scope emits no unowned-computation warning', () => {
  const warnings = captureWarnings(
    () =>
      new ComboBox<string>({
        items: signal<string[]>(['a', 'b']),
        value: signal<string | null>(null),
        getText: (s) => s,
      }),
  );
  expect(warnings.filter((w) => LEAK_WARNING.test(w))).toEqual([]);
});

// --- T-01.2: disposal each cycle (no accumulation) + reactivity after remount --------------------

test('spec: a widget disposes its derived scope on every unmount and stays reactive after remount', () => {
  // A `Show` toggling the SAME ComboBox instance is the real unmount→remount path (a `ListBox`/`Tree`/
  // `DataGrid`/`ComboBox` inside a toggling `Show`). `ComboBox.filtered` is the public derived accessor
  // (select-only ⇒ `filtered() === items()`), so its value is observable black-box.
  const items = signal<string[]>(['a', 'b']);
  const combo = new ComboBox<string>({
    items,
    value: signal<string | null>(null),
    getText: (s) => s,
    editable: false,
  });
  combo.setLayout({ size: { kind: 'fr', weight: 1 } });
  const placeholder = new Group();
  placeholder.setLayout({ size: { kind: 'fr', weight: 1 } });

  const cond = signal(true);
  const root = new Group();
  root.setLayout({ direction: 'col' });
  root.addDynamic(() =>
    Show(
      () => cond(),
      () => combo,
      () => placeholder,
    ),
  );

  const rr = createRenderRoot({ width: 20, height: 6 }, { caps });
  rr.mount(root); // combo mounts (its scope exists)
  expect(combo.filtered()).toEqual(['a', 'b']);

  // (a) Each unmount disposes the combo's owning scope (which owns the derived computed). Register the
  // teardown probe on the CURRENT scope each cycle, then toggle it off (unmount → dispose) and back on
  // (remount → fresh scope). No accumulation: the count equals the number of cycles exactly.
  const CYCLES = 3;
  let disposeCount = 0;
  for (let i = 0; i < CYCLES; i++) {
    combo.onCleanup(() => (disposeCount += 1)); // combo is mounted here; onCleanup binds to its scope
    cond.set(false); // unmount → the scope disposes → probe fires
    cond.set(true); // remount → fresh scope
  }
  expect(disposeCount).toBe(CYCLES);

  // (b) After the final remount a source write still updates a read through the derived accessor. A
  // one-time memo would return the previous mount's disposed computed here (frozen value, no edges).
  items.set(['a', 'b', 'c']);
  expect(combo.filtered()).toEqual(['a', 'b', 'c']);
});
