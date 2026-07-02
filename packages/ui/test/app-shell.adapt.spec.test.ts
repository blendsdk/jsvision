/**
 * Specification test (immutable oracle) — ui threading of `adaptAmbiguousWidth`
 * through `createApplication`/`run()` (feature glyph-auto-swap, ST-14).
 *
 * Source: `01-requirements.md` FR-8, Ambiguity Register AR-9/AR-17, preflight
 * PF-005. Expectations derive from the acceptance criteria, never the
 * implementation.
 *
 * Observable (PF-005): no existing ui test observes what the host *received*, and
 * `run()` does not thread `onWidthWarning`. The concrete, spec-derivable observable
 * is the probe's CPR request bytes (`\x1b[6n`) in the captured output — present iff
 * the host ran the probe, i.e. iff it received `adaptAmbiguousWidth: true`. A
 * scripted CPR reply completes the probe fast (no 200 ms wait). The caps enable
 * `unicode.utf8` so the probe is not skipped as already-ASCII-safe.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { createApplication } from '../src/app/index.js';
import { FakeRuntimeAdapter, CaptureStream, FakeInput } from './app-shell.fixtures.js';

const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', altScreen: true, unicode: { utf8: true } },
}).profile;

/** Bytes for two sequential narrow CPR replies (arrows then boxes), so the probe adapts nothing. */
function narrowCprs(): Uint8Array {
  const one = (col: number): number[] => [...Buffer.from(`\x1b[1;${col}R`, 'latin1')];
  return new Uint8Array([...one(9), ...one(9)]); // 8-glyph groups advance 8 ⇒ not wide
}

/** Yield one microtask so `run()`/`start()` reaches the probe's `read()` before we feed. */
function tick(): Promise<void> {
  return Promise.resolve();
}

// ST-14 / AC-6 — the default threads adaptAmbiguousWidth:true, so the host runs the probe.
test('ST-14: run() defaults adaptAmbiguousWidth true ⇒ the probe CPR request is issued', async () => {
  const input = new FakeInput();
  const output = new CaptureStream();
  const app = createApplication({
    caps,
    runtime: new FakeRuntimeAdapter(),
    input: input.asInput(),
    output: output.asOutput(),
    viewport: { width: 40, height: 12 },
    warnAmbiguousWidth: false, // isolate: the probe runs only because adapt defaults on
    // adaptAmbiguousWidth left unset ⇒ ui default true
  });

  const runP = app.run();
  await tick();
  input.feed(narrowCprs()); // complete the probe quickly
  await tick();
  app.loop.emitCommand('quit');
  await runP;

  expect(output.data).toContain('\x1b[6n'); // the host received adaptAmbiguousWidth:true
});

// ST-14 / AC-6 — an explicit false suppresses the probe (no CPR request bytes).
test('ST-14: run() with adaptAmbiguousWidth:false + warn off ⇒ no probe bytes', async () => {
  const input = new FakeInput();
  const output = new CaptureStream();
  const app = createApplication({
    caps,
    runtime: new FakeRuntimeAdapter(),
    input: input.asInput(),
    output: output.asOutput(),
    viewport: { width: 40, height: 12 },
    warnAmbiguousWidth: false,
    adaptAmbiguousWidth: false,
  });

  const runP = app.run();
  app.loop.emitCommand('quit');
  await runP;

  expect(output.data).not.toContain('\x1b[6n');
});
