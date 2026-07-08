/**
 * Specification tests (immutable oracles) — jsvision-ui RD-21 `ColorPicker` (ST-8, ST-9, ST-10).
 *
 * Source: RD-21 AC-7/AC-8/AC-9 (plans/color-family/03-02-color-picker.md; 07-testing-strategy.md).
 * `ColorPicker` is a `Group` = a color chip + a trailing `▐↓▌` button opening a `ColorSwatch` (+ an
 * optional hex `Input`) in the generalized anchored popup (mirrors `DatePicker`). It has NO TV
 * counterpart — spec oracles only; expectations derive from the plan/AC. Commit-on-release (PA-11):
 * a drag previews (cursor tracks), a mouse-down alone does not close, releasing over a cell commits
 * `value` + closes; Enter also commits+closes; Esc / outside-down close without changing `value`.
 *
 * Real objects: a real `EventLoop` supplies the `PopupHost` (the DatePicker test idiom); a real
 * `ColorSwatch` + hex `Input` are hosted; synthetic dispatch; headless. `.js` specifiers required.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { Color, KeyEvent, MouseEvent } from '@jsvision/core';
import { Group, View } from '../src/view/index.js';
import type { PopupHost } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import type { Signal } from '../src/reactive/index.js';
import { createEventLoop } from '../src/event/index.js';
import { absoluteRect } from '../src/dropdown/index.js';
import { ColorPicker } from '../src/color/color-picker.js';
import { ColorSwatch } from '../src/color/color-swatch.js';
import { Input } from '../src/controls/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function keyEvent(key: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key, ctrl: false, alt: false, shift: false, ...mods };
}
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}

/** Depth-first search for the first descendant matching `pred`. */
function find<T extends View>(root: View, pred: (v: View) => v is T): T | undefined {
  if (pred(root)) return root;
  if (root instanceof Group)
    for (const c of root.children) {
      const hit = find(c, pred);
      if (hit) return hit;
    }
  return undefined;
}
const findSwatch = (o: View) => find(o, (v): v is ColorSwatch => v instanceof ColorSwatch);
const findHex = (o: View) => find(o, (v): v is Input => v instanceof Input);
const popupOpen = (overlay: Group) => overlay.state.visible && overlay.children.some((c) => c instanceof Group);

interface PHarness {
  loop: ReturnType<typeof createEventLoop>;
  picker: ColorPicker;
  overlay: Group;
  value: Signal<Color>;
  inputs: Color[]; // the picker's own onInput fires (live: arrow / click / drag)
  commits: Color[]; // the picker's own onChange fires (commit: Enter / Space / mouse-up)
}

function makePicker(
  opts: { value?: Color; colors?: readonly Color[]; columns?: number; allowCustom?: boolean; withHost?: boolean } = {},
): PHarness {
  const loop = createEventLoop({ width: 40, height: 20 }, { caps });
  const value = signal<Color>(opts.value ?? 'red');
  const inputs: Color[] = [];
  const commits: Color[] = [];
  const picker = new ColorPicker({
    value,
    colors: opts.colors,
    columns: opts.columns,
    allowCustom: opts.allowCustom,
    onInput: (c) => inputs.push(c),
    onChange: (c) => commits.push(c),
  });
  picker.layout = { position: 'absolute', rect: { x: 5, y: 3, width: 16, height: 1 } };
  const overlay = new Group();
  overlay.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 20 } };
  overlay.state.visible = false;
  const root = new Group();
  root.add(picker);
  root.add(overlay);
  loop.mount(root);
  if (opts.withHost !== false) {
    const host: PopupHost = { overlay, focusView: (v) => loop.focusView(v), getFocused: () => loop.getFocused() };
    loop.popupHost = host;
  }
  loop.renderRoot.flush();
  return { loop, picker, overlay, value, inputs, commits };
}

