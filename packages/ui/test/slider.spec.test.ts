/**
 * Specification tests (immutable oracles) — the `Slider` value control (ST-5…ST-9).
 *
 * `Slider` is a documented new component (Turbo Vision has no trackbar), so its glyphs and colours are
 * a fresh design pinned here, not a TV decode: the groove draws in the `sliderTrack` role (`─` across a
 * horizontal bar, `│` down a vertical one) and the single thumb cell in the `sliderThumb` role (`█`),
 * with NO end-arrows (that is `ScrollBar`'s look). The thumb sits at the value's mapped cell offset
 * (the shared `track.ts` math). Keyboard/mouse/wheel drive a two-way `Signal`, firing `onInput` on
 * every live change and `onChange` on each commit — matching the `ColorSwatch` callback taxonomy.
 *
 * A failing oracle means the CODE is wrong. Rendered the shipped way (`createEventLoop` + mount); the
 * pre-`serialize` buffer is read cell-by-cell. The `.js` extension is required by NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { KeyEvent, MouseEvent, WheelEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import type { Signal } from '../src/reactive/index.js';
import { createEventLoop } from '../src/event/index.js';
import { Slider } from '../src/controls/slider.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function keyEvent(key: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key, ctrl: false, alt: false, shift: false, ...mods };
}
/** A left mouse event at 1-based terminal coords (dispatch normalizes 1-based → 0-based). */
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}
function wheel(dir: WheelEvent['dir'], x: number, y: number): WheelEvent {
  return { type: 'wheel', dir, x, y, shift: false, alt: false, ctrl: false };
}

interface SliderHarness {
  slider: Slider;
  loop: ReturnType<typeof createEventLoop>;
  value: Signal<number>;
  inputs: number[];
  commits: number[];
  cell: (x: number, y: number) => { char: string; fg: string; bg: string } | undefined;
}

function makeSlider(opts: {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  orientation?: 'horizontal' | 'vertical';
  width: number;
  height: number;
  focus?: boolean;
}): SliderHarness {
  const value = signal(opts.value ?? 0);
  const inputs: number[] = [];
  const commits: number[] = [];
  const slider = new Slider({
    value,
    min: opts.min ?? 0,
    max: opts.max ?? 100,
    step: opts.step ?? 1,
    orientation: opts.orientation ?? 'horizontal',
    onInput: (v) => inputs.push(v),
    onChange: (v) => commits.push(v),
  });
  slider.layout = { position: 'absolute', rect: { x: 0, y: 0, width: opts.width, height: opts.height } };
  const root = new Group();
  root.add(slider);
  const loop = createEventLoop({ width: opts.width, height: opts.height }, { caps });
  loop.mount(root);
  if (opts.focus) loop.focusView(slider);
  loop.renderRoot.flush();
  const cell = (x: number, y: number) => {
    const c = loop.renderRoot.buffer().get(x, y);
    return c ? { char: c.char, fg: c.fg, bg: c.bg } : undefined;
  };
  return { slider, loop, value, inputs, commits, cell };
}

// ── ST-5: a horizontal slider draws a groove + one thumb at the mapped column, no end-arrows ─────────

test('ST-5: horizontal Slider value 50/[0,100] over width 11 → thumb at col 5, groove elsewhere', () => {
  const h = makeSlider({ value: 50, min: 0, max: 100, width: 11, height: 1 });
  // value 50 over an 11-cell groove maps to offset 5 (the centre).
  expect(h.cell(5, 0)?.char, 'thumb █ at the mapped column').toBe('█');
  expect(h.cell(5, 0)?.fg, 'thumb uses sliderThumb.fg').toBe(defaultTheme.sliderThumb.fg);
  expect(h.cell(5, 0)?.bg, 'thumb uses sliderThumb.bg').toBe(defaultTheme.sliderThumb.bg);
  // A groove cell away from the thumb draws the track glyph in the sliderTrack role.
  expect(h.cell(0, 0)?.char, 'groove glyph ─').toBe('─');
  expect(h.cell(0, 0)?.fg, 'groove uses sliderTrack.fg').toBe(defaultTheme.sliderTrack.fg);
  expect(h.cell(0, 0)?.bg, 'groove uses sliderTrack.bg').toBe(defaultTheme.sliderTrack.bg);
  // No end-arrows anywhere (that is ScrollBar's look, not the Slider's).
  for (let x = 0; x < 11; x += 1) {
    expect(['◄', '►', '▲', '▼'], `col ${x} is not an arrow`).not.toContain(h.cell(x, 0)?.char);
  }
});

