/**
 * Specification tests (immutable oracles) — jsvision-ui RD-21 `ColorSwatch` view (ST-1…ST-7).
 *
 * Source: RD-21 AC-1…AC-6/AC-15 (plans/color-family/03-01-color-swatch.md; 07-testing-strategy.md).
 * The fidelity cases diff cell-by-cell against the `TColorSelector` decode (`colorsel.cpp:120-237`,
 * GATE-1): each color = `█` (U+2588) × 3 columns at `j*3` in `{ fg: cellColor, bg: black }`; the
 * selected cell's centre (`cellX+1`) shows `◘` (U+25D8, CP437 8); a near-black cell's marker uses the
 * forced-contrast `colorMarker` role (`0x70`); wrap-around nav (`:196-217`); mouse `row*cols+floor(x/3)`
 * with revert-outside (`:167-173`). The cursor is INTERNAL (nav SoT); only the committed `value` cell
 * draws the marker, so nav/drag are observed by committing (Enter) and reading `value`.
 *
 * Rendered the shipped way (createEventLoop + mount, the calendar.spec idiom); the pre-`serialize`
 * buffer is asserted cell-by-cell. Per the immutable-oracle + TV-fidelity rules a failing oracle means
 * the CODE is wrong (and for the TV-derived draw, wrong vs `colorsel.cpp`). `.js` specifiers required.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme, PALETTE, ANSI16_ORDER } from '@jsvision/core';
import type { Color, KeyEvent, MouseEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import type { Signal } from '../src/reactive/index.js';
import { createEventLoop } from '../src/event/index.js';
import { ColorSwatch } from '../src/color/color-swatch.js';
import { gridDims } from '../src/color/color-grid.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const caps16 = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: '16' } }).profile;

const DOS16 = ANSI16_ORDER as readonly Color[];

function keyEvent(key: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key, ctrl: false, alt: false, shift: false, ...mods };
}
/** A left mouse event at 1-based terminal coords (dispatch normalizes 1-based → 0-based, AR-63). */
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}

interface SwatchHarness {
  swatch: ColorSwatch;
  loop: ReturnType<typeof createEventLoop>;
  value: Signal<Color>;
  commits: Color[];
  inputs: Color[];
  cell: (x: number, y: number) => { char: string; fg: string; bg: string } | undefined;
  markers: () => { x: number; y: number }[];
}

function makeSwatch(
  opts: {
    value?: Color;
    colors?: readonly Color[];
    columns?: number;
    focus?: boolean;
    caps?: typeof caps;
  } = {},
): SwatchHarness {
  const colors = opts.colors ?? DOS16;
  const columns = opts.columns ?? 4;
  const value = signal<Color>(opts.value ?? colors[0]);
  const commits: Color[] = []; // the discrete commit callback — `onChange` under the new taxonomy
  const inputs: Color[] = []; // the live callback — `onInput` (arrow / click / drag)
  const swatch = new ColorSwatch({
    value,
    colors,
    columns,
    onInput: (c) => inputs.push(c),
    onChange: (c) => commits.push(c),
  });
  const { width, rows } = gridDims(colors.length, columns);
  const h = Math.max(1, rows);
  swatch.layout = { position: 'absolute', rect: { x: 0, y: 0, width, height: h } };
  const root = new Group();
  root.add(swatch);
  const loop = createEventLoop({ width, height: h }, { caps: opts.caps ?? caps });
  loop.mount(root);
  if (opts.focus) loop.focusView(swatch);
  loop.renderRoot.flush();
  const buffer = () => loop.renderRoot.buffer();
  const cell = (x: number, y: number) => {
    const c = buffer().get(x, y);
    return c ? { char: c.char, fg: c.fg, bg: c.bg } : undefined;
  };
  const markers = () => {
    const out: { x: number; y: number }[] = [];
    for (let y = 0; y < h; y += 1) for (let x = 0; x < width; x += 1) if (cell(x, y)?.char === '◘') out.push({ x, y });
    return out;
  };
  return { swatch, loop, value, commits, inputs, cell, markers };
}

