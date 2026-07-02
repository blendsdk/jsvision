/**
 * Specification tests (immutable oracles) — safety/logger hardening (RD-13).
 *
 * Source: jsvision-ui/RD-13 HR-06 + PA-6, plan docs 03-03-core-safety-capability-host.md and
 * 07-testing-strategy.md (ST-2.3). The stderr sink's UI guard must compare device identity
 * (`{dev,ino}`), not fd numbers, so an interactive stdout/stderr sharing one tty never scribbles the
 * alt-screen: `'auto'` degrades to the ring, explicit `stderr` throws. Expectations derive from the
 * RD/PA, never from the implementation.
 *
 * Later hardening phases append ST-5.a,l to this file.
 */
import { test, expect } from 'vitest';

import { createLogger, LoggerConfigError } from '../src/engine/safety/index.js';
import type { LoggerFs } from '../src/engine/safety/index.js';
import { createHost } from '../src/engine/host/host.js';
import { ScreenBuffer } from '../src/engine/render/buffer.js';
import { resolveCapabilities } from '../src/engine/capability/index.js';
import { CaptureStream, FakeInput, FakeRuntimeAdapter } from './host-doubles.js';

/**
 * A fake filesystem seam with per-fd `{dev,ino}` identity and a `writes` log, so the UI-device
 * guard is deterministically testable. `share` makes fd 1 (uiFd) and fd 2 (stderr) the same device.
 */
function fakeFs(share: boolean): LoggerFs & { writes: Array<{ fd: number; data: string }> } {
  const writes: Array<{ fd: number; data: string }> = [];
  return {
    writes,
    openSync: () => 10,
    fstatSync: (fd: number) => {
      if (fd === 1) return { dev: 1, ino: 42 }; // the UI stream (stdout)
      if (fd === 2) return share ? { dev: 1, ino: 42 } : { dev: 9, ino: 77 }; // stderr
      return { dev: 1, ino: 42 };
    },
    writeSync: (fd: number, data: string) => {
      writes.push({ fd, data });
      return data.length;
    },
    closeSync: () => undefined,
  };
}

// ST-2.3 (a) — `'auto'` sink on a shared UI device degrades to the ring: logs captured, no UI writes.
test("ST-2.3: an 'auto' sink sharing the UI device degrades to the ring (no UI writes)", () => {
  const fs = fakeFs(true);
  const log = createLogger({ enabled: true, sink: 'auto', uiFd: 1, fs });
  log.warn('host', 'captured');

  expect(fs.writes.length).toBe(0); // never wrote to fd 2 / the UI
  expect(log.entries().map((r) => r.msg)).toStrictEqual(['captured']); // captured in the ring
});

// ST-2.3 (b) — explicit `sink:'stderr'` on a shared UI device throws LoggerConfigError.
test('ST-2.3: an explicit stderr sink sharing the UI device throws LoggerConfigError', () => {
  const fs = fakeFs(true);
  expect(() => createLogger({ enabled: true, sink: 'stderr', uiFd: 1, fs })).toThrow(LoggerConfigError);
});

// ST-2.3 (c) — distinct devices: the stderr sink is allowed and writes to fd 2.
test('ST-2.3: an stderr sink on a distinct device is allowed and writes to fd 2', () => {
  const fs = fakeFs(false);
  const log = createLogger({ enabled: true, sink: 'stderr', uiFd: 1, fs });
  log.error('host', 'to-stderr');

  expect(fs.writes.length).toBe(1);
  expect(fs.writes[0]?.fd).toBe(2);
});

// ---------------------------------------------------------------------------
// ST-5.a, ST-5.l — host restart baseline + env branding (HR-15/26)
// ---------------------------------------------------------------------------

const hostCaps = resolveCapabilities({ env: {}, platform: 'linux', override: { altScreen: true } }).profile;

/** A one-glyph frame. */
function hostFrame(glyph: string): ScreenBuffer {
  const buf = new ScreenBuffer(10, 3, { fg: 'default', bg: 'default' });
  buf.set(1, 1, glyph, { fg: 'default', bg: 'default' });
  return buf;
}

// ST-5.a — a stop()→start() restart resets the diff baseline: the first post-restart frame is a FULL
// repaint, so re-rendering an identical frame still paints (a stale baseline would diff to nothing and
// freeze the fresh alt-screen) (HR-15).
test('ST-5.a: a restart forces a full repaint of the first frame', async () => {
  const adapter = new FakeRuntimeAdapter();
  const output = new CaptureStream();
  const input = new FakeInput(false);
  const host = createHost({ caps: hostCaps, runtime: adapter, input: input.asInput(), output: output.asOutput() });

  await host.start();
  host.render(hostFrame('X')); // establishes a baseline
  await host.stop();

  await host.start(); // restart → baseline reset
  const mark = output.data.length;
  host.render(hostFrame('X')); // the SAME frame — a stale baseline would emit nothing here
  expect(output.data.slice(mark)).toContain('X'); // full repaint of the glyph
  await host.stop();
});

// ST-5.l — the logger gates on the renamed JSVISION_DEBUG; the old BLENDTUI_DEBUG no longer enables it (HR-26/PA-4).
test('ST-5.l: the logger honors JSVISION_DEBUG, not the retired BLENDTUI_DEBUG', () => {
  const on = createLogger({ env: { JSVISION_DEBUG: '1' }, sink: 'ring' });
  on.info('host', 'up');
  expect(on.enabled).toBe(true);
  expect(on.entries().map((r) => r.msg)).toContain('up');

  const off = createLogger({ env: { BLENDTUI_DEBUG: '1' } }); // retired name → dead
  expect(off.enabled).toBe(false);
});
