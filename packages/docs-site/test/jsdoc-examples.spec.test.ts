/**
 * Specification test (immutable oracle) — the JSDoc `@example` compile guard.
 *
 * Pins the pass/fail contract of collectExamples + checkExamples: every
 * `@example` block found under a root is compiled as real TypeScript from a
 * virtual file inside its own source's directory (so relative imports resolve
 * and nothing is ever written to disk), and the result is ratcheted against an
 * allowlist. The verdicts pinned here:
 *
 *   - a block absent from the allowlist passes only if it compiles;
 *   - a block on the allowlist passes only if it still fails with EXACTLY the
 *     recorded diagnostic codes AND the recorded missing identifier names —
 *     the same code with a different missing name is a new failure, not a
 *     grandfathered one;
 *   - an allowlisted block that now compiles is STALE and fails the run (the
 *     ratchet only tightens — "it compiles" is never silently fine for an
 *     allowlisted entry);
 *   - an allowlist entry naming a vanished file or symbol is STALE;
 *   - two `@example` blocks on the same declaration are independent entries,
 *     disambiguated by a 1-based `#N` ordinal in source order.
 *
 * This file is the oracle the implementation must satisfy. If it fails after
 * the implementation lands, fix the implementation, not this file.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from 'vitest';
import { collectExamples, checkExamples, SHIPPED_ROOTS } from '../src/api/jsdoc-examples.mjs';

/** Shape of one allowlist value — codes + missingNames are compared, message is prose. */
interface AllowEntry {
  codes: number[];
  missingNames: string[];
  message: string;
}
type Allowlist = Record<string, AllowEntry>;

const HERE = dirname(fileURLToPath(import.meta.url));
// test/ lives at packages/docs-site/test → the repo root is three levels up.
const REPO_ROOT = join(HERE, '..', '..', '..');
const FIXTURES = join(HERE, 'fixtures', 'jsdoc-examples');

/** Absolute path of one fixture subdirectory, used as the sole collection root. */
function fixtureRoot(subdir: string): string {
  return join(FIXTURES, subdir);
}

/** Repo-relative POSIX `file::symbol` key for a fixture, matching failure/allowlist keys. */
function fixtureKey(subdir: string, file: string, symbol: string): string {
  const repoRelative = relative(REPO_ROOT, join(FIXTURES, subdir, file))
    .split(sep)
    .join('/');
  return `${repoRelative}::${symbol}`;
}

/** Collect from exactly one fixture subdirectory and check against the given allowlist. */
function run(subdir: string, allowlist: Allowlist) {
  return checkExamples(collectExamples([fixtureRoot(subdir)]), allowlist);
}

test('a compiling block with no allowlist entry passes and is counted', () => {
  const result = run('ok', {});
  expect(result.checked).toBe(1);
  expect(result.unexpected).toEqual([]);
  expect(result.stale).toEqual([]);
});

test('a non-compiling block with no allowlist entry is reported as unexpected with its TS code', () => {
  const result = run('arity', {});
  expect(result.unexpected).toHaveLength(1);
  const failure = result.unexpected[0];
  // The key is the repo-relative source path plus the declaration the block documents.
  expect(failure.key).toBe(fixtureKey('arity', 'arity.ts', 'add'));
  // Calling add(1) instead of add(1, 2) is the wrong-argument-count diagnostic.
  expect(failure.codes).toContain(2554);
});

test('a failing block whose allowlist entry records the same codes is grandfathered', () => {
  const allowlist: Allowlist = {
    [fixtureKey('arity', 'arity.ts', 'add')]: {
      codes: [2554],
      missingNames: [],
      message: 'TS2554 Expected 2 arguments, but got 1.',
    },
  };
  const result = run('arity', allowlist);
  expect(result.unexpected).toEqual([]);
  expect(result.stale).toEqual([]);
});

test('an allowlisted block that now COMPILES makes the run fail as stale', () => {
  // The counter-intuitive core of the ratchet: a passing block under an
  // allowlist entry is not "fine" — the entry is stale and must be removed,
  // otherwise dead entries accumulate and mask future regressions.
  const okKey = fixtureKey('ok', 'ok.ts', 'join2');
  const allowlist: Allowlist = {
    [okKey]: {
      codes: [2304],
      missingNames: ['join2'],
      message: "TS2304 Cannot find name 'join2'.",
    },
  };
  const result = run('ok', allowlist);
  expect(result.stale).toContain(okKey);
  expect(result.unexpected).toEqual([]);
});

