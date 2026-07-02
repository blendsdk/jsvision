/**
 * Specification tests (immutable oracles) — RD-07 essential-control-completions packaging (ST-15).
 *
 * Source: jsvision-ui RD-07 AC-13 → ST-15 (essential-control-completions/07-testing-strategy.md).
 * `picture` + `MultiCheckGroup` have explicit named re-exports from `src/index.ts` (imported here BY
 * NAME from `@jsvision/ui`, the published surface); `input.ts` + any split helper stay ≤ 500 lines; and
 * the RD-07 caret/clipboard loop seams are **additive** — optional members that leave the existing
 * `EventLoop`/`DispatchEvent` signatures usable unchanged. Expectations derive from the ACs, not the impl.
 */
import { test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveCapabilities } from '@jsvision/core';
import {
  MultiCheckGroup,
  picture,
  createEventLoop,
  signal,
  Group,
  type MultiCheckGroupOptions,
  type Validator,
} from '@jsvision/ui';

const here = dirname(fileURLToPath(import.meta.url));

/** Recursively list every `.ts` source file under a directory. */
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

// ST-15 / AC-13 — the RD-07 additions are importable by name from the published surface.
test('ST-15: picture + MultiCheckGroup are importable by name from @jsvision/ui', () => {
  expect(MultiCheckGroup).toBeTypeOf('function');
  expect(picture).toBeTypeOf('function');
  // Type-only usage — fails to typecheck if a type is missing from the public surface.
  const v: Validator = picture('###');
  const opts: MultiCheckGroupOptions = { items: ['A'], states: ' X', value: signal([0]) };
  expect(v.isValidInput('5')).toBe(true);
  expect(opts.states).toBe(' X');
});

// ST-15 / AC-13 / PA-4 — each control source file stays ≤ 500 lines (the split kept input.ts under cap).
test('ST-15: each src/controls file is ≤ 500 lines', () => {
  const dir = join(here, '..', 'src', 'controls');
  for (const file of tsFiles(dir)) {
    const lines = readFileSync(file, 'utf8').split('\n').length;
    expect(lines, file).toBeLessThanOrEqual(500);
  }
});

// ST-15 / AC-13 — the caret/clipboard seams are ADDITIVE: a loop built without wiring onCaret /
// writeClipboard / onFrame still mounts + dispatches + reports its buffer (the seams are optional).
test('ST-15: the RD-07 loop seams are additive (unset ⇒ the loop still works headlessly)', () => {
  const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
  const loop = createEventLoop({ width: 10, height: 3 }, { caps });
  loop.mount(new Group());
  // onCaret / writeClipboard / onFrame are all unset here.
  expect(loop.onCaret).toBeUndefined();
  expect(loop.writeClipboard).toBeUndefined();
  expect(loop.onFrame).toBeUndefined();
  // refreshCaret is a no-op with no sink; the loop keeps composing a buffer.
  expect(() => loop.refreshCaret()).not.toThrow();
  expect(loop.renderRoot.buffer().width).toBe(10);
});
