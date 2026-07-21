/**
 * Specification tests (immutable oracles) — RD-14 `History` control.
 *
 * Source: jsvision-ui RD-14 AC-1/AC-2/AC-4/AC-8 → ST-1…ST-11 (input-dropdowns/07-testing-strategy.md)
 * + the TV GATE-1 decode of `THistory`/`THistoryWindow`/`THistoryViewer` (03-01-history.md): the
 * `▐↓▌` icon (U+2590 / **U+2193** / U+258C) in `historyButtonSides`/`historyButtonArrow`; open on
 * mouse-down / Down-while-link-focused / Alt+Down; record-current-field-text-then-open; oldest→newest
 * list order focusing index 1 when count > 1; pick → replace + clamp + `selectAll` via the Input seam;
 * Esc / outside-down → cancel (field unchanged).
 *
 * Expectations derive from the AC + the C++ decode, never the implementation (the C++ is the oracle
 * for TV-derived facts). Real objects: a real loop + render root + Input + History; synthetic dispatch.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect, beforeEach } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { KeyEvent, MouseEvent as CoreMouseEvent } from '@jsvision/core';
import { Group, createRenderRoot } from '../src/view/index.js';
import type { PopupHost } from '../src/view/index.js';
import type { Rect } from '../src/layout/index.js';
import { signal } from '../src/reactive/index.js';
import { Input } from '../src/controls/index.js';
import { createEventLoop } from '../src/event/index.js';
import { History, historyAdd, historyStr, historyCount, clearHistory } from '../src/dropdown/index.js';
import { ListView } from '../src/list/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}
/** A left mouse-down at 1-based terminal coords (dispatch normalizes 1-based → 0-based). */
function mouseDown(x: number, y: number): CoreMouseEvent {
  return { type: 'mouse', kind: 'down', button: 0, x, y };
}

beforeEach(() => {
  clearHistory();
});

interface App {
  loop: ReturnType<typeof createEventLoop>;
  value: ReturnType<typeof signal<string>>;
  link: Input;
  hist: History;
  overlay: Group;
}

/** Build a mounted app: an Input (link) + a History button + the shared overlay, popup host wired. */
function makeApp(
  opts: {
    fieldValue?: string;
    historyId?: number;
    maxLength?: number;
    history?: ReturnType<typeof signal<string[]>>;
  } = {},
): App {
  const viewport = { width: 40, height: 20 };
  const loop = createEventLoop(viewport, { caps });
  const value = signal(opts.fieldValue ?? '');
  const link = new Input({ value, maxLength: opts.maxLength });
  link.setLayout({ position: 'absolute', rect: { x: 5, y: 3, width: 10, height: 1 } });
  const hist = new History({ link, historyId: opts.historyId ?? 1, history: opts.history });
  hist.setLayout({ position: 'absolute', rect: { x: 15, y: 3, width: 3, height: 1 } });
  const overlay = new Group();
  overlay.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: viewport.width, height: viewport.height } });
  overlay.state.visible = false;
  const root = new Group();
  root.add(link);
  root.add(hist);
  root.add(overlay);
  loop.mount(root);
  const host: PopupHost = { overlay, focusView: (v) => loop.focusView(v), getFocused: () => loop.getFocused() };
  loop.popupHost = host;
  return { loop, value, link, hist, overlay };
}

/** The hosted `ListView` inside the open popup (the only Group child of the popup frame). */
function hostedList(overlay: Group): ListView<string> | undefined {
  const frame = overlay.children.find((c): c is Group => c instanceof Group);
  return frame?.children.find((c): c is ListView<string> => c instanceof ListView);
}
function popupOpen(overlay: Group): boolean {
  return overlay.state.visible && overlay.children.some((c) => c instanceof Group);
}

// ── ST-1: icon draw + colors ─────────────────────────────────────────────────────────────────────

