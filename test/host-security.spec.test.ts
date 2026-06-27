/**
 * Specification tests — restore guarantees & security (RD-07).
 *
 * Immutable oracle: expectations derive from ST-3, ST-11, ST-9, ST-10, ST-8 in
 * plan doc 07-testing-strategy, the AR-6 exit-code matrix, and RD-07 security
 * requirements — never from reading the implementation. If a test here fails
 * after implementation, the implementation is wrong.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../src/engine/host/host.js';
import { leaveMode } from '../src/engine/host/modes.js';
import { resolveCapabilities } from '../src/engine/capability/index.js';
import type { CapabilityProfile, DeepPartial } from '../src/engine/capability/index.js';
import type { HostSignal } from '../src/engine/host/types.js';
import { CaptureStream, FakeInput, FakeRuntimeAdapter, expectExit } from './host-doubles.js';

/** Deterministic capability profile with the given fields overridden. */
function caps(override: DeepPartial<CapabilityProfile> = {}): CapabilityProfile {
  return resolveCapabilities({ env: {}, platform: 'linux', override }).profile;
}

const RICH = caps({ mouse: { sgr: true, drag: true, wheel: true }, altScreen: true, bracketedPaste: true });

// ---------------------------------------------------------------------------
// ST-3 — terminating signals restore then exit 130/143/129 (AC-2/AR-6)
// ---------------------------------------------------------------------------

const TERMINATING: readonly [HostSignal, number][] = [
  ['interrupt', 130],
  ['terminate', 143],
  ['hangup', 129],
];

for (const [signal, code] of TERMINATING) {
  test(`ST-3: ${signal} restores then exits ${code}`, async () => {
    const codes: number[] = [];
    const adapter = new FakeRuntimeAdapter();
    const output = new CaptureStream();
    const input = new FakeInput(true);
    const host = createHost({
      caps: RICH,
      runtime: adapter,
      input: input.asInput(),
      output: output.asOutput(),
      onBeforeExit: (c) => codes.push(c),
    });

    await host.start();
    expectExit(() => adapter.emit(signal));

    assert.ok(output.data.includes(leaveMode(RICH)), 'leave-mode written on the signal path');
    assert.equal(adapter.rawModeCalls.at(-1), false, 'raw mode turned off');
    assert.deepEqual(codes, [code], `onBeforeExit(${code})`);
    assert.deepEqual(adapter.exits, [code], `process exited ${code}`);
  });
}

// ---------------------------------------------------------------------------
// ST-11 — panic restore fires via the 'exit' backstop when setup crashes (AC-8/AR-17/PF-004)
// ---------------------------------------------------------------------------

test('ST-11: a crash during enter-mode still restores via the exit backstop (writeSync once)', async () => {
  const adapter = new FakeRuntimeAdapter();
  const output = new CaptureStream();
  const input = new FakeInput(true);
  const host = createHost({ caps: RICH, runtime: adapter, input: input.asInput(), output: output.asOutput() });

  output.failNextWrite = true; // the enter-mode write throws mid-setup
  let threw = false;
  try {
    await host.start();
  } catch {
    threw = true;
  }
  assert.ok(threw, 'setup crashed before stop() could run');

  adapter.emitProcessExit(); // the synchronous process.on('exit') backstop
  assert.equal(adapter.writeSyncCalls.length, 1, 'restore ran exactly once via writeSync');
  assert.equal(adapter.writeSyncCalls[0].data, leaveMode(RICH), 'leave-mode written synchronously');
  assert.equal(adapter.writeSyncCalls[0].fd, 1, 'written to the output fd');

  // The done guard prevents a second sync write if a signal also fires afterwards.
  expectExit(() => adapter.emit('interrupt'));
  assert.equal(adapter.writeSyncCalls.length, 1, 'no second sync restore (idempotent)');
});

// ---------------------------------------------------------------------------
// ST-9 — raw input never appears in the error/warn channels (AC-8/security)
// ---------------------------------------------------------------------------

test('ST-9: raw input bytes never reach writeError/warn', async () => {
  const adapter = new FakeRuntimeAdapter();
  const output = new CaptureStream();
  const input = new FakeInput(true);
  const host = createHost({
    caps: RICH,
    runtime: adapter,
    input: input.asInput(),
    output: output.asOutput(),
    onInput: () => {
      /* app consumes input; the host must not log it */
    },
  });

  await host.start();
  input.feed(new TextEncoder().encode('secret\r'));
  await host.stop();

  assert.equal(adapter.errorOutput.includes('secret'), false, 'no raw input in stderr channel');
  assert.equal(adapter.warnOutput.includes('secret'), false, 'no raw input in warn channel');
});

// ---------------------------------------------------------------------------
// ST-10 — raw mode is never attempted on a non-TTY (AC-8/AR-11)
// ---------------------------------------------------------------------------

test('ST-10: a non-TTY host never enables raw mode', async () => {
  const adapter = new FakeRuntimeAdapter();
  const output = new CaptureStream();
  const input = new FakeInput(false);
  const host = createHost({ caps: RICH, runtime: adapter, input: input.asInput(), output: output.asOutput() });

  await host.start();
  await host.stop();

  assert.equal(adapter.rawModeCalls.includes(true), false, 'raw mode never turned on for a non-TTY');
});

// ---------------------------------------------------------------------------
// ST-8 — EPIPE → best-effort restore + clean exit 0 (AC-7/AR-16)
// ---------------------------------------------------------------------------

test('ST-8: an EPIPE output error restores best-effort and exits 0', async () => {
  const codes: number[] = [];
  const adapter = new FakeRuntimeAdapter();
  const output = new CaptureStream();
  const input = new FakeInput(true);
  const host = createHost({
    caps: RICH,
    runtime: adapter,
    input: input.asInput(),
    output: output.asOutput(),
    onBeforeExit: (c) => codes.push(c),
  });

  await host.start();
  const epipe = Object.assign(new Error('broken pipe'), { code: 'EPIPE' });
  expectExit(() => output.emit('error', epipe));

  assert.ok(output.data.includes(leaveMode(RICH)), 'best-effort restore wrote leave-mode');
  assert.deepEqual(codes, [0], 'onBeforeExit(0) — a disconnect is an expected end');
  assert.deepEqual(adapter.exits, [0], 'clean exit 0');
});
