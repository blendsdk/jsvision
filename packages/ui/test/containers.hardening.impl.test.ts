/**
 * Implementation tests — containers/lists hardening (RD-13). Edge/error paths for HR-49…HR-62:
 * track-click clamping at the ends, the highlight precedence matrix, the reserved corner across
 * sizes, and click-below-rows on a scrolled list. Complements the ST-8.n–s spec oracles.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { MouseEvent } from '@jsvision/core';
import { Group, createRenderRoot } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { View } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { ScrollBar, Scroller } from '../src/scroll/index.js';
import { ListBox } from '../src/list/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}

// HR-49 — a track click adjacent to an arrow clamps the value between the arrows (never past min/max).
test('HR-49 impl: track clicks clamp between the arrows', () => {
  const value = signal(50);
  const bar = new ScrollBar({ value, min: 0, max: 100, orientation: 'vertical' });
  const loop = createEventLoop({ width: 1, height: 12 }, { caps });
  loop.mount(bar);

  loop.dispatch(mouse('down', 1, 2)); // just below the top arrow → clamps toward min
  loop.dispatch(mouse('up', 1, 2));
  expect(value()).toBeGreaterThanOrEqual(0);
  expect(value()).toBeLessThan(50);

  loop.dispatch(mouse('down', 1, 11)); // just above the bottom arrow → clamps toward max
  loop.dispatch(mouse('up', 1, 11));
  expect(value()).toBeLessThanOrEqual(100);
  expect(value()).toBeGreaterThan(50);
});

// HR-50 — the highlight precedence matrix (focused×active × selected).
test('HR-50 impl: highlight precedence across focused/active/selected', () => {
  const items = signal(['a', 'b', 'c']);
  const list = new ListBox({ items, focused: signal(0), selected: signal(1) });
  list.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 12, height: 3 } };
  const g = new Group();
  g.add(list);
  const loop = createEventLoop({ width: 13, height: 3 }, { caps });
  loop.mount(g);

  loop.focusView(list.rows); // active
  let buf = loop.renderRoot.buffer();
  expect(buf.get(1, 0)?.bg).toBe(defaultTheme.listFocused.bg); // row 0 focused+active → listFocused
  expect(buf.get(1, 1)?.fg).toBe(defaultTheme.listSelected.fg); // row 1 selected → listSelected
  expect(buf.get(1, 2)?.fg).toBe(defaultTheme.listNormal.fg); // row 2 → listNormal

  // Focus away: row 0 (focused) drops to listSelected; row 1 (selected) stays listSelected.
  const stub = new (class extends View {
    override focusable = true;
    draw(_c: DrawContext): void {}
  })();
  stub.layout = { position: 'absolute', rect: { x: 0, y: 2, width: 2, height: 1 } };
  g.add(stub);
  loop.focusView(stub);
  buf = loop.renderRoot.buffer();
  expect(buf.get(1, 0)?.fg).toBe(defaultTheme.listSelected.fg); // focused row now listSelected
  expect(buf.get(1, 0)?.bg).not.toBe(defaultTheme.listFocused.bg); // no longer the bright focused bg
});

// HR-61 — the reserved corner is present regardless of scroller size (checked at two sizes).
test('HR-61 impl: the corner cell is reserved across sizes', () => {
  const build = (w: number, h: number): string | undefined => {
    const content = new (class extends View {
      draw(ctx: DrawContext): void {
        ctx.fill('#', ctx.color('listNormal'));
      }
    })();
    const scroller = new Scroller({ content, extent: { width: 60, height: 60 }, scrollbars: 'both' });
    scroller.layout = { position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } };
    const g = new Group();
    g.add(scroller);
    const rr = createRenderRoot({ width: w, height: h }, { caps });
    rr.mount(g);
    rr.flush();
    return rr.buffer().get(w - 1, h - 1)?.char;
  };
  expect(build(8, 5)).not.toBe('#'); // small
  expect(build(20, 12)).not.toBe('#'); // larger
});

// HR-62 — a click below the rows on a scrolled list still clamps to the last item.
test('HR-62 impl: click below rows on a scrolled list clamps to the last item', () => {
  const items = signal(['i0', 'i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7']);
  const selected = signal(-1);
  const list = new ListBox({ items, selected, focused: signal(7) }); // scrolled to the bottom
  list.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 12, height: 4 } };
  const g = new Group();
  g.add(list);
  const loop = createEventLoop({ width: 13, height: 4 }, { caps });
  loop.mount(g);
  loop.focusView(list.rows);
  loop.renderRoot.flush(); // establish topItem via keepVisible

  loop.dispatch(mouse('down', 2, 4)); // click below the visible rows
  expect(selected()).toBe(7); // clamped to the last item
});