test('ST-1: History draws the ▐↓▌ icon (U+2590/U+2193/U+258C) in the decoded sides/arrow colors', () => {
  const link = new Input({ value: signal('') });
  const hist = new History({ link });
  const rr = createRenderRoot({ width: 3, height: 1 }, { caps });
  rr.mount(hist);
  const buf = rr.buffer();

  expect(buf.get(0, 0)?.char).toBe('▐'); // ▐ RIGHT HALF BLOCK
  expect(buf.get(1, 0)?.char).toBe('↓'); // ↓ DOWNWARDS ARROW (PA-3 — NOT ▼)
  expect(buf.get(2, 0)?.char).toBe('▌'); // ▌ LEFT HALF BLOCK

  // Sides ▐▌ = historyButtonSides (green-on-lightGray); arrow ↓ = historyButtonArrow (black-on-green).
  expect(buf.get(0, 0)?.fg).toBe(defaultTheme.historyButtonSides.fg);
  expect(buf.get(0, 0)?.bg).toBe(defaultTheme.historyButtonSides.bg);
  expect(buf.get(1, 0)?.fg).toBe(defaultTheme.historyButtonArrow.fg);
  expect(buf.get(1, 0)?.bg).toBe(defaultTheme.historyButtonArrow.bg);
  expect(buf.get(2, 0)?.fg).toBe(defaultTheme.historyButtonSides.fg);
});

// ── ST-2: click opens + popup geometry ───────────────────────────────────────────────────────────

test('ST-2: clicking the button opens the anchored popup; window rect = field grown ±1, height 8', () => {
  const app = makeApp({ historyId: 1 });
  historyAdd(1, 'prev'); // an entry to list

  app.loop.dispatch(mouseDown(16, 4)); // the History button (0-based x=15,y=3 → 1-based 16,4)

  expect(popupOpen(app.overlay)).toBe(true);
  const frame = app.overlay.children.find((c): c is Group => c instanceof Group);
  const rect = frame?.layout.rect as Rect;
  // Field {x:5,y:3,w:10,h:1} grown ±1 in x, top 1 above, fixed height maxRows(6)+2 = 8 (decode §3).
  expect(rect).toStrictEqual({ x: 4, y: 2, width: 12, height: 8 });
});

// ── ST-3 / ST-4 / ST-5: open triggers ────────────────────────────────────────────────────────────

test('ST-3: Down while the linked Input is focused opens the popup', () => {
  const app = makeApp({ historyId: 1 });
  historyAdd(1, 'prev');
  app.loop.focusView(app.link);

  app.loop.dispatch(key('down'));
  expect(popupOpen(app.overlay)).toBe(true);
});

test('ST-4: Down while the Input is NOT focused does not open the popup', () => {
  const app = makeApp({ historyId: 1 });
  historyAdd(1, 'prev');
  // nothing focused (link not focused)

  app.loop.dispatch(key('down'));
  expect(popupOpen(app.overlay)).toBe(false);
});

test('ST-5: Alt+Down opens the popup (modern extension, AR-135)', () => {
  const app = makeApp({ historyId: 1 });
  historyAdd(1, 'prev');
  app.loop.focusView(app.link);

  app.loop.dispatch(key('down', { alt: true }));
  expect(popupOpen(app.overlay)).toBe(true);
});

// ── ST-6: record current field text before opening ──────────────────────────────────────────────

test('ST-6: opening records the current field text into the store first (decode §2)', () => {
  const app = makeApp({ fieldValue: 'typed-now', historyId: 3 });
  expect(historyCount(3)).toBe(0);

  app.loop.dispatch(mouseDown(16, 4));

  // The current field text is the most-recent (tail) entry recorded before the list is shown.
  expect(historyStr(3, historyCount(3) - 1)).toBe('typed-now');
});

// ── ST-7: list order oldest→newest, focus index 1 when count > 1 ────────────────────────────────