/** Open the popup by focusing the picker and pressing Down; return the hosted swatch. */
function open(h: PHarness): ColorSwatch {
  h.loop.focusView(h.picker);
  h.loop.dispatch(keyEvent('down'));
  h.loop.renderRoot.flush();
  const sw = findSwatch(h.overlay);
  if (!sw) throw new Error('no swatch hosted');
  return sw;
}
/** 1-based mouse coords hitting swatch cell `i` (cellX=(i%cols)*3, cellRow=floor(i/cols)). */
function swatchCell(sw: ColorSwatch, i: number, cols = 4): { x: number; y: number } {
  const r = absoluteRect(sw);
  return { x: r.x + (i % cols) * 3 + 1, y: r.y + Math.floor(i / cols) + 1 };
}

// ── ST-8: chip + open/commit-on-release/cancel + no-host guard ────────────────────────────────────

test('ST-8: the chip renders the current value as a █ block', () => {
  const h = makePicker({ value: 'brightCyan' });
  const buffer = h.loop.renderRoot.buffer();
  // The chip's leading block cell sits at the picker origin (5,3); it shows the value color.
  const cell = buffer.get(5, 3);
  expect(cell?.char, 'chip draws a █ block').toBe('█');
  expect(cell?.fg, 'chip block uses the value color').toBe('brightCyan');
});

test('ST-8: Down opens the swatch popup when a PopupHost is present; the swatch receives focus', () => {
  const h = makePicker();
  const sw = open(h);
  expect(popupOpen(h.overlay), 'popup opened').toBe(true);
  expect(sw, 'a ColorSwatch is hosted').toBeInstanceOf(ColorSwatch);
  expect(h.loop.getFocused(), 'the swatch is focused on open (grid-first)').toBe(sw);
});

test('ST-8: Alt+Down opens (the alt trigger branch)', () => {
  const h = makePicker();
  h.loop.focusView(h.picker); // the key routes to the focused picker; Alt+Down exercises the `|| alt` branch
  h.loop.dispatch(keyEvent('down', { alt: true }));
  h.loop.renderRoot.flush();
  expect(popupOpen(h.overlay), 'Alt+Down opens').toBe(true);
});

test('ST-8: with NO PopupHost, opening is a no-op (headless decline, no crash)', () => {
  const h = makePicker({ withHost: false });
  h.loop.focusView(h.picker);
  expect(() => h.loop.dispatch(keyEvent('down'))).not.toThrow();
  expect(popupOpen(h.overlay), 'no popup without a host').toBe(false);
});

test('ST-8: a ▐↓▌ button click opens the popup', () => {
  const h = makePicker();
  // The button is the trailing 3 cells of the 16-wide picker at x5 → local cols 13-15 → abs 18-20.
  h.loop.dispatch(mouse('down', 19, 4)); // abs (18,3) → inside the button
  h.loop.renderRoot.flush();
  expect(popupOpen(h.overlay), 'button click opened the popup').toBe(true);
});

test('ST-8: a mouse-down alone does NOT close (drag previews live, TV-faithful); releasing over a cell closes', () => {
  const h = makePicker({ value: 'black' }); // cursor inits to cell 0
  const sw = open(h);
  const a = swatchCell(sw, 2); // green
  const b = swatchCell(sw, 5); // magenta
  h.loop.dispatch(mouse('down', a.x, a.y)); // press on cell 2 — previews live, does NOT close
  expect(popupOpen(h.overlay), 'down alone keeps the popup open').toBe(true);
  // TV-faithful live-select (colorsel.cpp:170) — down previews cell 2 (green) into the shared value.
  expect(h.value(), 'down previews live').toBe('green');
  h.loop.dispatch(mouse('move', b.x, b.y)); // drag to cell 5 — still open, value tracks
  expect(popupOpen(h.overlay), 'drag keeps the popup open').toBe(true);
  h.loop.dispatch(mouse('up', b.x, b.y)); // release over cell 5 — value is magenta, closes
  expect(h.value(), 'release over cell 5 = magenta').toBe('magenta');
  expect(popupOpen(h.overlay), 'popup closed after release').toBe(false);
});

test('ST-8: Enter on the swatch cursor commits + closes', () => {
  const h = makePicker({ value: 'red' }); // cursor inits to cell 1
  open(h);
  h.loop.dispatch(keyEvent('right')); // cursor → 2 (green)
  h.loop.dispatch(keyEvent('enter'));
  expect(h.value(), 'Enter commits colors[cursor] = green').toBe('green');
  expect(popupOpen(h.overlay), 'popup closed after Enter').toBe(false);
});

