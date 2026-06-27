/**
 * Implementation tests — per-OS platform adapter (RD-07, PF-005/PF-010).
 *
 * Probes `platform.ts` directly: the pure `hostSignalSource` map for POSIX and
 * win32, that win32 `resize`/`hangup` attach to the **provided** output stream
 * (PF-010), and the win32 VT-warn-once branch via the injectable predicate +
 * warning sink (PF-005). The win32 paths are exercised from this POSIX-friendly
 * runner by injecting `platform`/`vtAvailable`/`warn` — never touching the real
 * `process` signal set for the process-sourced signals.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hostSignalSource, realRuntime } from '../src/engine/host/platform.js';
import { CaptureStream } from './host-doubles.js';

// ---------------------------------------------------------------------------
// hostSignalSource — pure POSIX/win32 maps (PF-005)
// ---------------------------------------------------------------------------

test('hostSignalSource: POSIX maps signals to process sources', () => {
  for (const platform of ['linux', 'darwin'] as const) {
    assert.deepEqual(hostSignalSource(platform, 'resize'), { emitter: 'process', name: 'SIGWINCH' });
    assert.deepEqual(hostSignalSource(platform, 'interrupt'), { emitter: 'process', name: 'SIGINT' });
    assert.deepEqual(hostSignalSource(platform, 'terminate'), { emitter: 'process', name: 'SIGTERM' });
    assert.deepEqual(hostSignalSource(platform, 'hangup'), { emitter: 'process', name: 'SIGHUP' });
    assert.deepEqual(hostSignalSource(platform, 'suspend'), { emitter: 'process', name: 'SIGTSTP' });
    assert.deepEqual(hostSignalSource(platform, 'continue'), { emitter: 'process', name: 'SIGCONT' });
  }
});

test('hostSignalSource: win32 routes resize/hangup to the output and drops suspend/continue', () => {
  assert.deepEqual(hostSignalSource('win32', 'resize'), { emitter: 'output', name: 'resize' });
  assert.deepEqual(hostSignalSource('win32', 'interrupt'), { emitter: 'process', name: 'SIGINT' });
  assert.deepEqual(hostSignalSource('win32', 'terminate'), { emitter: 'process', name: 'SIGBREAK' });
  assert.deepEqual(hostSignalSource('win32', 'hangup'), { emitter: 'output', name: 'close' });
  assert.equal(hostSignalSource('win32', 'suspend'), null, 'no SIGTSTP on win32');
  assert.equal(hostSignalSource('win32', 'continue'), null, 'no SIGCONT on win32');
});

// ---------------------------------------------------------------------------
// realRuntime — win32 resize/hangup attach to the provided output (PF-010)
// ---------------------------------------------------------------------------

test('realRuntime(win32): resize attaches to the provided output and unsubscribes cleanly', () => {
  const output = new CaptureStream();
  const adapter = realRuntime(output.asOutput(), { platform: 'win32' });

  const unsubscribe = adapter.on('resize', () => {});
  assert.equal(output.listenerCount('resize'), 1, 'win32 resize is sourced from the output');
  unsubscribe();
  assert.equal(output.listenerCount('resize'), 0, 'unsubscribe removes the output listener');
});

test('realRuntime(win32): hangup attaches to the output close event', () => {
  const output = new CaptureStream();
  const adapter = realRuntime(output.asOutput(), { platform: 'win32' });

  const unsubscribe = adapter.on('hangup', () => {});
  assert.equal(output.listenerCount('close'), 1, 'win32 hangup is sourced from output close');
  unsubscribe();
  assert.equal(output.listenerCount('close'), 0);
});

test('realRuntime(win32): suspend/continue are inert (no listeners, callable unsubscribe)', () => {
  const output = new CaptureStream();
  const adapter = realRuntime(output.asOutput(), { platform: 'win32' });

  const unsubSuspend = adapter.on('suspend', () => {});
  const unsubContinue = adapter.on('continue', () => {});
  assert.equal(output.listenerCount('resize'), 0, 'no output listeners from unsupported signals');
  assert.doesNotThrow(() => {
    unsubSuspend();
    unsubContinue();
  });
});

// ---------------------------------------------------------------------------
// realRuntime — win32 VT-warn-once via the injectable predicate (PF-005)
// ---------------------------------------------------------------------------

test('realRuntime(win32): warns once when VT processing is unavailable', () => {
  const warnings: string[] = [];
  realRuntime(new CaptureStream().asOutput(), {
    platform: 'win32',
    vtAvailable: () => false,
    warn: (m) => warnings.push(m),
  });
  assert.equal(warnings.length, 1, 'exactly one warning');
  assert.match(warnings[0], /virtual-terminal/i, 'mentions VT processing');
});

test('realRuntime(win32): no warning when VT processing is available', () => {
  const warnings: string[] = [];
  realRuntime(new CaptureStream().asOutput(), {
    platform: 'win32',
    vtAvailable: () => true,
    warn: (m) => warnings.push(m),
  });
  assert.equal(warnings.length, 0);
});

test('realRuntime(POSIX): never runs the VT check, even if the predicate is false', () => {
  const warnings: string[] = [];
  realRuntime(new CaptureStream().asOutput(), {
    platform: 'linux',
    vtAvailable: () => false,
    warn: (m) => warnings.push(m),
  });
  assert.equal(warnings.length, 0, 'VT check is win32-only');
});
