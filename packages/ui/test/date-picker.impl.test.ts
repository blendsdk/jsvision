/**
 * Implementation tests (edge cases / internals) — RD-20 `DatePicker`. Companion to `date-picker.spec`:
 * the no-host guard, open→pick→close via a mouse click on a calendar day, the ▐↓▌ button draw + click-to-
 * open, Alt+Down open, and Esc/outside cancel. Real loop + PopupHost (ComboBox idiom). `.js` specifiers
 * required by NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import type { PopupHost } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import type { Signal } from '../src/reactive/index.js';
import { createEventLoop } from '../src/event/index.js';
import { DatePicker } from '../src/date/date-picker.js';
import { Calendar } from '../src/date/calendar.js';
import type { CalendarDate } from '../src/date/calendar-date.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const TODAY: CalendarDate = { year: 2026, month: 9, day: 3 };

function key(k: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}
function mouseDown(x: number, y: number): MouseEvent {
  return { type: 'mouse', kind: 'down', button: 0, x, y };
}

function make(opts: { value?: CalendarDate | null; withHost?: boolean } = {}) {
  const loop = createEventLoop({ width: 40, height: 20 }, { caps });
  const value: Signal<CalendarDate | null> = signal(opts.value ?? null);
  const dp = new DatePicker({ value, today: TODAY });
  dp.layout = { position: 'absolute', rect: { x: 5, y: 3, width: 16, height: 1 } };
  const overlay = new Group();
  overlay.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 20 } };
  overlay.state.visible = false;
  const root = new Group();
  root.add(dp);
  root.add(overlay);
  loop.mount(root);
  if (opts.withHost !== false) {
    const host: PopupHost = { overlay, focusView: (v) => loop.focusView(v), getFocused: () => loop.getFocused() };
    loop.popupHost = host;
  }
  loop.renderRoot.flush();
  return { loop, dp, overlay, value };
}

function popupOpen(overlay: Group): boolean {
  return overlay.state.visible && overlay.children.some((c) => c instanceof Group);
}
function hostedCalendar(overlay: Group): Calendar | undefined {
  const frame = overlay.children.find((c): c is Group => c instanceof Group);
  return frame?.children.find((c): c is Calendar => c instanceof Calendar);
}

test('the dropdown button draws the shared ▐↓▌ icon at its centre cell', () => {
  const h = make();
  // The picker is [ input(fr) | ▐↓▌(3) ] at x=5..20; the button occupies the last 3 cols (18-20 0-based),
  // its centre (arrow ↓) at col 19; the field is 16 wide anchored at x=5 → 0-based cols 5..20. The button
  // now uses the shared `drawDropdownIcon` (thin ↓ U+2193), identical to ComboBox/History.
  const buf = h.loop.renderRoot.buffer();
  const rowChars = buf
    .rows()[3]
    .map((c) => c.char)
    .join('');
  expect(rowChars.includes('↓'), 'the shared ↓ dropdown arrow is drawn').toBe(true);
});

test('a mouse-down on the dropdown button opens the popup', () => {
  const h = make();
  // Button centre absolute col 19 (0-based) → 1-based mouseDown(20, 4).
  h.loop.dispatch(mouseDown(20, 4));
  expect(popupOpen(h.overlay)).toBe(true);
});

test('Alt+Down opens the popup (from the focused field)', () => {
  const h = make();
  h.loop.focusView(h.dp.input); // the picker sees the key as the Input's focus-chain ancestor (PA-12)
  h.loop.dispatch(key('down', { alt: true }));
  expect(popupOpen(h.overlay)).toBe(true);
});

test('no PopupHost → open is a no-op (headless decline)', () => {
  const h = make({ withHost: false });
  h.loop.focusView(h.dp.input);
  expect(() => h.loop.dispatch(key('down'))).not.toThrow();
  expect(popupOpen(h.overlay)).toBe(false);
});

test('open → click a day → value set + popup closed', () => {
  const h = make();
  h.loop.focusView(h.dp.input);
  h.loop.dispatch(key('down', { alt: true })); // open (calendar hosted, cursor today)
  const cal = hostedCalendar(h.overlay);
  expect(cal).toBeInstanceOf(Calendar);
  // Click today Sep 3 in the hosted (comfortable-density) calendar. The popup frame sits near the field
  // anchor; compute the calendar's absolute origin from its bounds and click grid (row0, Thursday col
  // j=4) → the day field at calendar-local col dayFieldX(4)=18 (digit "3" at 19), row weekRowY(0)=2.
  let ax = 0;
  let ay = 0;
  let node = cal as unknown as { bounds: { x: number; y: number }; parent: typeof node } | null;
  while (node) {
    ax += node.bounds.x;
    ay += node.bounds.y;
    node = node.parent;
  }
  // Sep 3 at calendar-local (19, 2); 1-based dispatch → +1 on each axis.
  h.loop.dispatch(mouseDown(ax + 19 + 1, ay + 2 + 1));
  expect(h.value(), 'clicking today commits it').toStrictEqual(TODAY);
  expect(popupOpen(h.overlay), 'popup closed after the day click').toBe(false);
});

test('Esc and outside mouse-down both cancel without changing value', () => {
  const esc = make();
  esc.loop.focusView(esc.dp.input);
  esc.loop.dispatch(key('down', { alt: true }));
  expect(popupOpen(esc.overlay), 'popup opened before Esc').toBe(true);
  esc.loop.dispatch(key('escape'));
  expect(esc.value()).toBeNull();
  expect(popupOpen(esc.overlay)).toBe(false);

  const out = make();
  out.loop.focusView(out.dp.input);
  out.loop.dispatch(key('down', { alt: true }));
  expect(popupOpen(out.overlay), 'popup opened before outside-click').toBe(true);
  out.loop.dispatch(mouseDown(1, 1)); // far top-left, outside the popup
  expect(out.value()).toBeNull();
  expect(popupOpen(out.overlay)).toBe(false);
});
