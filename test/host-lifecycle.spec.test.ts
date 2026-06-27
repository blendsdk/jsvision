/**
 * Specification tests — non-TTY, resize coalescing, suspend/resume (RD-07).
 *
 * Immutable oracle: expectations derive from ST-6, ST-6b, ST-4, ST-5 in plan doc
 * 07-testing-strategy and AR-9/AR-10/AR-11 — never from reading the
 * implementation. If a test here fails after implementation, the implementation
 * is wrong.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../src/engine/host/host.js';
import { enterMode, leaveMode } from '../src/engine/host/modes.js';
import { ScreenBuffer } from '../src/engine/render/buffer.js';
import { resolveCapabilities } from '../src/engine/capability/index.js';
import type { CapabilityProfile, DeepPartial } from '../src/engine/capability/index.js';
import type { ResizeEvent } from '../src/engine/host/types.js';
import { CaptureStream, FakeInput, FakeRuntimeAdapter } from './host-doubles.js';

/** Deterministic capability profile with the given fields overridden. */
function caps(override: DeepPartial<CapabilityProfile> = {}): CapabilityProfile {
  return resolveCapabilities({ env: {}, platform: 'linux', override }).profile;
}

const RICH = caps({ mouse: { sgr: true, drag: true, wheel: true }, altScreen: true, bracketedPaste: true });

/** A small frame with a visible glyph. */
function frame(glyph = 'X'): ScreenBuffer {
  const buf = new ScreenBuffer(10, 3, { fg: 'default', bg: 'default' });
  buf.set(1, 1, glyph, { fg: 'default', bg: 'default' });
  return buf;
}

// ---------------------------------------------------------------------------
// ST-6 — non-TTY start: isTTY false, no raw mode, no enter-mode (AC-5/AR-11)
// ---------------------------------------------------------------------------

test('ST-6: a non-TTY host skips raw mode and enter-mode', async () => {
  const adapter = new FakeRuntimeAdapter();
  const output = new CaptureStream();
  const input = new FakeInput(false); // not a TTY
  const host = createHost({ caps: RICH, runtime: adapter, input: input.asInput(), output: output.asOutput() });

  await host.start();

  assert.equal(host.isTTY, false, 'isTTY reflects the non-TTY input');
  assert.equal(adapter.rawModeCalls.length, 0, 'setRawMode never called');
  assert.equal(output.data.includes(enterMode(RICH)), false, 'no enter-mode written');
  await host.stop();
});

// ---------------------------------------------------------------------------
// ST-6b — non-TTY render still writes the frame (AR-11)
// ---------------------------------------------------------------------------

test('ST-6b: a non-TTY host still writes rendered frames', async () => {
  const adapter = new FakeRuntimeAdapter();
  const output = new CaptureStream();
  const input = new FakeInput(false);
  const host = createHost({ caps: RICH, runtime: adapter, input: input.asInput(), output: output.asOutput() });

  await host.start();
  host.render(frame('Q'));
  await host.stop();

  assert.ok(output.data.includes('Q'), 'frame glyph written even without a TTY');
});

// ---------------------------------------------------------------------------
// ST-4 — a SIGWINCH burst coalesces to one ResizeEvent (AC-3/AR-9/PF-007)
// ---------------------------------------------------------------------------

test('ST-4: three synchronous resizes coalesce to a single ResizeEvent', async () => {
  const resizes: ResizeEvent[] = [];
  const adapter = new FakeRuntimeAdapter();
  const output = new CaptureStream();
  const input = new FakeInput(true);
  const host = createHost({
    caps: RICH,
    runtime: adapter,
    input: input.asInput(),
    output: output.asOutput(),
    onResize: (e) => resizes.push(e),
  });

  await host.start();
  output.columns = 100;
  output.rows = 40;
  adapter.emit('resize');
  adapter.emit('resize');
  adapter.emit('resize');
  assert.equal(resizes.length, 0, 'nothing fires before the immediate drains');
  adapter.flushImmediates();
  await host.stop();

  assert.deepEqual(resizes, [{ type: 'resize', columns: 100, rows: 40 }], 'exactly one coalesced resize');
});

// ---------------------------------------------------------------------------
// ST-5 — suspend restores+suspends; continue re-asserts + repaints (AC-4/AR-10/PF-001)
// ---------------------------------------------------------------------------

test('ST-5: suspend then continue restore/suspend then re-assert + repaint', async () => {
  let suspended = false;
  let resumed = false;
  const adapter = new FakeRuntimeAdapter();
  const output = new CaptureStream();
  const input = new FakeInput(true);
  const host = createHost({
    caps: RICH,
    runtime: adapter,
    input: input.asInput(),
    output: output.asOutput(),
    onSuspend: () => {
      suspended = true;
    },
    onResume: () => {
      resumed = true;
    },
  });

  const enter = enterMode(RICH);
  const leave = leaveMode(RICH);

  await host.start();
  host.render(frame('R')); // sets the last buffer for the resume repaint
  const beforeSuspend = output.data.length;

  adapter.emit('suspend');
  assert.ok(suspended, 'onSuspend fired');
  assert.ok(output.data.indexOf(leave, beforeSuspend) >= 0, 'leave-mode written on suspend');
  assert.equal(adapter.rawModeCalls.at(-1), false, 'raw mode turned off on suspend');
  assert.equal(adapter.suspendCount, 1, 'process suspended via suspendSelf (PF-001)');

  const beforeContinue = output.data.length;
  adapter.emit('continue');
  assert.ok(output.data.indexOf(enter, beforeContinue) >= 0, 'enter-mode re-asserted on continue');
  assert.ok(output.data.indexOf('R', beforeContinue) >= 0, 'last frame repainted on continue');
  assert.equal(adapter.rawModeCalls.at(-1), true, 'raw mode restored on continue');
  assert.ok(resumed, 'onResume fired');

  await host.stop();
});
