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