// ── ST-2: grid geometry cell-by-cell vs colorsel.cpp (█ ×3 cells, fg=cellColor/bg=black, 4 rows) ────

test('ST-2: a 4-column ANSI-16 swatch is a 12-col × 4-row grid of █ cells in each cell color', () => {
  const h = makeSwatch({ value: 'brightWhite' }); // value at cell 15 → other cells unmarked
  // cell 0 (black) at cols 0-2, row 0.
  for (const x of [0, 2]) {
    // col 1 is the (unmarked here) centre; check the flanking █ columns
    expect(h.cell(x, 0)?.char, `cell 0 col ${x} is █`).toBe('█');
    expect(h.cell(x, 0)?.fg, 'cell 0 fg = black name').toBe('black');
    expect(h.cell(x, 0)?.bg, 'cell 0 bg = PALETTE.black').toBe(PALETTE.black);
  }
  // cell 14 (brightCyan) at cols 6-8, row 3.
  for (const x of [6, 7, 8]) {
    expect(h.cell(x, 3)?.char, `cell 14 col ${x} is █`).toBe('█');
    expect(h.cell(x, 3)?.fg, 'cell 14 fg = brightCyan').toBe('brightCyan');
    expect(h.cell(x, 3)?.bg, 'cell 14 bg = black').toBe(PALETTE.black);
  }
  // cell 3 (yellow) at cols 9-11, row 0 → grid is 12 columns wide.
  expect(h.cell(11, 0)?.char, 'rightmost column of row 0 is a █').toBe('█');
  expect(h.cell(11, 0)?.fg, 'cell 3 fg = yellow').toBe('yellow');
});

// ── ST-3: the ◘ marker at the value cell's centre; near-black uses colorMarker (0x70) ──────────────

test('ST-3: the value cell shows ◘ (U+25D8) at cellX+1; only that cell is marked', () => {
  const h = makeSwatch({ value: 'brightCyan' }); // cell 14 → cols 6-8, row 3, centre col 7
  expect(h.cell(7, 3)?.char, 'marker ◘ at the value cell centre').toBe('◘');
  expect(h.cell(7, 3)?.fg, 'a non-near-black marker uses the cell color').toBe('brightCyan');
  expect(h.cell(7, 3)?.bg, 'marker bg is the cell black bg').toBe(PALETTE.black);
  expect(h.markers(), 'exactly one marker (the value cell)').toStrictEqual([{ x: 7, y: 3 }]);
});

test('ST-3: a near-black value cell draws ◘ in the colorMarker role (0x70 black-on-lightGray)', () => {
  const h = makeSwatch({ value: 'black' }); // cell 0 → cols 0-2, row 0, centre col 1
  expect(h.cell(1, 0)?.char, 'marker ◘ on the black cell').toBe('◘');
  expect(h.cell(1, 0)?.fg, 'colorMarker fg (black)').toBe(defaultTheme.colorMarker.fg);
  expect(h.cell(1, 0)?.bg, 'colorMarker bg (lightGray) — forced contrast').toBe(defaultTheme.colorMarker.bg);
});

// ── ST-1: the color model — member re-marks; an off-palette truecolor value shows no marker ────────

test('ST-1: setting value to a member re-marks; a truecolor value ∉ names shows no marker', () => {
  const h = makeSwatch({ value: 'brightCyan' });
  expect(h.markers().length, 'a member value is marked').toBe(1);
  h.value.set('red'); // another member → re-marks at cell 1 (cols 3-5, centre 4, row 0)
  h.loop.renderRoot.flush();
  expect(h.markers(), 'marker re-homes to red').toStrictEqual([{ x: 4, y: 0 }]);
  h.value.set('#123456'); // a truecolor ∉ ANSI16_ORDER → no marker
  h.loop.renderRoot.flush();
  expect(h.markers(), 'off-palette value → no marker').toStrictEqual([]);
});

test('ST-1: a truecolor value renders on a 16-color cap without throwing', () => {
  expect(() => makeSwatch({ value: '#123456', caps: caps16 })).not.toThrow();
});