test('ST-8: Esc dismisses without changing value', () => {
  const h = makePicker({ value: 'red' });
  open(h);
  h.loop.dispatch(keyEvent('escape'));
  expect(h.value(), 'value unchanged on Esc').toBe('red');
  expect(popupOpen(h.overlay)).toBe(false);
});

test('ST-8: an outside mouse-down dismisses without changing value', () => {
  const h = makePicker({ value: 'red' });
  open(h);
  h.loop.dispatch(mouse('down', 39, 20)); // far corner, outside the popup
  expect(h.value(), 'value unchanged on outside-down').toBe('red');
  expect(popupOpen(h.overlay)).toBe(false);
});

// ── DX taxonomy (ST-5): the picker exposes its own onInput (live) / onChange (commit) split ─────────

test('DX ST-5: arrow nav fires the picker onInput and keeps the popup open; Enter fires onChange once + closes', () => {
  const h = makePicker({ value: 'black' }); // swatch cursor inits to cell 0
  open(h);
  h.loop.dispatch(keyEvent('right')); // swatch cursor → cell 1 (red), live
  expect(h.inputs.at(-1), "the picker's onInput fired on live arrow nav").toBe('red');
  expect(h.commits, 'live nav did NOT commit').toEqual([]);
  expect(popupOpen(h.overlay), 'popup stays open during live nav').toBe(true);
  h.loop.dispatch(keyEvent('enter')); // commit at the cursor
  expect(h.commits, "the picker's onChange fired exactly once, with the committed value").toEqual(['red']);
  expect(popupOpen(h.overlay), 'popup closed on commit').toBe(false);
});

// ── ST-9: hex entry + allowCustom ─────────────────────────────────────────────────────────────────

test('ST-9: allowCustom (default) hosts a hex Input; a complete valid #rrggbb sets value + closes', () => {
  const h = makePicker({ value: 'red' });
  open(h);
  const hex = findHex(h.overlay);
  expect(hex, 'a hex Input is hosted').toBeInstanceOf(Input);
  h.loop.dispatch(keyEvent('tab')); // grid-first → Tab moves focus swatch → hex Input (AC-8)
  h.loop.renderRoot.flush();
  hex!.getValueSignal().set('#12ab34'); // a complete valid entry (via toRgb)
  h.loop.renderRoot.flush();
  expect(h.value(), 'complete valid hex → value (truecolor)').toBe('#12ab34');
  h.loop.dispatch(keyEvent('enter')); // Enter closes
  expect(popupOpen(h.overlay), 'popup closed after hex Enter').toBe(false);
});

test('ST-9: incomplete or invalid hex leaves value unchanged', () => {
  const h = makePicker({ value: 'green' });
  open(h);
  const hex = findHex(h.overlay)!;
  hex.getValueSignal().set('#12'); // incomplete → toRgb throws → not committed
  h.loop.renderRoot.flush();
  expect(h.value(), 'incomplete hex leaves value unchanged').toBe('green');
});

test('ST-9: allowCustom:false hosts the grid only (no hex Input row)', () => {
  const h = makePicker({ value: 'red', allowCustom: false });
  open(h);
  expect(findSwatch(h.overlay), 'the swatch is hosted').toBeInstanceOf(ColorSwatch);
  expect(findHex(h.overlay), 'no hex Input when allowCustom is false').toBeUndefined();
});

// ── ST-10: popup consumption ──────────────────────────────────────────────────────────────────────

test('ST-10: the ColorSwatch is hosted via openAnchoredPopup, shares the value, and commits through it', () => {
  const h = makePicker({ value: 'red' });
  const sw = open(h);
  expect(sw.value, 'the hosted swatch shares the picker value signal').toBe(h.value);
  // A keyboard commit on the shared swatch flows back to the picker value + closes (popup consumed).
  h.loop.dispatch(keyEvent('down')); // cursor 1 → 5 (navDown)
  h.loop.dispatch(keyEvent('enter'));
  expect(h.value(), 'swatch commit sets the shared value (magenta, cell 5)').toBe('magenta');
  expect(popupOpen(h.overlay), 'popup consumed the commit and closed').toBe(false);
});
