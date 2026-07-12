/**
 * Specification tests — out-of-tick repaint (missing-flush bug class).
 *
 * The immutable oracle for the systemic fix: a state mutation that reaches the retained view tree
 * OUTSIDE a dispatch tick (a timer, a promise continuation, a direct public-API call between ticks)
 * must produce a PAINTED frame on the next microtask, with no further input — coalesced so a burst
 * of writes yields one frame, gated so nothing paints after the loop stops.
 *
 * Every case asserts the PAINTED frame via `loop.onFrame` (never a manual `renderRoot.flush()`, which
 * paints regardless of the loop's schedule and is exactly what masked this bug class). The deferred
 * paint is stepped deterministically through an injected `scheduleMicrotask` that captures callbacks
 * into `pending`, so nothing races a real microtask.
 */
import { test, expect, describe } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { ScreenBuffer, TimerHandle } from '@jsvision/core';
import { createEventLoop, Group, View, signal, Spinner, runSpinner, SPINNERS } from '../src/index.js';
import type { DrawContext, Point } from '../src/index.js';
import { Desktop } from '../src/desktop/index.js';
import { Window } from '../src/window/index.js';

// A UTF-8 locale so the Spinner keeps its Unicode `dots` preset (a bare env would fall back to the
// ASCII `line` frames), and truecolor so color depth never downsamples the frame under test.
const caps = resolveCapabilities({ env: { LANG: 'en_US.UTF-8' }, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const PATTERN = defaultTheme.desktop.pattern; // the desktop fill glyph (░)

/** The glyph painted at a cell of a frame. */
function charAt(buf: ScreenBuffer, x: number, y: number): string {
  return buf.get(x, y)?.char ?? ' ';
}

/**
 * A minimal leaf view that draws the current value of a reactive reader at (0,0). It binds the reader
 * on mount, so writing the underlying signal invalidates and (with the fix) repaints — the bare
 * reactive path at the heart of the bug class.
 */
class SignalView extends View {
  constructor(private readonly read: () => string) {
    super();
    // The binding must be set up on mount, when this view's reactive scope exists (not in the ctor).
    this.onMount(() => {
      this.bind(this.read);
    });
  }
  override draw(ctx: DrawContext): void {
    ctx.text(0, 0, this.read(), ctx.color('staticText'));
  }
}

/** Build a loop whose out-of-tick paint is captured (not queued to a real microtask) for stepping. */
function harness(size: { width: number; height: number }): {
  loop: ReturnType<typeof createEventLoop>;
  pending: Array<() => void>;
  runPending: () => void;
} {
  const pending: Array<() => void> = [];
  const runPending = (): void => {
    const q = pending.splice(0);
    q.forEach((cb) => cb());
  };
  const loop = createEventLoop(size, { caps, scheduleMicrotask: (cb) => pending.push(cb) });
  return { loop, pending, runPending };
}

describe('out-of-tick repaint', () => {
  // ST-1 — a timer-driven signal write (runSpinner over a fake timer) repaints with no input, and the
  // caret stays correct (a non-focusable spinner ⇒ no caret).
  test('ST-1: a runSpinner frame advance paints once with no input', () => {
    const { loop, pending, runPending } = harness({ width: 20, height: 2 });
    let armed: (() => void) | null = null;
    const timer = {
      setTimer: (fn: () => void) => {
        armed = fn;
        return 0 as unknown as TimerHandle;
      },
      clearTimer: () => {
        armed = null;
      },
    };

    const frame = signal(0);
    const g = new Group();
    const spinner = new Spinner({ frame, preset: 'dots' });
    spinner.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 4, height: 1 } };
    g.add(spinner);
    loop.mount(g);
    pending.length = 0; // discard any mount-time schedule

    const glyph0 = charAt(loop.renderRoot.buffer(), 0, 0);
    expect(glyph0).toBe(SPINNERS.dots[0]); // frame 0 glyph ⇒ the dots preset is active on this caps

    let paints = 0;
    let last: ScreenBuffer | null = null;
    const carets: Array<Point | null> = [];
    loop.onFrame = (buf) => {
      paints++;
      last = buf.clone();
    };
    loop.onCaret = (cell) => carets.push(cell);

    runSpinner(frame, { timer, intervalMs: 80 }); // arms the one-shot timer
    (armed as unknown as () => void)(); // fire the timer tick out-of-tick → frame.set(1)

    expect(pending.length).toBe(1); // exactly one deferred paint queued
    runPending();

    expect(paints).toBe(1);
    expect(last).not.toBeNull();
    expect(charAt(last as unknown as ScreenBuffer, 0, 0)).toBe(SPINNERS.dots[1]); // advanced glyph ⠙
    expect(carets.at(-1)).toBeNull(); // spinner is non-focusable ⇒ caret reported as none (no drift)
  });

  // ST-2 — a direct desktop.cascade() between ticks repaints, and the painted frame shows the
  // stepped-offset cascade geometry (window i lands at (i,i)).
  test('ST-2: a direct desktop.cascade() paints the cascaded geometry', () => {
    const { loop, pending, runPending } = harness({ width: 60, height: 18 });
    const desktop = new Desktop();
    loop.mount(desktop);

    const a = new Window('AAA');
    a.layout.rect = { x: 5, y: 2, width: 20, height: 6 };
    const b = new Window('BBB');
    b.layout.rect = { x: 5, y: 2, width: 20, height: 6 }; // both start overlapping
    desktop.addWindow(a);
    desktop.addWindow(b); // z-order [a(back), b(front)]
    pending.length = 0; // discard setup schedules

    let paints = 0;
    let last: ScreenBuffer | null = null;
    loop.onFrame = (buf) => {
      paints++;
      last = buf.clone();
    };

    desktop.cascade(); // direct, out-of-tick

    expect(pending.length).toBe(1); // one coalesced deferred paint
    runPending();

    expect(paints).toBe(1);
    expect(b.bounds).toMatchObject({ x: 1, y: 1 }); // cascade stepped the front window one down-right
    const frame = last as unknown as ScreenBuffer;
    const corner = charAt(frame, 0, 0); // window a's top-left corner
    expect(corner).not.toBe(' ');
    expect(corner).not.toBe(PATTERN); // it is window chrome, not the desktop fill
    expect(charAt(frame, 1, 1)).toBe(corner); // window b's identical corner, offset one down-right
  });

  // ST-3 — a bare out-of-tick signal write repaints with the new content.
  test('ST-3: a bare out-of-tick signal write paints the new content', () => {
    const { loop, pending, runPending } = harness({ width: 12, height: 2 });
    const s = signal('A');
    const g = new Group();
    const sv = new SignalView(() => s());
    sv.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 10, height: 1 } };
    g.add(sv);
    loop.mount(g);
    pending.length = 0;

    let paints = 0;
    let last: ScreenBuffer | null = null;
    loop.onFrame = (buf) => {
      paints++;
      last = buf.clone();
    };

    s.set('B'); // out-of-tick

    expect(pending.length).toBe(1);
    runPending();

    expect(paints).toBe(1);
    expect(charAt(last as unknown as ScreenBuffer, 0, 0)).toBe('B');
  });

  // ST-4 — N out-of-tick writes in one JS turn coalesce to exactly one deferred paint.
  test('ST-4: a burst of out-of-tick writes coalesces to one paint', () => {
    const { loop, pending, runPending } = harness({ width: 12, height: 2 });
    const s = signal(0);
    const g = new Group();
    const sv = new SignalView(() => String(s() % 10));
    sv.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 10, height: 1 } };
    g.add(sv);
    loop.mount(g);
    pending.length = 0;

    let paints = 0;
    let last: ScreenBuffer | null = null;
    loop.onFrame = (buf) => {
      paints++;
      last = buf.clone();
    };

    for (let i = 0; i < 5; i++) s.set(s() + 1); // 5 out-of-tick writes in one turn

    expect(pending.length).toBe(1); // one callback queued, not five
    runPending();

    expect(paints).toBe(1); // one painted frame
    expect(charAt(last as unknown as ScreenBuffer, 0, 0)).toBe('5'); // final value painted
  });

  // ST-5 — a synchronous loop paint (resize) neutralises the redundant deferred callback: no
  // double-paint. (This case may pass before the fix too — pre-fix, resize paints synchronously and
  // nothing is ever queued; post-fix, the queued callback is a clean no-op.)
  test('ST-5: resize does not double-paint via a leftover deferred callback', () => {
    const { loop, pending, runPending } = harness({ width: 10, height: 3 });
    const g = new Group();
    const sv = new SignalView(() => 'X');
    sv.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 5, height: 1 } };
    g.add(sv);
    loop.mount(g);
    pending.length = 0;

    let paints = 0;
    loop.onFrame = () => {
      paints++;
    };

    loop.resize({ width: 20, height: 4 }); // paints synchronously
    const afterResize = paints;
    runPending(); // any leftover deferred callback fires here

    expect(afterResize).toBeGreaterThanOrEqual(1); // resize produced its own frame
    expect(paints).toBe(afterResize); // …and the deferred callback added none
  });

  // ST-6 — after loop.stop(), a queued deferred paint does not run, and a later out-of-tick write
  // queues/paints nothing.
  test('ST-6: after stop() the deferred painter is gated', () => {
    const { loop, pending, runPending } = harness({ width: 10, height: 2 });
    const s = signal('A');
    const g = new Group();
    const sv = new SignalView(() => s());
    sv.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 5, height: 1 } };
    g.add(sv);
    loop.mount(g);
    pending.length = 0;

    let paints = 0;
    loop.onFrame = () => {
      paints++;
    };

    s.set('B'); // out-of-tick → queues one deferred paint
    expect(pending.length).toBe(1);

    loop.stop(); // gate the painter before the queued callback runs
    runPending();
    expect(paints).toBe(0); // the gated callback painted nothing

    s.set('C'); // a further out-of-tick write after stop()
    expect(pending.length).toBe(0); // queues nothing
    runPending();
    expect(paints).toBe(0); // paints nothing
  });
});