// ── ST-4: wrap-around keyboard nav; Enter/Space commits colors[cursor]; arrows keep focus ──────────

test('ST-4: → wraps last→first, ← wraps first→last; Enter commits colors[cursor]', () => {
  const h = makeSwatch({ value: 'black', focus: true }); // cursor = 0
  h.loop.dispatch(keyEvent('left')); // navLeft(0)=15
  h.loop.dispatch(keyEvent('enter'));
  expect(h.value(), '← from first wraps to last (brightWhite)').toBe('brightWhite');
  expect(h.commits.at(-1), 'onChange (commit) fired with the committed color').toBe('brightWhite');
  // from cell 15, → wraps to 0.
  const h2 = makeSwatch({ value: 'brightWhite', focus: true }); // cursor = 15
  h2.loop.dispatch(keyEvent('right')); // navRight(15)=0
  h2.loop.dispatch(keyEvent('space'));
  expect(h2.value(), '→ from last wraps to first (black)').toBe('black');
});

test('ST-4: ↓/↑ move by ±columns with the edge-wrap decode; plain arrows never leave the swatch', () => {
  const h = makeSwatch({ value: 'black', focus: true }); // cursor 0
  h.loop.dispatch(keyEvent('down')); // navDown(0,16,4)=4 → blue
  h.loop.dispatch(keyEvent('enter'));
  expect(h.value(), '↓ from 0 → cell 4 (blue)').toBe('blue');
  expect(h.loop.getFocused(), 'plain arrow keeps focus on the swatch').toBe(h.swatch);
  const h2 = makeSwatch({ value: 'black', focus: true }); // cursor 0
  h2.loop.dispatch(keyEvent('up')); // navUp(0,16,4)=15 → brightWhite
  h2.loop.dispatch(keyEvent('enter'));
  expect(h2.value(), '↑ from 0 wraps to cell 15 (brightWhite)').toBe('brightWhite');
});

// ── DX taxonomy (ST-4): onInput = live (arrow/click/drag), onChange = commit (Enter/Space/mouse-up) ─

test('DX ST-4: arrow nav fires onInput (not onChange); Enter over a cell fires onChange', () => {
  const h = makeSwatch({ value: 'black', focus: true }); // cursor 0
  h.loop.dispatch(keyEvent('right')); // navRight(0)=1 → live select
  expect(h.inputs.at(-1), 'arrow fired onInput (live)').toBe('red');
  expect(h.commits, 'arrow did NOT fire onChange (commit)').toEqual([]);
  h.loop.dispatch(keyEvent('enter')); // commit at the cursor
  expect(h.commits.at(-1), 'Enter fired onChange (commit)').toBe('red');
});

test('DX ST-4: select(color) fires both onInput (live) and onChange (commit)', () => {
  const h = makeSwatch({ value: 'black' });
  h.swatch.select('green');
  expect(h.inputs.at(-1), 'select fired onInput').toBe('green');
  expect(h.commits.at(-1), 'select fired onChange').toBe('green');
});

// ── ST-5: mouse down/drag sets the cursor (row*cols+floor(x/3)); revert-outside vs clamp-overshoot ──

test('ST-5: a click sets the cursor to the clicked cell; Enter commits it', () => {
  const h = makeSwatch({ value: 'black', focus: true });
  // click cell 14 (cols 6-8, row 3) at 1-based (7,4) → local (6,3) → floor(6/3)=2, row 3 → cell 14.
  h.loop.dispatch(mouse('down', 7, 4));
  h.loop.dispatch(mouse('up', 7, 4));
  h.loop.dispatch(keyEvent('enter'));
  expect(h.value(), 'click cell 14 then Enter commits brightCyan').toBe('brightCyan');
});

