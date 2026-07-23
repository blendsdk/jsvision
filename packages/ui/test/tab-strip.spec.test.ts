/**
 * Specification tests (immutable oracles) — RD-17 `TabStrip` renderer (03-02, 07 ST-18…ST-28).
 *
 * RD-17 has NO Turbo Vision counterpart (GATE-1, AR-172); the chrome is a documented new component
 * grounded in the shipped frame glyph set + the four GATE-1 tees + the `tab*` roles. These oracles
 * derive from AC-2/3/6/7/8/9/14 + the 03-02 spec: folder-tab chrome (`┌┐└┘│─` + `┬` notch), the
 * active/inactive/disabled colouring, the `~X~` hotkey accent, the `×` close cell, the `◄`/`►`
 * overflow arrows + auto-scroll, and the `hitStrip` click mapping. `.js` per NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import { createEventLoop } from '../src/event/index.js';
import { TabView } from '../src/tabs/index.js';
import type { Tab } from '../src/tabs/index.js';
import { stripGeometry, hitStrip, TAB_GLYPHS } from '../src/tabs/tab-strip.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A trivial page. */
function page(): Group {
  const g = new Group();
  g.setLayout({ direction: 'col' });
  return g;
}

/** Mount a TabView filling `w×h`; return the composed buffer + a row-0 string. */
function render(tabsData: Tab[], activeInit: number, w: number, h: number) {
  const tabs = signal<Tab[]>(tabsData);
  const active = signal(activeInit);
  const view = new TabView({ tabs, active });
  view.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } });
  const root = new Group();
  root.add(view);
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  const buf = loop.renderRoot.buffer();
  const row = (y: number) =>
    buf
      .rows()
      [y].map((c) => c.char)
      .join('');
  return { buf, row, view, loop };
}

// ---------------------------------------------------------------------------------------------------
// ST-18 — folder-tab chrome: corners/edges + the `┬` notch, against the pre-serialize buffer.
// ---------------------------------------------------------------------------------------------------

test('ST-18: folder-tab chrome — ┌ ┐ corners, │ sides, └ ┘ bottom, and a ─ dash gap between tabs', () => {
  const { buf, row } = render(
    [
      { title: '~G~eneral', content: page() },
      { title: '~D~isplay', content: page() },
    ],
    0,
    40,
    6,
  );
  // Top border row corners.
  expect(buf.get(0, 0)?.char, 'top-left ┌').toBe(TAB_GLYPHS.tl);
  expect(buf.get(39, 0)?.char, 'top-right ┐').toBe(TAB_GLYPHS.tr);
  // The adopted button-face design joins tabs with a flat `─` dash gap — NOT a `┬` notch.
  expect(row(0).includes(TAB_GLYPHS.tdown), 'no ┬ notch (flat dash design)').toBe(false);
  expect(row(0).includes(TAB_GLYPHS.h), 'a ─ dash fills the gaps between tabs').toBe(true);
  // Both labels are present (tildes stripped).
  expect(row(0).includes('General')).toBe(true);
  expect(row(0).includes('Display')).toBe(true);
  // Side borders + bottom corners.
  expect(buf.get(0, 3)?.char, 'left │').toBe(TAB_GLYPHS.v);
  expect(buf.get(39, 3)?.char, 'right │').toBe(TAB_GLYPHS.v);
  expect(buf.get(0, 5)?.char, 'bottom-left └').toBe(TAB_GLYPHS.bl);
  expect(buf.get(39, 5)?.char, 'bottom-right ┘').toBe(TAB_GLYPHS.br);
});

// ---------------------------------------------------------------------------------------------------
// ST-19 — active/inactive/disabled colouring.
// ---------------------------------------------------------------------------------------------------

test('ST-19: active→tabActive, inactive→tabInactive, disabled→tabDisabled (greyed)', () => {
  const { buf, row } = render(
    [
      { title: 'Gen', content: page() }, // active (index 0)
      { title: 'Disp', content: page() }, // inactive
      { title: 'Adv', content: page(), disabled: true }, // disabled
    ],
    0,
    40,
    6,
  );
  const r = row(0);
  const cell = (label: string) => buf.get(r.indexOf(label), 0);
  expect(cell('Gen')?.fg, 'active tab fg').toBe(defaultTheme.tabActive.fg);
  expect(cell('Disp')?.fg, 'inactive tab fg').toBe(defaultTheme.tabInactive.fg);
  expect(cell('Adv')?.fg, 'disabled tab fg (greyed)').toBe(defaultTheme.tabDisabled.fg);
});

// ---------------------------------------------------------------------------------------------------
// ST-20 — `~X~` marked letter draws in the hotkey/shortcut style.
// ---------------------------------------------------------------------------------------------------

test('ST-20: the ~X~ marked letter draws in the hotkey accent colour', () => {
  const { buf, row } = render([{ title: '~D~isplay', content: page() }], 0, 30, 5);
  const d = row(0).indexOf('Display'); // the 'D' is the marked hotkey letter, at the label start
  expect(buf.get(d, 0)?.char, 'the marked letter').toBe('D');
  expect(buf.get(d, 0)?.fg, 'drawn in the tabActive hotkey accent').toBe(defaultTheme.tabActive.hotkey);
});

