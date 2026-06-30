/**
 * Real-pipeline integration tests for the RD-05 app shell (the seam every prior suite skipped).
 *
 * Each test runs a real `createApplication().run()` against an injected fake OS boundary, then feeds
 * **raw terminal bytes** — the actual escape sequences the RD-06 decoder parses — and asserts on the
 * captured ANSI + window-manager state. This exercises the whole chain the synthetic-event suites
 * never touched: `decode → loop.dispatch → menu/focus/WM → compose → serialize → host.render →
 * output`. It is the layer that would have caught the freeze (frames stop flowing) and the mouse
 * (host never enabled reporting) bugs.
 *
 * Trace: RD-05 AR-71 (`run()` host wiring) · the host freeze fix (`host.render` must snapshot prev).
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { CapabilityProfile } from '@jsvision/core';
import {
  createApplication,
  View,
  Window,
  menuBar,
  subMenu,
  item,
  statusLine,
  statusItem,
  Commands,
} from '@jsvision/ui';
import type { Application, DrawContext, Size2D } from '@jsvision/ui';
import { FakeRuntime, CaptureStream, FakeInput } from './app-shell-host-doubles.js';

/** A leaf that fills a window's interior — a stub-handler content view (does not handle clicks). */
class Filler extends View {
  constructor(private readonly ch: string) {
    super();
  }
  override measure(available: Size2D): Size2D {
    return available;
  }
  draw(ctx: DrawContext): void {
    ctx.fill(this.ch);
  }
}

const encoder = new TextEncoder();
/** Encode an escape-sequence string to the raw bytes the host decodes. */
function bytes(seq: string): Uint8Array {
  return encoder.encode(seq);
}
/** Yield to the event loop so `host.start()` (and any microtask) settles. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// Real terminal byte sequences (RD-06 decoder inputs).
const F10 = bytes('\x1b[21~'); // CSI 21 ~  → f10
const ARROW_DOWN = bytes('\x1b[B'); // CSI B    → down
const ALT_X = bytes('\x1bx'); // ESC x    → alt+x
/** SGR mouse button-0 press at 1-based (col,row): CSI < 0 ; col ; row M. */
function mouseDown(col: number, row: number): Uint8Array {
  return bytes(`\x1b[<0;${col};${row}M`);
}

/** Truecolor caps with SGR mouse forced on (so the host enables mouse reporting). */
function caps(): CapabilityProfile {
  return resolveCapabilities({
    env: {},
    platform: 'linux',
    override: { colorDepth: 'truecolor', mouse: { sgr: true, drag: true, wheel: true } },
  }).profile;
}

interface Harness {
  app: Application;
  input: FakeInput;
  output: CaptureStream;
  runtime: FakeRuntime;
  w1: Window;
  w2: Window;
}

/** A representative app: a 2-item Window menu, an Exit status item, and two non-overlapping windows. */
function setup(): Harness {
  const runtime = new FakeRuntime();
  const input = new FakeInput(true);
  const output = new CaptureStream();
  output.columns = 60;
  output.rows = 20;

  const bar = menuBar([
    subMenu('~W~indow', [item('~T~ile', Commands.tile, 'F4'), item('~C~ascade', Commands.cascade, 'F5')]),
  ]);
  const status = statusLine([statusItem('~Alt-X~ Exit', Commands.quit, 'Alt+X')]);

  const app = createApplication({
    caps: caps(),
    menuBar: bar,
    statusLine: status,
    runtime,
    input: input.asInput(),
    output: output.asOutput(),
    viewport: { width: 60, height: 20 },
  });

  // Two non-overlapping windows, each with a filling content child; the second (added last) is active.
  const w1 = new Window('One');
  w1.layout.rect = { x: 2, y: 2, width: 24, height: 6 };
  w1.add(new Filler('.'));
  app.desktop.addWindow(w1);
  const w2 = new Window('Two');
  w2.layout.rect = { x: 30, y: 2, width: 24, height: 6 };
  w2.add(new Filler('.'));
  app.desktop.addWindow(w2);

  return { app, input, output, runtime, w1, w2 };
}