test('the same diagnostic code with an EXTRA missing identifier is unexpected, not grandfathered', () => {
  // A forgotten `at` import raises TS2304 exactly like the recorded missing
  // `dialog` — matching on codes alone would hide it. The guard must compare
  // the missing identifier names themselves.
  const key = fixtureKey('missing-two', 'missing-two.ts', 'okCaption');
  const allowlist: Allowlist = {
    [key]: {
      codes: [2304],
      missingNames: ['dialog'],
      message: "TS2304 Cannot find name 'dialog'.",
    },
  };
  const result = run('missing-two', allowlist);
  expect(result.unexpected).toHaveLength(1);
  const failure = result.unexpected[0];
  expect(failure.key).toBe(key);
  expect(failure.missingNames).toContain('at');
  expect(failure.missingNames).toContain('dialog');
});

test('a ```ts fence is stripped before compiling, so a fenced valid block passes', () => {
  // Left in place, the backticks would parse as a template literal and the
  // block could not compile as the code it documents.
  const result = run('fenced', {});
  expect(result.unexpected).toEqual([]);
});

test('relative imports resolve against the SOURCE directory and nothing is written to disk', () => {
  const result = run('relative', {});
  // The block imports './thing.js'; it compiles only if the virtual file is
  // placed inside the source's own directory.
  expect(result.unexpected).toEqual([]);
  // The compilation is virtual: after the run the directory holds only the
  // two committed fixtures, no emitted or temporary .ts files.
  const tsFiles = readdirSync(fixtureRoot('relative'))
    .filter((name) => name.endsWith('.ts'))
    .sort();
  expect(tsFiles).toEqual(['relative.ts', 'thing.ts']);
});

test('allowlisting one failing symbol neither masks nor orphans a sibling symbol in the same file', () => {
  // Entries address symbols independently: `bad` is grandfathered, while the
  // compiling `good` in the same file needs no entry and creates no staleness.
  const allowlist: Allowlist = {
    [fixtureKey('two-symbols', 'two-symbols.ts', 'bad')]: {
      codes: [2554],
      missingNames: [],
      message: 'TS2554 Expected 2 arguments, but got 1.',
    },
  };
  const result = run('two-symbols', allowlist);
  expect(result.unexpected).toEqual([]);
  expect(result.stale).toEqual([]);
});

test('allowlist entries naming a vanished file or a vanished symbol are both reported stale', () => {
  const deadFileKey = fixtureKey('ok', 'does-not-exist.ts', 'ghost');
  const deadSymbolKey = fixtureKey('ok', 'ok.ts', 'noSuchSymbol');
  const allowlist: Allowlist = {
    [deadFileKey]: {
      codes: [2304],
      missingNames: ['ghost'],
      message: "TS2304 Cannot find name 'ghost'.",
    },
    [deadSymbolKey]: {
      codes: [2304],
      missingNames: ['dialog'],
      message: "TS2304 Cannot find name 'dialog'.",
    },
  };
  const result = run('ok', allowlist);
  expect(result.stale).toContain(deadFileKey);
  expect(result.stale).toContain(deadSymbolKey);
  expect(result.stale).toHaveLength(2);
  // The one real block compiles and is not allowlisted, so it is not the problem.
  expect(result.unexpected).toEqual([]);
});

test('two blocks on the SAME declaration are independent entries under the #N ordinal', () => {
  // same-symbol.ts documents `Counter` with two blocks: the first compiles,
  // the second calls bump() without its argument. Only the second (ordinal #2
  // in source order) needs — and gets — an allowlist entry.
  const allowlist: Allowlist = {
    [fixtureKey('same-symbol', 'same-symbol.ts', 'Counter#2')]: {
      codes: [2554],
      missingNames: [],
      message: 'TS2554 Expected 1 arguments, but got 0.',
    },
  };
  const result = run('same-symbol', allowlist);
  expect(result.unexpected).toEqual([]);
  expect(result.stale).toEqual([]);
});

test('every @example in the shipped packages compiles, modulo only the committed allowlist', () => {
  // The standing gate over the real repo — the reason the guard exists.
  // A public `@example` block is an API contract: consumers and AI agents
  // read it on hover and paste it, so it must compile. If this test fires,
  // fix the example itself — do NOT append to the allowlist. The allowlist
  // is a shrink-only ratchet for pre-existing failures; a stale entry means
  // an example was fixed and its entry must now be deleted.
  const allowlist = JSON.parse(readFileSync(join(HERE, 'jsdoc-examples.allowlist.json'), 'utf8')) as Allowlist;
  const result = checkExamples(collectExamples(SHIPPED_ROOTS), allowlist);
  // Assert on sorted key projections, not the raw failure objects, so a CI
  // failure prints exactly which `file::Symbol` broke instead of a wall of
  // full diagnostics.
  expect(result.unexpected.map((failure) => failure.key).sort()).toEqual([]);
  expect([...result.stale].sort()).toEqual([]);
}, 120_000);