test('ST-5: a drag OUTSIDE the grid reverts the cursor to its pre-drag cell (colorsel.cpp:167-173)', () => {
  const h = makeSwatch({ value: 'red', focus: true }); // pre-drag cursor = 1 (red)
  h.loop.dispatch(mouse('down', 10, 1)); // 1-based (10,1) → local (9,0) → floor(9/3)=3 → cell 3 (yellow)
  h.loop.dispatch(mouse('move', 20, 1)); // local (19,0) — x ≥ width 12 → outside → revert to pre (cell 1)
  h.loop.dispatch(mouse('up', 20, 1));
  h.loop.dispatch(keyEvent('enter'));
  expect(h.value(), 'drag outside reverts to the pre-drag cell (red)').toBe('red');
});

test('ST-5: an overshoot INSIDE a partial final row clamps to colors.length-1', () => {
  // 6 colors × 4 → row 1 has cells 4,5 (cols 0-5); cols 6-11 in row 1 overshoot → clamp to 5.
  const six: readonly Color[] = ['black', 'red', 'green', 'yellow', 'blue', 'magenta'];
  const h = makeSwatch({ value: 'black', colors: six, columns: 4, focus: true });
  h.loop.dispatch(mouse('down', 10, 2)); // 1-based (10,2) → local (9,1) → floor(9/3)=3 → idx 7 ≥ 6 → clamp 5
  h.loop.dispatch(mouse('up', 10, 2));
  h.loop.dispatch(keyEvent('enter'));
  expect(h.value(), 'overshoot clamps to the last color (magenta, index 5)').toBe('magenta');
});

// ── ST-6: generic palette + defaults ──────────────────────────────────────────────────────────────

test('ST-6: 8 truecolor colors × 8 columns render one row of 8 three-wide cells (width 24)', () => {
  const eight: readonly Color[] = [
    '#111111',
    '#222222',
    '#333333',
    '#444444',
    '#555555',
    '#666666',
    '#777777',
    '#888888',
  ];
  const h = makeSwatch({ value: '#111111', colors: eight, columns: 8 });
  // cell 7 (#888888) at cols 21-23, row 0.
  expect(h.cell(21, 0)?.char, 'cell 7 is a █').toBe('█');
  expect(h.cell(21, 0)?.fg, 'cell 7 fg = its truecolor').toBe('#888888');
  expect(h.cell(23, 0)?.char, 'grid is 24 columns wide').toBe('█');
  // no second row.
  expect(h.cell(0, 1), 'single row only').toBeUndefined();
});

test('ST-6: defaults (no colors/columns) render ANSI16_ORDER as a 4×4 grid', () => {
  const value = signal<Color>('brightWhite');
  const swatch = new ColorSwatch({ value });
  swatch.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 12, height: 4 } };
  const root = new Group();
  root.add(swatch);
  const loop = createEventLoop({ width: 12, height: 4 }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  // cell 0 (black) at (0,0); cell 15 (brightWhite) at cols 9-11 row 3.
  expect(loop.renderRoot.buffer().get(0, 0)?.char, 'default palette rendered').toBe('█');
  expect(loop.renderRoot.buffer().get(9, 3)?.fg, 'cell 15 = brightWhite').toBe('brightWhite');
});

// ── ST-7: value ∉ colors — no marker; nav from the cursor; Enter commits colors[cursor]; re-home ────

test('ST-7: an off-palette value shows no marker; nav works from cursor 0; Enter commits colors[cursor]', () => {
  const h = makeSwatch({ value: '#abcdef', focus: true }); // ∉ ANSI16_ORDER → cursor inits to 0
  expect(h.markers(), 'off-palette value → no marker').toStrictEqual([]);
  h.loop.dispatch(keyEvent('right')); // navRight(0)=1
  h.loop.dispatch(keyEvent('enter'));
  expect(h.value(), 'Enter commits colors[cursor]=red (replacing the off-palette value)').toBe('red');
  // now setting value to a member re-homes the cursor to its index.
  h.value.set('green'); // cell 2
  h.loop.renderRoot.flush();
  h.loop.dispatch(keyEvent('right')); // navRight(2)=3
  h.loop.dispatch(keyEvent('enter'));
  expect(h.value(), 'a member value re-homed the cursor; → then Enter commits yellow (cell 3)').toBe('yellow');
});
