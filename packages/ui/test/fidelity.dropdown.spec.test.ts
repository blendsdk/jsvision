/**
 * Specification test — RD-14 TV fidelity (ST-33), the GATE-2 cell-by-cell diff.
 *
 * Source: jsvision-ui RD-14 AC-11 → ST-33 + the GATE-1 decode (03-01-history.md), diffed against the
 * original C++ (`source/tvision/thistory.cpp`/`thistwin.cpp`/`thstview.cpp`/`histlist.cpp`) AFTER
 * implementation. The C++ is the oracle: a spec cell that disagreed with a faithful decode is the
 * defect. This asserts, pre-`serialize`:
 *   • the 3-cell `▐↓▌` button icon (U+2590 / **U+2193** / U+258C) in `historyButtonSides`
 *     (green-on-lightGray `0x72`) / `historyButtonArrow` (black-on-green `0x20`);
 *   • the popup rect = the field grown ±1 in x, fixed height `maxRows + 2 = 8` (decode §3);
 *   • single-column, no-marker rows with text at column 1 (TV `curCol+1`);
 *   • **oldest at the top** (index 0 = oldest), the focused row (index 1 when count > 1) in
 *     `historyViewerFocused` (white-on-green `0x2F`), normal rows in `historyViewer` (white-on-blue
 *     `0x1F`) — the `cpHistoryViewer` decode, so the rows blend into the blue popup window.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect, beforeEach } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { MouseEvent as CoreMouseEvent } from '@jsvision/core';
import { Group, createRenderRoot } from '../src/view/index.js';
import type { PopupHost } from '../src/view/index.js';
import type { Rect } from '../src/layout/index.js';
import { signal } from '../src/reactive/index.js';
import { Input } from '../src/controls/index.js';
import { createEventLoop } from '../src/event/index.js';
import { History, historyAdd, clearHistory } from '../src/dropdown/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function mouseDown(x: number, y: number): CoreMouseEvent {
  return { type: 'mouse', kind: 'down', button: 0, x, y };
}

beforeEach(() => {
  clearHistory();
});

// ── Button icon (GATE-2 diff vs thistory.cpp:56-62 / tvtext1.cpp:86) ─────────────────────────────

test('ST-33: the button icon is ▐↓▌ in the decoded cpHistory colors (cell-by-cell)', () => {
  const link = new Input({ value: signal('') });
  const hist = new History({ link });
  const rr = createRenderRoot({ width: 3, height: 1 }, { caps });
  rr.mount(hist);
  const buf = rr.buffer();

  expect(buf.get(0, 0)?.char).toBe('▐');
  expect(buf.get(1, 0)?.char).toBe('↓');
  expect(buf.get(2, 0)?.char).toBe('▌');
  // Sides = historyButtonSides (0x72 green-on-lightGray); arrow = historyButtonArrow (0x20 black-on-green).
  expect({ fg: buf.get(0, 0)?.fg, bg: buf.get(0, 0)?.bg }).toStrictEqual(defaultTheme.historyButtonSides);
  expect({ fg: buf.get(2, 0)?.fg, bg: buf.get(2, 0)?.bg }).toStrictEqual(defaultTheme.historyButtonSides);
  expect({ fg: buf.get(1, 0)?.fg, bg: buf.get(1, 0)?.bg }).toStrictEqual(defaultTheme.historyButtonArrow);
});

// ── Popup rect + rows (GATE-2 diff vs thistory.cpp:90-98 / thstview.cpp:33-45) ───────────────────

test('ST-33: the popup rect is field±1 wide × 8 tall; rows are oldest-at-top in the cpHistoryViewer colors', () => {
  const loop = createEventLoop({ width: 40, height: 20 }, { caps });
  const link = new Input({ value: signal('cur') });
  link.layout = { position: 'absolute', rect: { x: 5, y: 3, width: 10, height: 1 } };
  const hist = new History({ link, historyId: 1 });
  hist.layout = { position: 'absolute', rect: { x: 15, y: 3, width: 3, height: 1 } };
  const overlay = new Group();
  overlay.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 20 } };
  overlay.state.visible = false;
  const root = new Group();
  root.add(link);
  root.add(hist);
  root.add(overlay);
  loop.mount(root);
  const host: PopupHost = { overlay, focusView: (v) => loop.focusView(v), getFocused: () => loop.getFocused() };
  loop.popupHost = host;

  historyAdd(1, 'old1');
  historyAdd(1, 'old2');
  loop.dispatch(mouseDown(16, 4)); // open → records 'cur' → [old1, old2, cur], focus index 1 (old2)
  loop.renderRoot.flush();

  // Popup rect: field {5,3,10,1} grown ±1 in x, top 1 above, fixed height maxRows(6)+2 = 8 (decode §3).
  const frame = overlay.children.find((c): c is Group => c instanceof Group);
  expect(frame?.layout.rect as Rect).toStrictEqual({ x: 4, y: 2, width: 12, height: 8 });

  const buf = loop.renderRoot.buffer();
  // Interior origin (5,3); ListRows text at its col 1 → x=6. Rows: 0='old1' (top=oldest), 1='old2' (focused).
  expect(buf.get(6, 3)?.char).toBe('o'); // old1 — OLDEST at the top (PA-6)
  expect(buf.get(6, 4)?.char).toBe('o'); // old2

  // Normal row (index 0) = historyViewer (white-on-blue); focused row (index 1) = historyViewerFocused
  // (white-on-green). No markers/brackets — text starts at column 1.
  expect({ fg: buf.get(6, 3)?.fg, bg: buf.get(6, 3)?.bg }).toStrictEqual(defaultTheme.historyViewer);
  expect({ fg: buf.get(6, 4)?.fg, bg: buf.get(6, 4)?.bg }).toStrictEqual(defaultTheme.historyViewerFocused);
});
