/**
 * Specification tests (immutable oracles) — the `Switch` toggle control (GH #11), ST-19…ST-26: a
 * single boolean bound to a two-way `Signal<boolean>`, toggled by Space/Enter/click/Alt-hotkey, with
 * an on/off/focus/disabled render, a no-Unicode knob fallback, and a non-zero `measure()`.
 *
 * Expectations derive from the requirement + the design (track inner width 4, knob `●`/`o`, green-on
 * vs dim-off) only, never the implementation. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { KeyEvent, MouseEvent as CoreMouseEvent } from '@jsvision/core';
import { Switch } from '../src/controls/index.js';
import { Button } from '../src/controls/index.js';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import type { Signal } from '../src/reactive/index.js';

const caps = resolveCapabilities({
  env: { LANG: 'en_US.UTF-8' },
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;
const noUnicodeCaps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;

function key(k: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}
function mouse(kind: 'down' | 'up', x: number, y: number): CoreMouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}

/** Mount a Switch filling `w×h`, focus it, and return the loop + a buffer accessor. */
function hosted(sw: Switch, value: Signal<boolean>, w = 24, h = 1, useCaps = caps) {
  sw.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } });
  const root = new Group();
  root.add(sw);
  const loop = createEventLoop({ width: w, height: h }, { caps: useCaps });
  loop.mount(root);
  loop.focusView(sw);
  return { loop, buf: () => loop.renderRoot.buffer(), value };
}

/** The view-local column of the first `[` bracket in row 0 (the track start). */
function trackStart(buf: ReturnType<ReturnType<typeof hosted>['buf']>, w: number): number {
  for (let x = 0; x < w; x += 1) if (buf.get(x, 0)?.char === '[') return x;
  return -1;
}

test('ST-19: Space toggles the bound value both ways', () => {
  const value = signal(false);
  const { loop } = hosted(new Switch({ value }), value);
  loop.dispatch(key('space'));
  expect(value()).toBe(true);
  loop.dispatch(key('space'));
  expect(value()).toBe(false);
});

test('ST-20: a click on the control focuses it and toggles', () => {
  const value = signal(false);
  const root = new Group();
  const sw = new Switch({ value });
  sw.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 24, height: 1 } });
  root.add(sw);
  const loop = createEventLoop({ width: 24, height: 1 }, { caps });
  loop.mount(root);
  // Not focused yet; a click focuses + toggles. (1-based coords ⇒ local (1,0), inside the track.)
  loop.dispatch(mouse('down', 2, 1));
  loop.dispatch(mouse('up', 2, 1));
  expect(value()).toBe(true);
  expect(sw.state.focused).toBe(true);
});

test('ST-21: on-state — track painted green (button/buttonFocused), knob at the right', () => {
  const value = signal(true);
  const w = 24;
  const { buf } = hosted(new Switch({ value, onLabel: '', offLabel: '' }), value, w);
  const start = trackStart(buf(), w);
  // Track cells sit on the green button palette (focused ⇒ buttonFocused, same green bg).
  expect(buf().get(start + 1, 0)?.bg).toBe(defaultTheme.buttonFocused.bg);
  expect(defaultTheme.buttonFocused.bg).toBe(defaultTheme.button.bg); // both green
  // Knob at the rightmost inner cell (inner width 4 ⇒ index 3), '●' under Unicode.
  expect(buf().get(start + 4, 0)?.char).toBe('●');
});

test('ST-22: off-state — dim track, knob at the left', () => {
  const value = signal(false);
  const w = 24;
  const { buf } = hosted(new Switch({ value, onLabel: '', offLabel: '' }), value, w);
  const start = trackStart(buf(), w);
  // Off track sits on the dim staticText palette, distinct from the on green.
  expect(buf().get(start + 1, 0)?.bg).toBe(defaultTheme.staticText.bg);
  expect(defaultTheme.staticText.bg).not.toBe(defaultTheme.button.bg);
  // Knob at the leftmost inner cell (index 0).
  expect(buf().get(start + 1, 0)?.char).toBe('●');
});

test('ST-23: under no-Unicode caps the knob renders as ASCII `o`', () => {
  const value = signal(true);
  const w = 24;
  const { buf } = hosted(new Switch({ value, onLabel: '', offLabel: '' }), value, w, 1, noUnicodeCaps);
  const start = trackStart(buf(), w);
  expect(buf().get(start + 4, 0)?.char).toBe('o'); // knob right, ASCII
  // No `●` anywhere on the row.
  for (let x = 0; x < w; x += 1) expect(buf().get(x, 0)?.char).not.toBe('●');
});

test('ST-24: an Alt-hotkey from elsewhere in the scope focuses + toggles the switch', () => {
  const value = signal(false);
  const other = new Button('~B~tn', { command: 'b' });
  other.setLayout({ position: 'absolute', rect: { x: 0, y: 2, width: 10, height: 2 } });
  const sw = new Switch({ value, label: '~A~irplane' });
  sw.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 24, height: 1 } });
  const root = new Group();
  root.add(sw);
  root.add(other);
  const loop = createEventLoop({ width: 24, height: 6 }, { caps });
  loop.mount(root);
  loop.focusView(other); // focus is elsewhere
  loop.dispatch(key('a', { alt: true }));
  expect(value()).toBe(true);
  expect(sw.state.focused).toBe(true);
});

test('ST-25: a disabled switch ignores Space, is not focusable, and draws dim', () => {
  const value = signal(false);
  const w = 24;
  const sw = new Switch({ value, disabled: true });
  const { loop, buf } = hosted(sw, value, w);
  expect(sw.state.focused).toBe(false); // focusView could not focus a disabled control
  loop.dispatch(key('space'));
  expect(value()).toBe(false); // inert
  const start = trackStart(buf(), w);
  expect(buf().get(start + 1, 0)?.bg).toBe(defaultTheme.clusterDisabled.bg); // dim (cyan)
});

test('ST-26: measure() returns a non-zero intrinsic size (label + track + text, height 1)', () => {
  const value = signal(false);
  const bare = new Switch({ value, onLabel: '', offLabel: '' }).measure?.();
  expect(bare).toBeDefined();
  expect(bare?.height).toBe(1);
  expect(bare?.width).toBe(6); // just the `[    ]` track (inner 4 + 2 brackets)

  const labelled = new Switch({ value, label: '~A~irplane' }).measure?.();
  // Label ('Airplane' = 8) + space + track (6) + space + max('On','Off') = 3 ⇒ 8+1+6+1+3 = 19.
  expect(labelled?.width).toBe(19);
  expect(labelled?.height).toBe(1);
});
