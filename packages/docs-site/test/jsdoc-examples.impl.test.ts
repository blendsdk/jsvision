/**
 * Implementation test — the extraction half of the `@example` compile guard.
 *
 * The spec oracle beside this file pins what the guard *concludes*; this one
 * covers how a raw JSDoc comment becomes compilable TypeScript, and how a block
 * gets the key its allowlist entry is written against. Both are internals, but
 * both are load-bearing: a body that keeps its fence never compiles, and a key
 * that shifts between runs turns the ratchet into a random failure generator.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test, expect } from 'vitest';
import { collectExamples } from '../src/api/jsdoc-examples.mjs';

const IMPL_FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'jsdoc-examples', 'impl');

const blocks = collectExamples([IMPL_FIXTURES]);

/** The one block a fixture file declares under the given key. */
function block(fileName: string, symbol: string) {
  const found = blocks.filter((b) => b.file.endsWith(`/${fileName}`) && b.symbol === symbol);
  expect(found, `expected exactly one ${fileName}::${symbol}`).toHaveLength(1);
  return found[0];
}

describe('fence stripping', () => {
  // Fencing is a per-block authoring habit, not a per-package one, so the strip
  // is unconditional — all four shapes must reduce to the same source.
  test.each([['bareFence'], ['tsFence'], ['typescriptFence'], ['noFence']])(
    'reduces the %s shape to the fence-free body',
    (symbol) => {
      expect(block('fences.ts', symbol).body).toBe('const bare = 1;');
    },
  );
});

describe('comment terminators', () => {
  test('un-escapes a block-comment terminator back to valid TypeScript', () => {
    // A body that contains a block comment has to escape its terminator in the
    // source, or the JSDoc comment would end early. The raw text hands the
    // escape straight back, and an escaped terminator does not parse.
    const body = block('terminator.ts', 'format').body;
    expect(body).toContain('/* a block comment inside the example */');
    expect(body).not.toContain('*\\/');
  });
});

describe('symbol keying', () => {
  test('collapses a tag reachable from several nodes into exactly one block', () => {
    // One `@example` on an `export const` is reachable from the statement, the
    // declaration and its identifier. A naive tag walk mints three blocks, two
    // of them under the wrong name — and one of those names is the anonymous
    // fallback, whose recorded diagnostics would then shift run to run.
    const fromConstExport = blocks.filter((b) => b.file.endsWith('/const-export.ts'));
    expect(fromConstExport).toHaveLength(1);
    expect(fromConstExport[0].symbol).toBe('ANSWER');
  });

  test('qualifies class and interface members by their owner', () => {
    // A bare member name is not file-unique by construction: two declarations in
    // one file may each carry a `draw`.
    const members = blocks
      .filter((b) => b.file.endsWith('/members.ts'))
      .map((b) => b.symbol)
      .sort();
    expect(members).toEqual(['Drawable.draw', 'Widget.draw']);
  });

  test('falls back to an ordinal-suffixed anonymous key for unnamed nodes', () => {
    // A leading file comment binds to whatever follows it, which has no name of
    // its own. Two of them in one file collide, so the ordinal is the only thing
    // keeping their allowlist entries apart.
    const anonymous = blocks.filter((b) => b.file.endsWith('/anonymous.ts'));
    expect(anonymous.map((b) => b.symbol)).toEqual(['(anonymous)#1', '(anonymous)#2']);
    // The ordinal follows source order, so it is stable across runs.
    expect(anonymous[0].line).toBeLessThan(anonymous[1].line);
  });
});

describe('virtual paths', () => {
  test('places every block inside its own source directory and writes nothing there', () => {
    // Relative specifiers and `type: module` (every package has one, and dozens
    // of blocks use top-level await) both resolve from the source's directory,
    // so the block has to be compiled as if it lived there.
    for (const b of blocks) {
      expect(dirname(b.virtualPath)).toBe(IMPL_FIXTURES);
    }
    // Unique per block, so two blocks in one file cannot shadow each other.
    expect(new Set(blocks.map((b) => b.virtualPath)).size).toBe(blocks.length);
  });
});
