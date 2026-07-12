/**
 * Implementation tests — the host's `stop()` input release is guarded and restore-safe.
 *
 * ST-2 guards the lifecycle: releasing the input only happens on a real `stop()` of a running host,
 * never on a host that was never started, and never a second time when `stop()` is called again.
 * ST-3 guards that the (best-effort) pause runs *alongside* the terminal restore, not instead of it —
 * a throw from the release must never skip the raw-mode restore.
 */
import { test, expect, vi } from 'vitest';

import { createHost } from '../src/engine/host/host.js';
import { resolveCapabilities } from '../src/engine/capability/index.js';
import type { CapabilityProfile } from '../src/engine/capability/index.js';
import { CaptureStream, FakeInput, FakeRuntimeAdapter } from './host-doubles.js';

const CAPS: CapabilityProfile = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { mouse: { sgr: true }, altScreen: true },
}).profile;

// ST-2 — the release is gated on a running host. stop() before start() is a no-op (the !running
// guard), and a second stop() after a real one does not pause again.
test('ST-2: pause() is not called for a never-started host, and not twice across repeated stop()', async () => {
  const adapter = new FakeRuntimeAdapter();
  const output = new CaptureStream();
  const input = new FakeInput(true);
  const pauseSpy = vi.spyOn(input, 'pause');

  const host = createHost({ caps: CAPS, runtime: adapter, input: input.asInput(), output: output.asOutput() });

  await host.stop(); // never started ⇒ the !running guard returns early
  expect(pauseSpy).not.toHaveBeenCalled();

  await host.start();
  await host.stop();
  expect(pauseSpy).toHaveBeenCalledTimes(1);

  await host.stop(); // already stopped ⇒ no-op, no second release
  expect(pauseSpy).toHaveBeenCalledTimes(1);
});

// ST-3 — releasing the input does not disturb the terminal restore. On a TTY host, stop() both
// pauses the input AND turns raw mode back off; the best-effort pause runs alongside the restore.
test('ST-3: stop() releases the input and still restores raw mode', async () => {
  const adapter = new FakeRuntimeAdapter();
  const output = new CaptureStream();
  const input = new FakeInput(true);
  const pauseSpy = vi.spyOn(input, 'pause');

  const host = createHost({ caps: CAPS, runtime: adapter, input: input.asInput(), output: output.asOutput() });

  await host.start();
  expect(adapter.rawModeCalls.at(-1)).toBe(true); // raw mode engaged on start

  await host.stop();
  expect(pauseSpy).toHaveBeenCalled(); // input released
  expect(adapter.rawModeCalls.at(-1)).toBe(false); // terminal restored — release did not skip it
});
