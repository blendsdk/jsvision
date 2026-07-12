/**
 * Specification test (immutable oracle) — the host releases the input stream on `stop()`.
 *
 * The bug: `start()` attaches a `'data'` listener to the input, which switches it to flowing mode and
 * refs the underlying handle — that ref is what keeps the Node process alive to receive keys. `stop()`
 * removes the listener but never pauses the stream, so on the common `process.stdin` path the ref is
 * never released: after the app quits the terminal restores correctly but the process hangs (the shell
 * prompt never returns) until `Ctrl+C`.
 *
 * The oracle: while the host is running the input must stay live (so keystrokes flow), and `stop()`
 * must release it (`pause()`) so the event loop can drain and the process can exit.
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

// ST-1a — while running, the input ref is held: pause() has NOT been called after start().
// ST-1b — stop() releases the input: pause() HAS been called, so the process can exit after quit.
test('ST-1: stop() releases the input stream (pause) it held while running', async () => {
  const adapter = new FakeRuntimeAdapter();
  const output = new CaptureStream();
  const input = new FakeInput(true); // a real TTY: the leaking path
  const pauseSpy = vi.spyOn(input, 'pause');

  const host = createHost({ caps: CAPS, runtime: adapter, input: input.asInput(), output: output.asOutput() });

  await host.start();
  // ST-1a: the input must stay live while the app runs so keys arrive — releasing it here would
  // break input. Nothing has paused it yet.
  expect(pauseSpy).not.toHaveBeenCalled();

  await host.stop();
  // ST-1b: stop() released the flowing-mode ref, so the process is free to exit after quit.
  expect(pauseSpy).toHaveBeenCalled();
});