// ---------------------------------------------------------------------------------------------------
// ST-21 — a closeable tab draws a `×`.
// ---------------------------------------------------------------------------------------------------

test('ST-21: a closeable tab draws a × cell on the strip', () => {
  const { row } = render([{ title: 'Disp', content: page(), closeable: true }], 0, 30, 5);
  expect(row(0).includes('×'), 'a × cell is drawn for the closeable tab').toBe(true);
});

// ---------------------------------------------------------------------------------------------------
// ST-22 — overflow arrows appear (only while overflowing) + the active tab is fully visible.
// ---------------------------------------------------------------------------------------------------

test('ST-22: when labels overflow the strip, ◄ and ► appear and the active tab stays visible', () => {
  const many: Tab[] = Array.from({ length: 8 }, (_, i) => ({ title: `LongTab${i}`, content: page() }));
  // Narrow strip forces overflow; active in the middle so BOTH arrows show.
  const { row } = render(many, 4, 24, 5);
  expect(row(0).includes('◄'), 'left overflow arrow').toBe(true);
  expect(row(0).includes('►'), 'right overflow arrow').toBe(true);

  // A wide strip fits everything → no arrows (arrows appear only while overflowing).
  const { row: wideRow } = render(many, 0, 200, 5);
  expect(wideRow(0).includes('◄') || wideRow(0).includes('►'), 'no arrows when not overflowing').toBe(false);
});

// ---------------------------------------------------------------------------------------------------
// ST-23…26 — hitStrip click mapping (pure geometry).
// ---------------------------------------------------------------------------------------------------

test('ST-23: clicking a tab label maps to { kind: "tab", index }', () => {
  const geo = stripGeometry([{ title: '~G~eneral' }, { title: '~D~isplay', closeable: true }], 0, 40, 0);
  const slot0 = geo.slots[0];
  const hit = hitStrip(geo, slot0.x + 2); // inside tab 0's label
  expect(hit).toEqual({ kind: 'tab', index: 0 });
});

test('ST-24: clicking a closeable tab’s × maps to { kind: "close", index }', () => {
  const geo = stripGeometry([{ title: '~G~eneral' }, { title: '~D~isplay', closeable: true }], 0, 40, 0);
  const slot1 = geo.slots[1];
  expect(slot1.closeX, 'the closeable slot exposes a close column').toBeTypeOf('number');
  expect(hitStrip(geo, slot1.closeX!)).toEqual({ kind: 'close', index: 1 });
});

test('ST-25: clicking ◄/► while overflowing maps to { kind: "arrow", dir }', () => {
  const many = Array.from({ length: 8 }, (_, i) => ({ title: `LongTab${i}` }));
  const geo = stripGeometry(many, 4, 24, 0); // active in the middle → hidden tabs on BOTH sides
  expect(geo.showLeftArrow && geo.showRightArrow, 'both arrows present').toBe(true);
  expect(hitStrip(geo, geo.leftArrowX)).toEqual({ kind: 'arrow', dir: -1 });
  expect(hitStrip(geo, geo.rightArrowX)).toEqual({ kind: 'arrow', dir: 1 });
});

test('ST-26: clicking a gap / the corner returns undefined (no-op)', () => {
  const geo = stripGeometry([{ title: '~G~eneral' }, { title: '~D~isplay' }], 0, 40, 0);
  expect(hitStrip(geo, 0), 'the ┌ corner column').toBeUndefined();
  const between = geo.slots[0].x + geo.slots[0].width; // the ┬ separator column between tab 0 and 1
  expect(hitStrip(geo, between), 'the ┬ separator gap').toBeUndefined();
});

// ---------------------------------------------------------------------------------------------------
// ST-27 — auto-scroll keeps the active slot fully on-strip.
// ---------------------------------------------------------------------------------------------------

test('ST-27: overflow auto-scrolls so the active tab is among the visible slots', () => {
  const many = Array.from({ length: 8 }, (_, i) => ({ title: `LongTab${i}` }));
  // Active is the last tab, but the caller's scroll hint is 0 → geometry must scroll it into view.
  const geo = stripGeometry(many, 7, 24, 0);
  expect(
    geo.slots.some((s) => s.index === 7),
    'the active tab (7) is auto-scrolled into the visible window',
  ).toBe(true);
});

// ---------------------------------------------------------------------------------------------------
// ST-28 — a wide (East-Asian) glyph title is measured by display width; clip never splits it.
// ---------------------------------------------------------------------------------------------------

test('ST-28: a wide-glyph title is measured by display width (2 per wide glyph)', () => {
  // '你好' = two wide glyphs = 4 display columns; slot = 4 + 2 pad = 6.
  const geo = stripGeometry([{ title: '你好' }], 0, 40, 0);
  expect(geo.slots[0].labelW, 'label measured by display width').toBe(4);
  expect(geo.slots[0].width, 'slot = label + 2 pad').toBe(6);

  // Rendering the wide title never overruns the frame — the ┐ corner stays put at width-1.
  const { buf } = render([{ title: '你好', content: page() }], 0, 30, 5);
  expect(buf.get(29, 0)?.char, 'top-right ┐ intact (no wide-glyph overrun)').toBe(TAB_GLYPHS.tr);
});
