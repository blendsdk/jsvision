/**
 * Implementation tests — occlusion-aware partial recompose (render root).
 *
 * Partial recompose redraws a dirty subtree in isolation, which is only correct when nothing paints
 * over it. With overlapping windows, a perpetually-dirty *content* view behind another window would
 * (naively) redraw itself over the front window — borders stay correct (their parent isn't dirty),
 * but the back content bleeds on top. The render root must detect the occluder and escalate that
 * frame to a full, z-ordered recompose.
 *
 * Trace: RD-03 AC-7 (partial recompose) + the overlapping-windows occlusion fix.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { View, Group, createRenderRoot } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import type { Size2D } from '../src/layout/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A leaf that fills its whole (parent-given) area with one glyph. */
class FillView extends View {
  constructor(private readonly ch: string) {
    super();
  }
  override measure(available: Size2D): Size2D {
    return available; // claim the full interior so the fill covers it
  }
  draw(ctx: DrawContext): void {
    ctx.fill(this.ch);
  }
}

/** An absolute "window" at `rect` whose single content child fills it with `ch`. */
function windowWith(
  ch: string,
  rect: { x: number; y: number; width: number; height: number },
): { win: Group; content: FillView } {
  const win = new Group();
  win.layout = { position: 'absolute', rect };
  const content = new FillView(ch);
  win.add(content);
  return { win, content };
}

test('a dirty content view behind an overlapping window does not bleed over it', () => {
  // back: x0..5 filled 'B'; front: x3..8 filled 'F'. Overlap x3..5 — front wins (painted later).
  const back = windowWith('B', { x: 0, y: 0, width: 6, height: 3 });
  const front = windowWith('F', { x: 3, y: 0, width: 6, height: 3 });
  const root = new Group();
  root.add(back.win);
  root.add(front.win); // added last → painted on top

  // Synchronous scheduler so an invalidate flushes immediately (no microtask wait).
  const rr = createRenderRoot({ width: 9, height: 3 }, { caps, schedule: (flush) => flush() });
  rr.mount(root);

  const buf = rr.buffer();
  expect(buf.get(0, 0)?.char).toBe('B'); // back-only region
  expect(buf.get(3, 0)?.char).toBe('F'); // overlap — front on top
  expect(buf.get(8, 0)?.char).toBe('F'); // front-only region

  // Animate the BACK window's content (the perpetually-dirty case). A naive partial recompose would
  // redraw 'B' across x0..5, overwriting the front window at x3..5.
  back.content.invalidate();

  expect(buf.get(0, 0)?.char).toBe('B'); // back-only region still back
  expect(buf.get(3, 0)?.char).toBe('F'); // overlap STILL front — not bled over
  expect(buf.get(5, 0)?.char).toBe('F'); // far overlap edge still front
  expect(buf.get(8, 0)?.char).toBe('F');
});

test('a dirty content view with no overlapping occluder still uses the partial fast-path', () => {
  // Two non-overlapping windows: invalidating one must not corrupt the other (and need not escalate).
  const left = windowWith('L', { x: 0, y: 0, width: 4, height: 3 });
  const right = windowWith('R', { x: 5, y: 0, width: 4, height: 3 });
  const root = new Group();
  root.add(left.win);
  root.add(right.win);

  const rr = createRenderRoot({ width: 9, height: 3 }, { caps, schedule: (flush) => flush() });
  rr.mount(root);

  const buf = rr.buffer();
  expect(buf.get(0, 0)?.char).toBe('L');
  expect(buf.get(5, 0)?.char).toBe('R');

  left.content.invalidate(); // repaint the left content
  expect(buf.get(0, 0)?.char).toBe('L');
  expect(buf.get(5, 0)?.char).toBe('R'); // the untouched right window is intact
});