// ── ST-6: a vertical slider maps to a row; cross-axis width is 1 ─────────────────────────────────────

test('ST-6: vertical Slider value 50/[0,100] over height 11 → thumb on row 5; cross-axis width 1', () => {
  const h = makeSlider({ value: 50, min: 0, max: 100, orientation: 'vertical', width: 1, height: 11 });
  expect(h.cell(0, 5)?.char, 'thumb █ on the mapped row').toBe('█');
  expect(h.cell(0, 5)?.bg, 'thumb uses sliderThumb.bg').toBe(defaultTheme.sliderThumb.bg);
  expect(h.cell(0, 0)?.char, 'vertical groove glyph │').toBe('│');
  // measure() advertises a cross-axis width of 1 for a vertical slider.
  expect(h.slider.measure().width, 'vertical measure cross-axis width = 1').toBe(1);
});

// ── ST-7: keyboard — along-axis arrow, End, Home; each fires onInput + onChange ──────────────────────

test('ST-7: focused horizontal Slider: → (+step), End (→max), Home (→min); each fires onInput+onChange', () => {
  const h = makeSlider({ value: 50, min: 0, max: 100, step: 1, width: 11, height: 1, focus: true });
  h.loop.dispatch(keyEvent('right'));
  expect(h.value(), '→ steps +1').toBe(51);
  expect(h.inputs.at(-1), '→ fired onInput').toBe(51);
  expect(h.commits.at(-1), '→ fired onChange').toBe(51);
  h.loop.dispatch(keyEvent('end'));
  expect(h.value(), 'End jumps to max').toBe(100);
  expect(h.commits.at(-1), 'End fired onChange').toBe(100);
  h.loop.dispatch(keyEvent('home'));
  expect(h.value(), 'Home jumps to min').toBe(0);
  expect(h.commits.at(-1), 'Home fired onChange').toBe(0);
});

// ── ST-8: mouse press on the groove, drag, release ──────────────────────────────────────────────────

test('ST-8: press at a groove offset sets the value; drag tracks (onInput each); release commits once', () => {
  const h = makeSlider({ value: 0, min: 0, max: 100, width: 11, height: 1, focus: true });
  // press at 1-based col 11 → local x=10 (last cell) → value = max.
  h.loop.dispatch(mouse('down', 11, 1));
  expect(h.value(), 'press at the last cell → max').toBe(100);
  const inputsAfterDown = h.inputs.length;
  expect(inputsAfterDown, 'press fired onInput').toBeGreaterThan(0);
  expect(h.commits.length, 'press did NOT yet commit').toBe(0);
  // drag to 1-based col 6 → local x=5 → value 50.
  h.loop.dispatch(mouse('drag', 6, 1));
  expect(h.value(), 'drag to centre → 50').toBe(50);
  expect(h.inputs.length, 'drag fired another onInput').toBeGreaterThan(inputsAfterDown);
  expect(h.commits.length, 'drag did NOT commit').toBe(0);
  // release → exactly one onChange.
  h.loop.dispatch(mouse('up', 6, 1));
  expect(h.commits, 'release commits once with the final value').toEqual([50]);
});

// ── ST-9: wheel steps ±step, clamped, firing onInput + onChange ──────────────────────────────────────

test('ST-9: wheel up/down steps ±step, clamped, firing onInput + onChange', () => {
  const h = makeSlider({ value: 100, min: 0, max: 100, step: 1, width: 11, height: 1, focus: true });
  // wheel up increases but is already at max → clamps, no change, no callback.
  h.loop.dispatch(wheel('up', 1, 1));
  expect(h.value(), 'wheel up at max stays clamped').toBe(100);
  // wheel down steps −1.
  h.loop.dispatch(wheel('down', 1, 1));
  expect(h.value(), 'wheel down steps −1').toBe(99);
  expect(h.inputs.at(-1), 'wheel fired onInput').toBe(99);
  expect(h.commits.at(-1), 'wheel fired onChange').toBe(99);
});
