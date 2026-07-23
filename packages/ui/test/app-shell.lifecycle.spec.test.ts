/**
 * Specification tests (immutable oracles) — RD-05 Application + run() lifecycle (Phase 2).
 *
 * Source: RD-05 AC-1…AC-5 → ST-01…ST-05 (codeops/features/jsvision-ui/plans/app-shell/
 * 03-01-application-run-host.md + 07-testing-strategy.md). The live-TTY run() paths are exercised
 * with an injected fake RuntimeAdapter + TTY stream doubles (PA-14) — deterministic, no real
 * terminal. Expectations derive from the acceptance criteria, never the implementation.
 *
 * Trace: RD-05 03-01 · AR-71/AR-75/AR-83/AR-86 · ST-01…ST-05.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group, View } from '../src/view/index.js';
import type { DrawContext, DispatchEvent } from '../src/view/index.js';
import { Desktop } from '../src/desktop/index.js';
import { MenuBar } from '../src/menu/index.js';
import { StatusLine } from '../src/status/index.js';
import { createApplication } from '../src/app/index.js';
import type { DesktopApplication } from '../src/app/index.js';
import { FakeRuntimeAdapter, CaptureStream, FakeInput, expectExit } from './app-shell.fixtures.js';

const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', altScreen: true },
}).profile;

/** The alt-screen enter sequence — counted to verify mode re-assertion (host-owned). */
const ALT_ENTER = '\x1b[?1049h';

/** A focusable leaf that records whether it received a key event. */
class KeyLeaf extends View {
  gotKey = false;
  constructor() {
    super();
    this.focusable = true;
  }
  draw(ctx: DrawContext): void {
    ctx.fill(' ');
  }
  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'key') this.gotKey = true;
  }
}

/** Build an app wired to fresh fake OS doubles, returning the app + the doubles. */
function makeApp(): {
  app: DesktopApplication;
  runtime: FakeRuntimeAdapter;
  input: FakeInput;
  output: CaptureStream;
} {
  const runtime = new FakeRuntimeAdapter();
  const input = new FakeInput();
  const output = new CaptureStream();
  const app = createApplication({
    warnAmbiguousWidth: false, // skip the real-TTY width probe in headless tests
    caps,
    runtime,
    input: input.asInput(),
    output: output.asOutput(),
    viewport: { width: 40, height: 12 },
  });
  return { app, runtime, input, output };
}

// ST-01 / AC-1 — composition + layout: the returned Application + the mounted root structure.
test('ST-01: createApplication composes desktop · chrome · absolute overlay', () => {
  const menuBar = new MenuBar();
  const statusLine = new StatusLine();
  const app = createApplication({ caps, menuBar, statusLine, viewport: { width: 40, height: 12 } });

  expect(app.desktop).toBeInstanceOf(Desktop);
  expect(typeof app.run).toBe('function');
  expect(typeof app.loop.dispatch).toBe('function'); // the composed EventLoop

  // The mounted root is the desktop's parent group; it composes the chrome + overlay.
  const root = app.desktop.parent;
  expect(root).toBeInstanceOf(Group);
  const children = (root as Group).children;
  expect(children).toContain(menuBar);
  expect(children).toContain(app.desktop);
  expect(children).toContain(statusLine);

  // Desktop fills the column (fr:1); the chrome rows are fixed height 1.
  expect(app.desktop.layout.size).toEqual({ kind: 'fr', weight: 1 });
  expect(menuBar.layout.size).toEqual({ kind: 'fixed', cells: 1 });
  expect(statusLine.layout.size).toEqual({ kind: 'fixed', cells: 1 });

  // The overlay: an absolute, full-viewport child, paint/hit-inert (visible:false) until a popup mounts.
  const overlay = (root as Group).children.find((c) => c.layout.position === 'absolute');
  expect(overlay).toBeDefined();
  expect(overlay?.layout.rect).toEqual({ x: 0, y: 0, width: 40, height: 12 });
  expect(overlay?.state.visible).toBe(false);
});

// ST-02 / AC-2 — host wiring via the fake runtime: start (raw+alt), onInput→dispatch, onResize→resize.
test('ST-02: run() wires the host — start, onInput→dispatch, onResize→resize', async () => {
  const { app, runtime, input, output } = makeApp();
  const leaf = new KeyLeaf();
  app.desktop.add(leaf);

  const runP = app.run();

  // host.start() ran: raw mode entered + the alt-screen enter sequence written (no real TTY).
  expect(runtime.rawModeCalls).toContain(true);
  expect(output.countOf(ALT_ENTER)).toBe(1);

  // onInput→dispatch: focus the leaf and feed a printable key byte; the host decodes + dispatches it.
  app.loop.focusView(leaf);
  input.feed(new Uint8Array([0x61])); // 'a'
  expect(leaf.gotKey).toBe(true);

  // onResize→resize: a coalesced resize reflows the loop's render root to the new size.
  output.columns = 50;
  output.rows = 20;
  runtime.emit('resize');
  runtime.flushImmediates();
  expect(app.loop.renderRoot.buffer().width).toBe(50);
  expect(app.loop.renderRoot.buffer().height).toBe(20);

  app.loop.emitCommand('quit');
  await runP;
});

// ST-03 / AC-3 — quit → exit code; the default is 0, a numeric arg is the code.
test('ST-03: run() resolves the quit exit code (0 default, arg otherwise)', async () => {
  const a = makeApp();
  const runA = a.app.run();
  a.app.loop.emitCommand('quit');
  expect(await runA).toBe(0);

  const b = makeApp();
  const runB = b.app.run();
  b.app.loop.emitCommand('quit', 3);
  expect(await runB).toBe(3);
});

// ST-04 / AC-4 — restore on the escaping-throw path: the host backstop restores + the fake records it.
test('ST-04: an escaping throw restores the terminal (host backstop)', () => {
  const { app, runtime } = makeApp();
  const runP = app.run();
  void runP; // stays pending on this path — the host exits, run() never resolves

  expect(runtime.restored).toBe(false); // not yet

  // The fake fires the host's uncaught-exception backstop; the host restores then exits(1).
  expectExit(() => runtime.emitUncaught(new Error('boom')));

  expect(runtime.restored).toBe(true); // cooked mode + leave-mode written
  expect(runtime.exits).toContain(1);
});

// ST-05 / AC-5 — suspend/resume: the host owns the soft-restore + the re-assert/repaint; onResume is
// notify-only (the app writes no modes — no duplicate enter-mode writes).
test('ST-05: suspend/resume is host-owned; the app re-asserts no modes', async () => {
  const { app, runtime, output } = makeApp();
  const runP = app.run();

  expect(output.countOf(ALT_ENTER)).toBe(1); // entered once on start

  // SIGTSTP: onSuspend fires, then the soft leave (cooked), then suspendSelf.
  runtime.emit('suspend');
  expect(runtime.suspendCount).toBe(1);
  expect(runtime.rawModeCalls[runtime.rawModeCalls.length - 1]).toBe(false); // cooked restored

  // SIGCONT: the host re-asserts raw + enter-mode + repaints, then notifies onResume.
  runtime.emit('continue');
  expect(runtime.rawModeCalls[runtime.rawModeCalls.length - 1]).toBe(true); // raw re-asserted
  expect(output.countOf(ALT_ENTER)).toBe(2); // host re-entered once; the app added none

  app.loop.emitCommand('quit');
  await runP;
});
