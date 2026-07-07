/**
 * Specification tests (immutable oracles) — RD-08 Phase-9 `FileSystem` content methods (ST-30,
 * seam half).
 *
 * Source: RD-08 AC-13 / PA-6 → ST-30 (codeops/features/jsvision-ui/plans/editor-family/
 * 07-testing-strategy.md; 03-06 §FileSystem additions). The four ADDITIVE methods —
 * `readFile`/`writeFile`/`rename`/`unlink` — transcribe TV's backup sequence 1:1 with no
 * platform-dependent rename-overwrite semantics hidden in the seam (PA-6): the caller unlinks the
 * stale `.bak` itself. Present on `nodeFileSystem` (shape) and behaving on the in-memory fs
 * (disk-free, AC-13). Expectations derive from RD-08 + the register, never the implementation.
 *
 * Trace: RD-08 03-06 · PA-6 · ST-30 (seam half).
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { nodeFileSystem } from '../src/fs/node-fs.js';
import { createMemoryFs, dir, file } from './helpers/memory-fs.js';

test('ST-30: the four content methods exist on nodeFileSystem (shape only — no disk here)', () => {
  expect(typeof nodeFileSystem.readFile).toBe('function');
  expect(typeof nodeFileSystem.writeFile).toBe('function');
  expect(typeof nodeFileSystem.rename).toBe('function');
  expect(typeof nodeFileSystem.unlink).toBe('function');
});

test('ST-30: writeFile creates/replaces; readFile round-trips exactly (CRLF intact)', () => {
  const fs = createMemoryFs(dir({ docs: dir() }));
  fs.writeFile('/docs/a.txt', 'a\r\nb');
  expect(fs.readFile('/docs/a.txt')).toBe('a\r\nb'); // byte-identical round-trip
  fs.writeFile('/docs/a.txt', 'replaced');
  expect(fs.readFile('/docs/a.txt')).toBe('replaced');
});

test('ST-30: rename moves the node; unlink removes it; both throw on a missing source', () => {
  const fs = createMemoryFs(dir({ 'x.txt': file({ content: 'X' }) }));
  fs.rename('/x.txt', '/y.txt');
  expect(fs.readFile('/y.txt')).toBe('X');
  expect(() => fs.readFile('/x.txt')).toThrow();
  fs.unlink('/y.txt');
  expect(() => fs.readFile('/y.txt')).toThrow();
  expect(() => fs.unlink('/nope')).toThrow(); // the caller swallows the first-save case itself
});
