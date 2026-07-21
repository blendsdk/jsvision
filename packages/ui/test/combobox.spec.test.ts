/**
 * Specification tests (immutable oracles) — RD-14 `ComboBox<T>`.
 *
 * Source: jsvision-ui RD-14 AC-5/AC-6/AC-7 → ST-24…ST-31 (input-dropdowns/07-testing-strategy.md) +
 * 03-03-combobox.md (PA-11/PA-13/PA-14). ComboBox has NO TV counterpart (designed fresh) but draws
 * like its siblings. Editable (free text + filter-as-you-type) or select-only (picker + type-ahead);
 * two-signal binding (`value: Signal<T|null>` + `text: Signal<string>`); a trailing `▐↓▌` button
 * reusing the History glyph/roles; opens the shared anchored popup.
 *
 * Expectations derive from the AC + plan, never the implementation. Real objects: a real loop +
 * overlay + ComboBox; synthetic dispatch; headless.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent as CoreMouseEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import type { PopupHost } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import type { Signal } from '../src/reactive/index.js';
import { createEventLoop } from '../src/event/index.js';
import { ComboBox } from '../src/dropdown/index.js';
import { ListView } from '../src/list/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}
function mouseDown(x: number, y: number): CoreMouseEvent {
  return { type: 'mouse', kind: 'down', button: 0, x, y };
}
function type(loop: ReturnType<typeof createEventLoop>, s: string): void {
  for (const ch of s) loop.dispatch(key(ch));
}

interface Harness<T> {
  loop: ReturnType<typeof createEventLoop>;
  combo: ComboBox<T>;
  overlay: Group;
}

function makeCombo<T>(opts: {
  items: T[];
  getText: (t: T) => string;
  editable?: boolean;
  value?: Signal<T | null>;
}): Harness<T> {
  const loop = createEventLoop({ width: 40, height: 20 }, { caps });
  const combo = new ComboBox<T>({
    items: signal(opts.items),
    getText: opts.getText,
    value: opts.value ?? signal<T | null>(null),
    editable: opts.editable,
  });
  combo.setLayout({ position: 'absolute', rect: { x: 5, y: 3, width: 14, height: 1 } });
  const overlay = new Group();
  overlay.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 20 } });
  overlay.state.visible = false;
  const root = new Group();
  root.add(combo);
  root.add(overlay);
  loop.mount(root);
  const host: PopupHost = { overlay, focusView: (v) => loop.focusView(v), getFocused: () => loop.getFocused() };
  loop.popupHost = host;
  return { loop, combo, overlay };
}

function hostedList<T>(overlay: Group): ListView<T> | undefined {
  const frame = overlay.children.find((c): c is Group => c instanceof Group);
  return frame?.children.find((c): c is ListView<T> => c instanceof ListView);
}
function popupOpen(overlay: Group): boolean {
  return overlay.state.visible && overlay.children.some((c) => c instanceof Group);
}

const COLORS = ['Red', 'Green', 'Blue'];
const idn = (s: string): string => s;

// ── ST-24 / ST-25 / ST-26: editable filter + pick + null-on-no-match ─────────────────────────────

test('ST-24: editable — typing "gr" narrows the candidates to [Green] (ci-substring); text = "gr"', () => {
  const h = makeCombo({ items: COLORS, getText: idn, editable: true });
  h.loop.focusView(h.combo.input);
  type(h.loop, 'gr');

  expect(h.combo.text()).toBe('gr');
  expect(h.combo.filtered()).toStrictEqual(['Green']); // case-insensitive substring (PA-13)
});

test('ST-25: editable — picking "Green" sets value = "Green" AND text = "Green"', () => {
  const h = makeCombo({ items: COLORS, getText: idn, editable: true });
  h.loop.focusView(h.combo.input);
  type(h.loop, 'gr');

  h.loop.dispatch(key('down', { alt: true })); // open (filtered = [Green], focus index 0)
  h.loop.dispatch(key('enter')); // pick

  expect(h.combo.value()).toBe('Green');
  expect(h.combo.text()).toBe('Green');
  expect(popupOpen(h.overlay)).toBe(false);
});

test('ST-26: editable — free text matching nothing leaves value = null; text = "xyz"', () => {
  const h = makeCombo({ items: COLORS, getText: idn, editable: true });
  h.loop.focusView(h.combo.input);
  type(h.loop, 'xyz');

  expect(h.combo.text()).toBe('xyz');
  expect(h.combo.value()).toBeNull(); // no item matches (PA-14)
  expect(h.combo.filtered()).toStrictEqual([]);
});

// ── ST-27 / ST-28 / ST-29: select-only display + type-ahead + pick ───────────────────────────────

test('ST-27: select-only — the field shows getText(value) and is read-only', () => {
  const value = signal<string | null>('Blue');
  const h = makeCombo({ items: COLORS, getText: idn, editable: false, value });

  expect(h.combo.text()).toBe('Blue'); // field mirrors getText(value)

  h.loop.focusView(h.combo.input);
  h.loop.dispatch(key('x')); // typing into the read-only field is rejected
  expect(h.combo.text()).toBe('Blue');
});

test('ST-28: select-only — typing drives the open list type-ahead; text is NOT edited', () => {
  const h = makeCombo({ items: ['Apple', 'Banana', 'Cherry'], getText: idn, editable: false });
  h.loop.focusView(h.combo.input);
  h.loop.dispatch(key('down', { alt: true })); // open → list focused, type-ahead active

  h.loop.dispatch(key('b')); // type-ahead → Banana (index 1)
  const list = hostedList<string>(h.overlay);
  expect(list?.focused()).toBe(1);
  expect(h.combo.text()).toBe(''); // the field text is untouched (value still null)
});

test('ST-29: select-only — picking a row sets value to that item', () => {
  const h = makeCombo({ items: ['Apple', 'Banana', 'Cherry'], getText: idn, editable: false });
  h.loop.focusView(h.combo.input);
  h.loop.dispatch(key('down', { alt: true })); // open, focus index 0 (Apple)
  h.loop.dispatch(key('down')); // focus Banana (1)
  h.loop.dispatch(key('down')); // focus Cherry (2)
  h.loop.dispatch(key('enter')); // pick

  expect(h.combo.value()).toBe('Cherry');
});

// ── ST-30: binding (generic T + reactive items + value ⟂ text) ───────────────────────────────────

test('ST-30: rows show getText(item); value reflects the picked item independent of the text string', () => {
  interface Row {
    id: number;
    name: string;
  }
  const items = signal<Row[]>([
    { id: 1, name: 'One' },
    { id: 2, name: 'Two' },
  ]);
  const value = signal<Row | null>(null);
  const loop = createEventLoop({ width: 40, height: 20 }, { caps });
  const combo = new ComboBox<Row>({ items, getText: (r) => r.name, value, editable: false });
  combo.setLayout({ position: 'absolute', rect: { x: 5, y: 3, width: 14, height: 1 } });
  const overlay = new Group();
  overlay.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 20 } });
  overlay.state.visible = false;
  const root = new Group();
  root.add(combo);
  root.add(overlay);
  loop.mount(root);
  loop.popupHost = { overlay, focusView: (v) => loop.focusView(v), getFocused: () => loop.getFocused() };

  loop.focusView(combo.input);
  loop.dispatch(key('down', { alt: true })); // open, focus index 0 (One)
  loop.dispatch(key('enter')); // pick One

  expect(combo.value()?.id).toBe(1); // value is the T object (not the string)
  expect(combo.text()).toBe('One'); // text is the display string
});

// ── ST-31: open triggers ─────────────────────────────────────────────────────────────────────────

test('ST-31: the popup opens via the trailing ▐↓▌ button, Alt+Down, and Down', () => {
  // Button click (trailing 3 cells of the 14-wide combo at x=5 → button at 0-based x=16..18).
  const a = makeCombo({ items: COLORS, getText: idn, editable: true });
  a.loop.dispatch(mouseDown(17, 4)); // 1-based → 0-based (16,3): inside the button
  expect(popupOpen(a.overlay)).toBe(true);

  // Alt+Down while the field is focused.
  const b = makeCombo({ items: COLORS, getText: idn, editable: true });
  b.loop.focusView(b.combo.input);
  b.loop.dispatch(key('down', { alt: true }));
  expect(popupOpen(b.overlay)).toBe(true);

  // Down while the field is focused.
  const c = makeCombo({ items: COLORS, getText: idn, editable: true });
  c.loop.focusView(c.combo.input);
  c.loop.dispatch(key('down'));
  expect(popupOpen(c.overlay)).toBe(true);
});