/**
 * Run the app, await the first frame, run `body`, then always quit (Alt-X) so `run()` resolves and
 * the host restores — even if an assertion throws.
 */
async function drive(body: (h: Harness) => Promise<void> | void): Promise<void> {
  const h = setup();
  const runPromise = h.app.run();
  try {
    await tick(); // host.start() + the first paint
    await body(h);
  } finally {
    h.input.feed(ALT_X);
    await runPromise.catch(() => undefined);
  }
}

test('start() enters SGR mouse mode and paints a non-empty first frame', async () => {
  await drive(({ output }) => {
    expect(output.data).toContain('\x1b[?1006h'); // SGR mouse encoding enabled
    expect(output.data).toContain('\x1b[?1000h'); // basic button tracking enabled
    expect(output.data.length).toBeGreaterThan(0);
  });
});

test('the first painted frame already contains content added before run()', async () => {
  // Windows are added before run(); the first frame must reflect them (no stale launch frame).
  await drive(({ output }) => {
    expect(output.data).toContain('Two'); // the active window's title composed on frame one
    expect(output.data).toContain('One');
  });
});

test('frames keep flowing across successive inputs (freeze guard)', async () => {
  // The shipped freeze: host.render aliased the live buffer, so every frame after the first was an
  // empty diff. Two distinct interactions must each grow the output.
  await drive(({ input, output }) => {
    const f0 = output.data.length;
    input.feed(F10); // open the Window menu
    const f1 = output.data.length;
    expect(f1).toBeGreaterThan(f0);

    input.feed(ARROW_DOWN); // move the highlight Tile → Cascade
    const f2 = output.data.length;
    expect(f2).toBeGreaterThan(f1);
  });
});

test('a real SGR mouse-down raises the clicked background window', async () => {
  await drive(({ app, input, w1, w2 }) => {
    expect(app.desktop.activeWindow()).toBe(w2); // added last → active

    // w1 is at desktop-relative (2,2); the desktop sits one row below the menu bar, so w1's
    // interior is around absolute (10,6). SGR coords are 1-based → (11,7).
    input.feed(mouseDown(11, 7));
    expect(app.desktop.activeWindow()).toBe(w1); // raise-on-click via the real hit-test
  });
});

test('clicking a window’s content (a stub-handler child), not just its border, raises it', async () => {
  // The reported bug: a content click hit the child (stub onEvent) and never reached the Window, so
  // only border clicks raised. The mouse-down must bubble from the content up to the Window.
  await drive(({ app, input, w1, w2 }) => {
    expect(app.desktop.activeWindow()).toBe(w2);

    // Deep inside w1's interior content (well past its border): abs ~(12,6) → 1-based (13,7).
    input.feed(mouseDown(13, 7));
    expect(app.desktop.activeWindow()).toBe(w1); // content click bubbled to the Window → raised
  });
});

test('F10 opens the menu and its popup composes into the frame', async () => {
  await drive(({ input, output }) => {
    const before = output.data.length;
    input.feed(F10);
    expect(output.data.length).toBeGreaterThan(before);
    // The popup paints "~C~ascade"; the accented hotkey `C` is now a separate SGR run, so the tail
    // "ascade" is the contiguous substring in the escape-laden output (the menu did open).
    expect(output.data).toContain('ascade'); // the second menu item painted in the popup
  });
});

test('Alt-X via the real decoder resolves run() with exit code 0', async () => {
  const { app, input, runtime } = setup();
  const runPromise = app.run();
  await tick();
  input.feed(ALT_X);
  await expect(runPromise).resolves.toBe(0);
  expect(runtime.exits).toEqual([]); // quit resolves the promise; no process.exit on the happy path
  expect(runtime.rawModeCalls).toContain(false); // terminal restored (raw mode off) on stop
});
