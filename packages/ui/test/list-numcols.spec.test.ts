/**
 * Specification tests (immutable oracle) — the additive `TListViewer` seams on `ListRows`/`ListView`
 * (jsvision-ui/RD-09 PA-14, ST-21). Two non-breaking generalizations toward Turbo Vision's
 * `TListViewer`:
 *
 *   1. **`numCols`** (default 1) — the faithful **column-major** flow with a `│` interior divider.
 *   2. an **injectable/orientable `ScrollBar`** — the default stays the owned vertical right-edge bar;
 *      an override lets a caller supply/position the bar (e.g. `FileDialog`'s horizontal-bottom bar),
 *      which acts as the **vScrollBar** (scroll model stays vertical).
 *
 * TV source of truth (decoded cell-by-cell): `source/tvision/tlstview.cpp`
 *   • `draw()` `:96-141` — `colWidth = size.x/numCols + 1`; per row `i`, per col `j`,
 *     `item = j*size.y + i + topItem` (column-major); text at `curCol+1`; the `│` (`0xB3`) divider at
 *     `curCol+colWidth-1` in `getColor(5)` (→ `listDivider`).
 *   • ctor `:41` — `aVScrollBar->setStep(pgStep, arStep)` with, for `numCols>1`,
 *     `pgStep = size.y*numCols` / `arStep = size.y`.
 *   • `focusItem()` `:159` — multi-col keep-visible aligns `topItem` to a column boundary.
 *   • `handleEvent()` `:213` — mouse `newItem = mouse.y + size.y*(mouse.x/colWidth) + topItem`;
 *     `kbLeft/kbRight` move `±size.y` when `numCols>1`; `kbPgUp/Dn` move `±size.y*numCols`.
 *
 * Expectations derive from that decode + the ACs, NEVER from the implementation. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { KeyEvent, MouseEvent as CoreMouseEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { ListView } from '../src/list/index.js';
import { ScrollBar } from '../src/scroll/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false };
}
function mouse(kind: 'down' | 'up', x: number, y: number): CoreMouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}

/** Mount a full-width `ListView` (no owned bar — an injected bar means `rows` fills the width). */
function hosted<T>(list: ListView<T>, w: number, h: number) {
  list.layout = { position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } };
  const root = new Group();
  root.add(list);
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  loop.focusView(list.rows);
  return loop;
}

// ST-21 — `numCols:2` flows column-major with a `│` divider (getColor 5) at the interior column edge.
// A 20×4 viewport, 8 items, injected bar ⇒ rows fill the full 20 width: colWidth = 20/2+1 = 11, so
// col0 spans [0,10] (divider at col 10), col1 starts at col 11 (text at 12). Column-major:
// col0 = items 0..3 (rows 0..3), col1 = items 4..7.
test('ST-21: numCols:2 lays out column-major with a │ divider in listDivider', () => {
  const items = signal(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  const focused = signal(0);
  const bar = new ScrollBar({ value: focused, orientation: 'horizontal' });
  const list = new ListView<string>({ items, getText: (s) => s, focused, numCols: 2, bar });
  const loop = hosted(list, 20, 4);
  const buf = () => loop.renderRoot.buffer();

  // Column 0 (items 0..3) — text at col 1, rows 0..3.
  expect(buf().get(1, 0)?.char).toBe('a');
  expect(buf().get(1, 3)?.char).toBe('d');
  // Column 1 (items 4..7) — text at col 12 (curCol+1 = 11+1), rows 0..3.
  expect(buf().get(12, 0)?.char).toBe('e');
  expect(buf().get(12, 3)?.char).toBe('h');
  // The interior `│` divider at col 10 (curCol+colWidth-1 = 0+11-1) in the listDivider role.
  expect(buf().get(10, 0)?.char).toBe('│');
  expect(buf().get(10, 0)?.fg).toBe(defaultTheme.listDivider.fg);
  expect(buf().get(10, 0)?.bg).toBe(defaultTheme.listDivider.bg);
});

// ST-21 — the injected bar acts as the vScrollBar: TV `setStep(pgStep=size.y*numCols, arStep=size.y)`.
// The scroll model stays vertical (its value is the shared `focused` signal; ↓ moves +1 in item order).
test('ST-21: an injected bar is wired as the vScrollBar with TV multi-col steps', () => {
  const items = signal(Array.from({ length: 40 }, (_, i) => `x${i}`));
  const focused = signal(0);
  const bar = new ScrollBar({ value: focused, orientation: 'horizontal' });
  const list = new ListView<string>({ items, getText: (s) => s, focused, numCols: 2, bar });
  const loop = hosted(list, 20, 4);
  loop.renderRoot.buffer(); // force a draw so the rows renderer wires the bar's step

  // size.y = 4, numCols = 2 ⇒ pgStep = 8, arStep = 4 (tlstview.cpp:41).
  expect(bar.pageStep()).toBe(8);
  expect(bar.arrowStep()).toBe(4);

  // Scroll stays vertical: ↓ advances the focused item by exactly 1 (column-major item order).
  loop.dispatch(key('down'));
  expect(focused()).toBe(1);
});

// ST-21 — multi-column navigation: →/← jump a whole column (±size.y); a click hits the right column
// (newItem = mouse.y + size.y*(mouse.x/colWidth) + topItem).
test('ST-21: numCols:2 right/left jump a column and clicks hit the correct column', () => {
  const items = signal(Array.from({ length: 16 }, (_, i) => `${i}`));
  const focused = signal(0);
  const bar = new ScrollBar({ value: focused, orientation: 'horizontal' });
  const list = new ListView<string>({ items, getText: (s) => s, focused, numCols: 2, bar });
  const loop = hosted(list, 20, 4);
  loop.renderRoot.buffer();

  // → from item 0 focuses item 0 + size.y (4) — the same row in the next column.
  loop.dispatch(key('right'));
  expect(focused()).toBe(4);
  // ← returns to item 0.
  loop.dispatch(key('left'));
  expect(focused()).toBe(0);

  // Click column 1, row 2 (input is 1-based; the loop normalizes to local (12,2), AR-63) ⇒
  // item = mouse.y(2) + size.y(4)*floor(12/11) + topItem(0) = 6.
  loop.dispatch(mouse('down', 13, 3));
  loop.dispatch(mouse('up', 13, 3));
  expect(focused()).toBe(6);
});

// ST-21 — `numCols:1` (the default) is unchanged: single column, no divider drawn on screen.
test('ST-21: numCols:1 default is single-column with no on-screen divider', () => {
  const items = signal(['Alpha', 'Bravo', 'Charlie']);
  const focused = signal(0);
  const list = new ListView<string>({ items, getText: (s) => s, focused });
  const loop = hosted(list, 20, 4);
  const buf = () => loop.renderRoot.buffer();
  // Single column ⇒ text at col 1; no `│` divider appears anywhere in the rows.
  expect(buf().get(1, 0)?.char).toBe('A');
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 20; x += 1) expect(buf().get(x, y)?.char).not.toBe('│');
  }
});
