/**
 * Specification tests (immutable oracles) — `Application.onCommand` forwarding + the generalized quit.
 *
 * `app.onCommand` forwards to `loop.onCommand` (same contract). Quit is re-expressed as an internal
 * registration through the one command sink: emitting the quit command still ends `run()`; emitting it
 * while a modal is open still cascades the modal closed and ends `run()`; and a numeric exit-code
 * argument still resolves that code (guards against a hardcoded `0`).
 *
 * The live-TTY `run()` paths use injected fake OS doubles — deterministic, no real terminal.
 * Expectations derive from the requirements, never the implementation.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { createApplication } from '../src/app/index.js';
import type { DesktopApplication } from '../src/app/index.js';
import { Dialog } from '../src/dialog/index.js';
import { Commands } from '../src/status/index.js';
import { FakeRuntimeAdapter, CaptureStream, FakeInput } from './app-shell.fixtures.js';

const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', altScreen: true },
}).profile;

// `DesktopApplication` (not `ReturnType<typeof createApplication>`) so `app.loop` resolves as a
// concrete `EventLoop` here: this test never passes `content`, so the app is always desktop-bodied,
// and a deferred `CreatedApplication<O>` return type otherwise blocks generic calls like
// `execView<string>` below.
/** Build an app wired to fresh fake OS doubles. */
function makeApp(): DesktopApplication {
  const runtime = new FakeRuntimeAdapter();
  const input = new FakeInput();
  const output = new CaptureStream();
  return createApplication({
    warnAmbiguousWidth: false, // skip the real-TTY width probe in headless tests
    caps,
    runtime,
    input: input.asInput(),
    output: output.asOutput(),
    viewport: { width: 40, height: 12 },
  });
}

// ST-9 — app.onCommand forwards to the loop: a handler registered on the app fires on the command.
test('should fire an app.onCommand handler when the command is emitted', () => {
  const app = makeApp();
  let calls = 0;
  app.onCommand('about', () => {
    calls += 1;
  });
  app.loop.emitCommand('about');
  expect(calls).toBe(1);
});

// ST-11 — emitting quit still ends run() through the generalized sink.
test('should resolve run() when the quit command is emitted', async () => {
  const app = makeApp();
  const runP = app.run();
  app.loop.emitCommand(Commands.quit);
  await expect(runP).resolves.toBeTypeOf('number');
});

// ST-12 — quit while a modal is open cascades the modal closed and still ends run().
test('should close an open modal and resolve run() when quit cascades', async () => {
  const app = makeApp();
  const runP = app.run();

  const dlg = new Dialog({ width: 24, height: 6 });
  app.desktop.addWindow(dlg);
  const modalP = app.loop.execView<string>(dlg);

  app.loop.emitCommand(Commands.quit);

  await expect(modalP).resolves.toBe(Commands.quit); // the modal was ended by the cascade
  await expect(runP).resolves.toBeTypeOf('number'); // and the app terminated
});

// ST-20 — a numeric exit-code argument on quit resolves that code (not a hardcoded 0).
test('should resolve run() with the numeric exit code passed to quit', async () => {
  const app = makeApp();
  const runP = app.run();
  app.loop.emitCommand(Commands.quit, 3);
  expect(await runP).toBe(3);
});