test('ST-7: the popup lists oldest→newest and focuses item index 1 when the count > 1', () => {
  const app = makeApp({ fieldValue: 'cur', historyId: 1 });
  historyAdd(1, 'old1');
  historyAdd(1, 'old2');

  app.loop.dispatch(mouseDown(16, 4)); // records 'cur' → store = [old1, old2, cur]
  const list = hostedList(app.overlay);
  expect(list).toBeDefined();
  expect(list?.focused()).toBe(1); // focus the second item on open (count > 1, decode §6)

  // Oldest at the top: render the popup and read the first list row.
  app.loop.renderRoot.flush();
  const buf = app.loop.renderRoot.buffer();
  // Popup frame rect {4,2,12,8}; interior (padding 1) at (5,3); ListRows draws text at its col 1 → (6,3).
  expect(buf.get(6, 3)?.char).toBe('o'); // 'old1' — the oldest — at the top row
});

// ── ST-8 / ST-9: pick → replace + clamp + selectAll (via the Input seam) ─────────────────────────

test('ST-8: Enter on a row replaces the field text and selects all of it (via the public seam)', () => {
  const app = makeApp({ historyId: 1 });
  historyAdd(1, 'aaa');
  historyAdd(1, 'bbb');

  app.loop.dispatch(mouseDown(16, 4)); // open (field '' skipped) → [aaa, bbb], focus index 1 = bbb
  app.loop.dispatch(key('enter')); // pick the focused row

  expect(app.value()).toBe('bbb'); // field replaced with the picked value
  expect(app.link.selection).toStrictEqual({ start: 0, end: 3 }); // selectAll'd
  expect(popupOpen(app.overlay)).toBe(false); // popup closed after the pick
});

test('ST-9: picking a row longer than maxLength writes the value clamped to maxLength', () => {
  const app = makeApp({ historyId: 1, maxLength: 2 });
  historyAdd(1, 'abcdef');

  app.loop.dispatch(mouseDown(16, 4)); // open → [abcdef], count 1 → focus index 0
  app.loop.dispatch(key('enter'));

  expect(app.value()).toBe('ab'); // 'abcdef'.slice(0, 2)
});

// ── ST-10 / ST-11: cancel — field unchanged ──────────────────────────────────────────────────────

test('ST-10: Esc dismisses the popup and leaves the field unchanged', () => {
  const app = makeApp({ fieldValue: 'keep', historyId: 1 });
  historyAdd(1, 'other');

  app.loop.dispatch(mouseDown(16, 4));
  expect(popupOpen(app.overlay)).toBe(true);

  app.loop.dispatch(key('escape'));
  expect(popupOpen(app.overlay)).toBe(false);
  expect(app.value()).toBe('keep'); // field untouched on cancel
});

test('ST-11: an outside mouse-down dismisses the popup (consumed) and leaves the field unchanged', () => {
  const app = makeApp({ fieldValue: 'keep', historyId: 1 });
  historyAdd(1, 'other');

  app.loop.dispatch(mouseDown(16, 4));
  expect(popupOpen(app.overlay)).toBe(true);

  app.loop.dispatch(mouseDown(1, 1)); // far top-left — outside the popup
  expect(popupOpen(app.overlay)).toBe(false);
  expect(app.value()).toBe('keep');
});

// ── ST-17: injectable history signal (AR-130 escape hatch) ──────────────────────────────────────

test('ST-17: a History given a history signal reads/writes it, not the global store', () => {
  const owned = signal<string[]>(['seed']);
  const app = makeApp({ fieldValue: 'typed', historyId: 42, history: owned });

  app.loop.dispatch(mouseDown(16, 4)); // record 'typed' into the injected signal
  expect(owned()).toContain('typed'); // recorded into the app-owned list
  expect(historyCount(42)).toBe(0); // the global store for that id is untouched

  // The popup lists the injected entries (oldest→newest): seed then typed.
  const list = hostedList(app.overlay);
  expect(list?.focused()).toBe(1); // count 2 → focus index 1
});
