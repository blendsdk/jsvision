/**
 * Specification tests (immutable oracles) — the essentials gate in `run()` (ST-7, ST-8, ST-9).
 *
 * Source: DX-ASSESSMENT.md Proposal 7 → FR-6…FR-8. `run()` asserts an interactive terminal before the
 * host takes over the screen: with the default `requireTty`, a launch with no interactive terminal
 * (`detectTty` → false) rejects with `EssentialsNotMetError` and never enters raw mode; passing
 * `requireTty: false` skips the gate for headless/automated runs; a real (TTY-reporting) terminal is
 * unaffected. Driven the shipped way — a real `createApplication().run()` against the injected fake OS
 * boundary + TTY-flagged stream doubles (the app-shell test idiom). `.js` specifiers required by
 * NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, EssentialsNotMetError } from '@jsvision/core';
import { createApplication } from '../src/app/index.js';
import { FakeRuntimeAdapter, CaptureStream, FakeInput } from './app-shell.fixtures.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Build a headless app whose injected streams report `isTTY` per `opts`, optionally opting out of the gate. */
function makeApp(opts: { isTTY: boolean; requireTty?: boolean }) {
  const runtime = new FakeRuntimeAdapter();
  const input = new FakeInput();
  const output = new CaptureStream();
  input.isTTY = opts.isTTY;
  output.isTTY = opts.isTTY;
  const app = createApplication({
    warnAmbiguousWidth: false, // skip the real-TTY width probe in headless tests
    caps,
    runtime,
    input: input.asInput(),
    output: output.asOutput(),
    requireTty: opts.requireTty,
    viewport: { width: 40, height: 12 },
  });
  return { app, runtime, input, output };
}

// ── ST-7: default gate → a non-TTY launch throws before the host starts ─────────────────────────────

test('ST-7: with the default requireTty, a non-TTY launch rejects with EssentialsNotMetError', async () => {
  const { app, runtime } = makeApp({ isTTY: false });
  const runP = app.run();
  await expect(runP).rejects.toThrow(EssentialsNotMetError);
  await expect(runP).rejects.toThrow(/interactive TTY/);
  // The throw happens before host.start(): raw mode is never entered, so there is nothing to restore.
  expect(runtime.rawModeCalls, 'the host never started on the failing path').not.toContain(true);
});

// ── ST-8: requireTty:false skips the gate — a non-TTY run starts and resolves normally ──────────────

test('ST-8: requireTty:false skips the gate; a non-TTY run starts and resolves the quit exit code', async () => {
  const { app } = makeApp({ isTTY: false, requireTty: false });
  const runP = app.run();
  app.loop.emitCommand('quit', 0);
  // The gate is skipped: run() resolves the quit exit code instead of rejecting with
  // EssentialsNotMetError. (A non-TTY host legitimately never enters raw mode, so the exit-code
  // resolution — not a raw-mode toggle — is the observable signal that the lifecycle ran.)
  expect(await runP, 'run() resolves the quit exit code normally').toBe(0);
});

// ── ST-9: a TTY-reporting terminal runs normally under the default gate ─────────────────────────────

test('ST-9: a TTY-reporting terminal runs normally under the default gate (no throw)', async () => {
  const { app, runtime } = makeApp({ isTTY: true });
  const runP = app.run();
  expect(runtime.rawModeCalls, 'the host started on a real TTY').toContain(true);
  app.loop.emitCommand('quit');
  expect(await runP, 'normal lifecycle resolves the default exit code').toBe(0);
});
