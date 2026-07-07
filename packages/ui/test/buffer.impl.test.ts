/**
 * Implementation tests — RD-08 Phase-2 buffer core internals and edge cases (after green).
 *
 * Covers what the ST oracles don't: gap-move stress against a plain-string reference model,
 * alternating-edit amortization shapes, CR-only files, tab-at-boundary `charPtr` round-trips,
 * and RD-13 HR-01-style hostile-UTF-8 navigation sweeps (totality + progress guarantees).
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import {
  GapBuffer,
  lineStart,
  lineEnd,
  nextChar,
  prevChar,
  nextLine,
  prevLine,
  nextWord,
  prevWord,
  charPos,
  charPtr,
  lineMove,
  detectEol,
  isClusterStart,
} from '../src/editor/buffer/index.js';

// --- GapBuffer vs a plain-string reference model ---------------------------------------------

/** Deterministic pseudo-random ints (no Math.random in tests — reproducible failures). */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s;
  };
}

test('gap stress: 500 mixed edits at scattered positions match a string reference model', () => {
  const rng = makeRng(0xed17);
  const g = new GapBuffer('seed text\nwith two lines');
  let ref = 'seed text\nwith two lines';
  for (let step = 0; step < 500; step++) {
    const op = rng() % 3;
    const p = ref.length === 0 ? 0 : rng() % (ref.length + 1);
    if (op === 0) {
      const chunk = `x${step % 10}`;
      g.insert(p, chunk);
      ref = ref.slice(0, p) + chunk + ref.slice(p);
    } else if (op === 1) {
      const to = Math.min(ref.length, p + (rng() % 4));
      g.remove(p, to);
      ref = ref.slice(0, p) + ref.slice(to);
    } else {
      g.moveGap(p); // pure gap motion must never change content
    }
    expect(g.length).toBe(ref.length);
  }
  expect(g.text()).toBe(ref);
});

test('charAt/slice agree with the reference across gap positions', () => {
  const g = new GapBuffer('abcdef');
  g.moveGap(3); // split the halves mid-string
  expect(g.charAt(0)).toBe('a');
  expect(g.charAt(2)).toBe('c');
  expect(g.charAt(3)).toBe('d');
  expect(g.charAt(5)).toBe('f');
  expect(g.slice(1, 5)).toBe('bcde'); // spans the gap
  expect(g.slice(4, 2)).toBe(''); // reversed → empty
  expect(g.slice(-5, 99)).toBe('abcdef'); // clamped
});

test('alternating edits at the same point stay cheap (amortized gap residency)', () => {
  const g = new GapBuffer('');
  for (let i = 0; i < 2000; i++) g.insert(g.length, 'a'); // typing at the gap
  for (let i = 0; i < 1000; i++) g.remove(g.length - 1, g.length); // backspacing at the gap
  expect(g.length).toBe(1000);
  expect(g.text()).toBe('a'.repeat(1000));
});

test('remove normalizes reversed bounds; insert clamps out-of-range positions', () => {
  const g = new GapBuffer('hello');
  g.remove(4, 1); // reversed → removes [1,4)
  expect(g.text()).toBe('ho');
  g.insert(99, '!'); // clamps to end
  expect(g.text()).toBe('ho!');
  g.insert(-5, '>'); // clamps to start
  expect(g.text()).toBe('>ho!');
});

// --- CR-only files ----------------------------------------------------------------------------

test('CR-only files: breaks, line hops, and detection all treat lone \\r as the ending', () => {
  const b = new GapBuffer('aa\rbb\rcc');
  expect(detectEol(b.text())).toBe('cr');
  expect(lineEnd(b, 0)).toBe(2);
  expect(lineStart(b, 4)).toBe(3);
  expect(nextChar(b, 2)).toBe(3); // a lone \r steps as one unit
  expect(prevChar(b, 3)).toBe(2);
  expect(nextLine(b, 0)).toBe(3);
  expect(prevLine(b, 3)).toBe(0);
  expect(lineMove(b, 1, 2)).toBe(7); // col 1 preserved across two CR lines
});

// --- Tab boundaries ----------------------------------------------------------------------------

test('charPtr(charPos) round-trips on unit boundaries around tab stops', () => {
  const b = new GapBuffer('\ta\tbb\tc'); // tabs at cols 0, then post-"a", then post-"bb"
  for (let p = 0; p <= b.length; p++) {
    const pos = charPos(b, 0, p);
    expect(charPtr(b, 0, pos)).toBe(p); // every real position is reachable from its column
  }
  expect(charPos(b, 0, 1)).toBe(8); // leading tab: (0|7)+1
  expect(charPtr(b, 0, 3)).toBe(0); // column inside the leading tab → previous position
});

// --- Hostile-UTF-8 sweeps (RD-13 HR-01 style) ---------------------------------------------------

const HOSTILE = [
  '\uD83D\uD83D', // two lone high surrogates
  '\uDC00abc\uD800', // lone low + trailing lone high
  'á́b', // stacked combining marks
  '👩‍👩‍👧‍👦x', // ZWJ family cluster
  '\r\n\r\r\n\n', // break soup
  '漢\uD83Dé\t👍\n\uDFFF', // mixed clusters + tab + breaks + lone low
];

test('hostile sweeps: every navigation function is total, in-range, and makes progress', () => {
  for (const text of HOSTILE) {
    const b = new GapBuffer(text);
    const len = b.length;
    for (let p = 0; p <= len; p++) {
      const results = [
        lineStart(b, p),
        lineEnd(b, p),
        nextChar(b, p),
        prevChar(b, p),
        nextLine(b, p),
        prevLine(b, p),
        nextWord(b, p),
        prevWord(b, p),
        charPtr(b, lineStart(b, p), charPos(b, lineStart(b, p), p)),
        lineMove(b, p, 1),
        lineMove(b, p, -1),
      ];
      for (const r of results) {
        expect(Number.isInteger(r)).toBe(true);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(len);
      }
      if (p < len) expect(nextChar(b, p)).toBeGreaterThan(p); // progress → caller loops terminate
      if (p > 0) expect(prevChar(b, p)).toBeLessThan(p);
    }
  }
});

test('cluster steps land only on cluster starts within a line (ZWJ + combining)', () => {
  const text = '👩‍👩‍👧‍👦áx';
  const b = new GapBuffer(text);
  let p = 0;
  while (p < b.length) {
    expect(isClusterStart(text, p)).toBe(true);
    p = nextChar(b, p);
  }
  expect(p).toBe(b.length);
});
