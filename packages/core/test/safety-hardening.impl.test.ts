/**
 * Implementation tests — safety/logger hardening (RD-13, HR-06).
 *
 * Edge coverage beyond ST-2.3: uiFd permutations (UI on stderr), and a failing fstat degrading
 * conservatively to "same device".
 */
import { test, expect } from 'vitest';

import { createLogger, LoggerConfigError } from '../src/engine/safety/index.js';
import type { LoggerFs } from '../src/engine/safety/index.js';

/** A fake fs with per-fd `{dev,ino}` and a writes log. */
function fs(identity: (fd: number) => { dev: number; ino: number }): LoggerFs & { writes: number } {
  const state = { writes: 0 } as LoggerFs & { writes: number };
  return Object.assign(state, {
    openSync: () => 10,
    fstatSync: identity,
    writeSync: () => {
      state.writes += 1;
      return 0;
    },
    closeSync: () => undefined,
  });
}

test('uiFd on stderr (fd 2): an explicit stderr sink throws', () => {
  const f = fs(() => ({ dev: 1, ino: 5 })); // every fd is the same device
  expect(() => createLogger({ enabled: true, sink: 'stderr', uiFd: 2, fs: f })).toThrow(LoggerConfigError);
});

test('uiFd on stderr (fd 2): an auto sink degrades to the ring', () => {
  const f = fs(() => ({ dev: 1, ino: 5 }));
  const log = createLogger({ enabled: true, sink: 'auto', uiFd: 2, fs: f });
  log.info('t', 'x');
  expect(f.writes).toBe(0);
  expect(log.entries().length).toBe(1);
});

test('a failing fstat conservatively treats stderr as the UI device', () => {
  const f = fs((fd) => {
    if (fd === 2) throw new Error('fstat failed');
    return { dev: 1, ino: 5 };
  });
  // auto → cannot compare → assume shared → ring (no throw, no UI writes).
  const log = createLogger({ enabled: true, sink: 'auto', uiFd: 1, fs: f });
  log.info('t', 'x');
  expect(f.writes).toBe(0);
  expect(log.entries().length).toBe(1);
  // explicit stderr → cannot compare → assume shared → throw.
  expect(() => createLogger({ enabled: true, sink: 'stderr', uiFd: 1, fs: f })).toThrow(LoggerConfigError);
});
