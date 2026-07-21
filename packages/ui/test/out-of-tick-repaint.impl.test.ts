/**
 * Implementation tests — out-of-tick repaint internals and edges.
 *
 * These cover the mechanics behind the ST-1…ST-6 oracles: coalescing across separate JS turns, both
 * the partial-repaint and full-recompose flush branches driven out-of-tick, caret fidelity on a
 * deferred paint, the `stop()` gate + idempotency alongside an unaffected in-tick path, and the real
 * `queueMicrotask` default path (no injected seam). All assert the PAINTED frame via `loop.onFrame`.
 */
import { test, expect, describe } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { ScreenBuffer } from '@jsvision/core';
import { createEventLoop, Group, View, signal } from '../src/index.js';
import type { DrawContext, Point } from '../src/index.js';

const caps = resolveCapabilities({
  env: { LANG: 'en_US.UTF-8' },
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;

function charAt(buf: ScreenBuffer, x: number, y: number): string {
  return buf.get(x, y)?.char ?? ' ';
}

/** A leaf that draws a reactive reader at (0,0), bound on mount so a write repaints. */
class SignalView extends View {
  constructor(private readonly read: () => string) {
    super();
    this.onMount(() => {
      this.bind(this.read);
    });
  }
  override draw(ctx: DrawContext): void {
    ctx.text(0, 0, this.read(), ctx.color('staticText'));
  }
}

/** A focusable leaf that requests a caret at a fixed local cell, so the deferred paint can report it. */
class CaretView extends View {
  override focusable = true;
  constructor(private readonly read: () => string) {
    super();
    this.onMount(() => {
      this.bind(this.read);
    });
  }
  override draw(ctx: DrawContext): void {
    ctx.text(0, 0, this.read(), ctx.color('inputNormal')); // the real Input control's unfocused field role
  }
  override desiredCaret(): Point {
    return { x: 1, y: 0 };
  }
}

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

describe('out-of-tick repaint (impl)', () => {
  test('coalescing resets between separate JS turns', () => {
    const { loop, pending, runPending } = harness({ width: 12, height: 2 });
    const s = signal(0);
    const g = new Group();
    const sv = new SignalView(() => String(s()));
    sv.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 10, height: 1 } });
    g.add(sv);
    loop.mount(g);
    runPending();

    let paints = 0;
    let last: ScreenBuffer | null = null;
    loop.onFrame = (buf) => {
      paints++;
      last = buf.clone();
    };

    s.set(1); // turn 1
    expect(pending.length).toBe(1);
    runPending();
    expect(paints).toBe(1);
    expect(charAt(last as unknown as ScreenBuffer, 0, 0)).toBe('1');

    s.set(2); // turn 2 — the guard reset, so this schedules afresh
    expect(pending.length).toBe(1);
    runPending();
    expect(paints).toBe(2);
    expect(charAt(last as unknown as ScreenBuffer, 0, 0)).toBe('2');
  });

  test('both the partial-repaint and full-recompose branches paint out-of-tick', () => {
    const { loop, pending, runPending } = harness({ width: 12, height: 3 });
    const s = signal('A');
    const g = new Group();
    const sv = new SignalView(() => s());
    sv.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 10, height: 1 } });
    g.add(sv);
    loop.mount(g);
    runPending();

    let paints = 0;
    let last: ScreenBuffer | null = null;
    loop.onFrame = (buf) => {
      paints++;
      last = buf.clone();
    };

    // Partial repaint: a bound signal write dirties one leaf (no layout change).
    s.set('B');
    expect(pending.length).toBe(1);
    runPending();
    expect(paints).toBe(1);
    expect(charAt(last as unknown as ScreenBuffer, 0, 0)).toBe('B');

    // Full recompose: a structural add out-of-tick forces a relayout.
    const sv2 = new SignalView(() => 'Z');
    sv2.setLayout({ position: 'absolute', rect: { x: 0, y: 1, width: 10, height: 1 } });
    g.add(sv2);
    expect(pending.length).toBe(1);
    runPending();
    expect(paints).toBe(2);
    expect(charAt(last as unknown as ScreenBuffer, 0, 1)).toBe('Z'); // the newly added row painted
  });

  test('the caret is reported correctly after a deferred paint', () => {
    const { loop, runPending } = harness({ width: 12, height: 6 });
    const s = signal('A');
    const g = new Group();
    const cv = new CaretView(() => s());
    cv.setLayout({ position: 'absolute', rect: { x: 2, y: 3, width: 8, height: 1 } });
    g.add(cv);
    loop.mount(g);
    runPending();
    loop.focusView(cv); // in-tick focus

    let paints = 0;
    const carets: Array<Point | null> = [];
    loop.onFrame = () => {
      paints++;
    };
    loop.onCaret = (cell) => carets.push(cell);

    s.set('B'); // out-of-tick
    runPending();

    expect(paints).toBe(1);
    // Absolute caret = view origin (2,3) + desiredCaret local (1,0).
    expect(carets.at(-1)).toEqual({ x: 3, y: 3 });
  });

  test('an in-tick dispatch paints; stop() is idempotent and gates the out-of-tick painter', () => {
    const { loop, pending, runPending } = harness({ width: 12, height: 2 });
    const s = signal('A');
    const g = new Group();
    const sv = new SignalView(() => s());
    sv.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 10, height: 1 } });
    g.add(sv);
    loop.mount(g);
    runPending();

    let paints = 0;
    loop.onFrame = () => {
      paints++;
    };

    // The live in-tick path is unaffected by the gate: a dispatch paints synchronously.
    loop.dispatch({ type: 'key', key: 'a', ctrl: false, alt: false, shift: false });
    expect(paints).toBe(1);

    loop.stop();
    loop.stop(); // idempotent — no throw, still gated

    s.set('B'); // out-of-tick, after stop
    expect(pending.length).toBe(0); // nothing scheduled
    runPending();
    expect(paints).toBe(1); // nothing further painted
  });

  test('the default queueMicrotask path paints out-of-tick after a microtask', async () => {
    const loop = createEventLoop({ width: 12, height: 2 }, { caps }); // no injected seam → real queueMicrotask
    const s = signal('A');
    const g = new Group();
    const sv = new SignalView(() => s());
    sv.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 10, height: 1 } });
    g.add(sv);
    loop.mount(g);
    await Promise.resolve(); // let mount's deferred paint drain on the real microtask queue

    let paints = 0;
    let last: ScreenBuffer | null = null;
    loop.onFrame = (buf) => {
      paints++;
      last = buf.clone();
    };

    s.set('B'); // out-of-tick
    expect(paints).toBe(0); // deferred, not synchronous
    await Promise.resolve(); // run the queued microtask
    expect(paints).toBe(1);
    expect(charAt(last as unknown as ScreenBuffer, 0, 0)).toBe('B');
  });
});
