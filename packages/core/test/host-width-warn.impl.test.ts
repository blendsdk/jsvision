/**
 * Implementation tests — host wiring of the ambiguous-width startup probe.
 *
 * Verifies the integration in `host.ts start()` (not the probe internals, which
 * `width-probe.*.test.ts` cover): the probe runs in the raw-mode→alt-screen window
 * only when `warnAmbiguousWidth` is enabled on a real TTY, issues the CPR request,
 * and routes a wide measurement to `onWidthWarning`.
 *
 * Driven headlessly via the FakeRuntimeAdapter + CaptureStream + FakeInput doubles;
 * the CPR reply is fed on the input double once `start()` has attached the probe.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';

import { createHost } from '../src/engine/host/host.js';
import { resolveCapabilities } from '../src/engine/capability/index.js';
import type { CapabilityProfile, DeepPartial } from '../src/engine/capability/index.js';
import { WIDTH_WARNING_MESSAGE } from '../src/engine/host/width-probe.js';
import { CaptureStream, FakeInput, FakeRuntimeAdapter } from './host-doubles.js';

function caps(override: DeepPartial<CapabilityProfile> = {}): CapabilityProfile {
  return resolveCapabilities({ env: {}, platform: 'linux', override }).profile;
}
const RICH = caps({ mouse: { sgr: true, drag: true, wheel: true }, altScreen: true, bracketedPaste: true });

/** Bytes for a CPR reply reporting `row;col`. */
function cpr(row: number, col: number): Uint8Array {
  return new Uint8Array(Buffer.from(`\x1b[${row};${col}R`, 'latin1'));
}

/** Yield one microtask so `start()` reaches the probe's `read()` before we feed. */
function tick(): Promise<void> {
  return Promise.resolve();
}

test('warns once when the terminal reports double-width chrome glyphs', async () => {
  const adapter = new FakeRuntimeAdapter();
  const output = new CaptureStream();
  const input = new FakeInput(true);
  const warnings: string[] = [];
  const host = createHost({
    caps: RICH,
    runtime: adapter,
    input: input.asInput(),
    output: output.asOutput(),
    warnAmbiguousWidth: true,
    onWidthWarning: (m) => warnings.push(m),
  });

  const startP = host.start();
  await tick();
  // 7 probe glyphs homed to col 1; a reply of col 15 ⇒ advance 14 ⇒ double-width.
  input.feed(cpr(1, 15));
  await startP;

  expect(output.data).toContain('\x1b[6n'); // the DSR cursor-position request was issued
  expect(warnings).toStrictEqual([WIDTH_WARNING_MESSAGE]);
  await host.stop();
});

test('does not warn when the terminal reports narrow (one-cell) glyphs', async () => {
  const adapter = new FakeRuntimeAdapter();
  const output = new CaptureStream();
  const input = new FakeInput(true);
  const warnings: string[] = [];
  const host = createHost({
    caps: RICH,
    runtime: adapter,
    input: input.asInput(),
    output: output.asOutput(),
    warnAmbiguousWidth: true,
    onWidthWarning: (m) => warnings.push(m),
  });

  const startP = host.start();
  await tick();
  input.feed(cpr(1, 8)); // 7 glyphs ⇒ advance 7 ⇒ exactly one cell each
  await startP;

  expect(warnings).toStrictEqual([]);
  await host.stop();
});

test('does not probe at all when warnAmbiguousWidth is left default (off)', async () => {
  const adapter = new FakeRuntimeAdapter();
  const output = new CaptureStream();
  const input = new FakeInput(true);
  const warnings: string[] = [];
  const host = createHost({
    caps: RICH,
    runtime: adapter,
    input: input.asInput(),
    output: output.asOutput(),
    onWidthWarning: (m) => warnings.push(m),
  });

  await host.start();
  expect(output.data).not.toContain('\x1b[6n'); // no probe issued
  expect(warnings).toStrictEqual([]);
  await host.stop();
});

test('skips the probe on a non-TTY stream even when enabled', async () => {
  const adapter = new FakeRuntimeAdapter();
  const output = new CaptureStream();
  output.isTTY = false; // both ends must be TTY for isTTY
  const input = new FakeInput(false);
  const warnings: string[] = [];
  const host = createHost({
    caps: RICH,
    runtime: adapter,
    input: input.asInput(),
    output: output.asOutput(),
    warnAmbiguousWidth: true,
    onWidthWarning: (m) => warnings.push(m),
  });

  await host.start();
  expect(output.data).not.toContain('\x1b[6n');
  expect(warnings).toStrictEqual([]);
  await host.stop();
});
