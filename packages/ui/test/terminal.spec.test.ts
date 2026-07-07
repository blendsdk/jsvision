/**
 * Specification tests (immutable oracles) — RD-08 Phase-8 `Terminal` (ST-29).
 *
 * Source: RD-08 AC-14/AC-17 + PA-8 + plan-preflight PF-006 → ST-29
 * (codeops/features/jsvision-ui/plans/editor-family/07-testing-strategy.md; 03-05 §terminal.ts).
 * TV decode (`textview.cpp:117-240`): the draw walks line boundaries BACKWARD from the queue
 * front (`prevLines`, `ttprvlns.cpp:18-47`) and auto-scrolls so the LAST line stays visible;
 * colour `mapColor(1)` → `cpScroller "\x06"` → blue window → **`terminalNormal` `0x1E`**
 * yellow-on-blue (PA-8). Content is HOSTILE — every cell passes the write-time sanitize boundary
 * (AC-17). Scroll-back is WHEEL-ONLY (PF-006: keys reach only the focused chain and `Terminal`
 * is non-focusable), snapping back to the bottom on the next write. Expectations derive from
 * RD-08 + the decode, never the implementation.
 *
 * Trace: RD-08 03-05 · PA-8 / PF-006 · ST-29.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { WheelEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { Terminal } from '../src/terminal/terminal.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function wheel(dir: WheelEvent['dir'], x: number, y: number): WheelEvent {
  return { type: 'wheel', dir, x: x + 1, y: y + 1, shift: false, alt: false, ctrl: false };
}

function mountTerminal(w = 12, h = 3) {
  const term = new Terminal();
  const root = new Group();
  root.layout = { direction: 'col' };
  term.layout = { size: { kind: 'fr', weight: 1 } };
  root.add(term);
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  return { loop, term };
}

function rowText(loop: ReturnType<typeof createEventLoop>, y: number, w: number): string {
  const buf = loop.renderRoot.buffer();
  let s = '';
  for (let x = 0; x < w; x++) s += buf.get(x, y)?.char ?? ' ';
  return s;
}

// ST-29 / AC-14 — auto-scroll keeps the last line visible; colours are terminalNormal 0x1E.
test('ST-29: writes beyond the view height auto-scroll — the last line stays visible', () => {
  const { loop, term } = mountTerminal();
  for (let i = 0; i < 6; i++) term.writeLine(`log-${i}`);
  loop.renderRoot.flush();
  expect(rowText(loop, 2, 12).trimEnd()).toBe('log-5'); // bottom-anchored (decode :235)
  expect(rowText(loop, 0, 12).trimEnd()).toBe('log-3');
});

test('ST-29: terminal cells paint terminalNormal (0x1E yellow-on-blue)', () => {
  const { loop, term } = mountTerminal();
  term.writeLine('hello');
  loop.renderRoot.flush();
  const cell = loop.renderRoot.buffer().get(0, 2);
  expect(cell?.fg).toBe(defaultTheme.terminalNormal.fg);
  expect(cell?.bg).toBe(defaultTheme.terminalNormal.bg);
});

// ST-29 / AC-17 — hostile bytes are inert once composed.
test('ST-29: OSC/C0 bytes in a write land inert in the buffer', () => {
  const { loop, term } = mountTerminal();
  term.writeLine('a\u001b]0;pwned\u0007b\u0001');
  loop.renderRoot.flush();
  const buf = loop.renderRoot.buffer();
  for (let x = 0; x < 12; x++) {
    const ch = buf.get(x, 2)?.char ?? ' ';
    for (const cp of ch) {
      const code = cp.codePointAt(0) ?? 0x20;
      expect(code >= 0x20 && code !== 0x7f, `col ${x} inert`).toBe(true);
    }
  }
});

// PF-006 — wheel-only scroll-back, snapping back on the next write.
test('ST-29: wheel scrolls back through the ring; the next write snaps to the bottom', () => {
  const { loop, term } = mountTerminal();
  for (let i = 0; i < 8; i++) term.writeLine(`ln${i}`);
  loop.renderRoot.flush();
  expect(rowText(loop, 2, 12).trimEnd()).toBe('ln7');

  loop.dispatch(wheel('up', 2, 1)); // scroll back
  loop.renderRoot.flush();
  expect(rowText(loop, 2, 12).trimEnd()).not.toBe('ln7'); // older content revealed

  term.writeLine('ln8'); // a new write snaps back to the bottom
  loop.renderRoot.flush();
  expect(rowText(loop, 2, 12).trimEnd()).toBe('ln8');
});

test('Terminal is not focusable (PF-006 — the passive log sink)', () => {
  const { term } = mountTerminal();
  expect(term.focusable).toBe(false);
});
