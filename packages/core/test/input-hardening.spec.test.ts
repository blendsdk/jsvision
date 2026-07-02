/**
 * Specification tests (immutable oracles) — input decoder hardening (RD-13).
 *
 * Source: jsvision-ui/RD-13 HR-01 + AC-1, plan docs 03-01-core-input-decoder.md and
 * 07-testing-strategy.md (ST-1.x, ST-1.x-fuzz). Expectations derive from the RD/AC — the
 * byte→event boundary must be **total**: no byte sequence throws, and a non-scalar or
 * ill-formed UTF-8 sequence surfaces as **zero** key events (dropped + resynced), never as a
 * printable key. Never derived from reading the implementation.
 *
 * Later hardening phases append their core-decoder oracles (ST-2.1, ST-5.b/h/i/j) to this file.
 */
import { test, expect } from 'vitest';

import { createDecoderState, decode, flush } from '../src/engine/input/decoder.js';
import type { DecoderState, InputEvent } from '../src/engine/input/events.js';

// ---------------------------------------------------------------------------
// ST-1.x — hostile UTF-8 totality (HR-01)
// ---------------------------------------------------------------------------

/** Hostile byte vectors: out-of-range, lone surrogate, and overlong encodings. */
const HOSTILE_UTF8: ReadonlyArray<readonly [string, readonly number[]]> = [
  ['out-of-range (U+110000)', [0xf4, 0x90, 0x80, 0x80]],
  ['lone surrogate (U+D800)', [0xed, 0xa0, 0x80]],
  ['overlong 3-byte NUL', [0xe0, 0x80, 0x80]],
  ['overlong 2-byte NUL', [0xc0, 0x80]],
];

test('ST-1.x: hostile UTF-8 never throws, emits zero events, and leaves no carry', () => {
  for (const [label, bytes] of HOSTILE_UTF8) {
    const state = createDecoderState();
    let result: ReturnType<typeof decode> | undefined;
    expect(() => {
      result = decode(Uint8Array.from(bytes), state);
    }, label).not.toThrow();

    // Zero key events: an ill-formed / non-scalar sequence is dropped, never a printable key.
    expect(result?.events.length, label).toBe(0);

    // flush() after the drop leaves no carry — the sequence was fully consumed & resynced.
    const flushed = flush(result?.state ?? state);
    expect(flushed.events.length, label).toBe(0);
    expect(flushed.state.carry.length, label).toBe(0);
  }
});

// ---------------------------------------------------------------------------
// ST-1.x-fuzz — every lead byte 0x80–0xFF × random tails (HR-01 / AC-1)
// ---------------------------------------------------------------------------

test('ST-1.x-fuzz: decode never throws; every emitted printable key is a Unicode scalar value', () => {
  const rng = mulberry32(0x0bad_c0de);

  for (let lead = 0x80; lead <= 0xff; lead += 1) {
    for (let iter = 0; iter < 64; iter += 1) {
      const tailLen = Math.floor(rng() * 4); // 0–3 trailing bytes
      const bytes = new Uint8Array(1 + tailLen);
      bytes[0] = lead;
      for (let k = 1; k <= tailLen; k += 1) {
        // Bias toward continuation bytes (0x80–0xBF) so assembled code points are reachable.
        bytes[k] = rng() < 0.75 ? 0x80 + Math.floor(rng() * 0x40) : Math.floor(rng() * 256);
      }

      const state: DecoderState = createDecoderState();
      let result: ReturnType<typeof decode> | undefined;
      expect(() => {
        result = decode(bytes, state);
      }).not.toThrow();

      assertScalarKeys(result?.events ?? []);

      // A trailing flush must also be total.
      const flushed = flush(result?.state ?? state);
      assertScalarKeys(flushed.events);
    }
  }
});

// ---------------------------------------------------------------------------
// ST-2.1 — DCS incomplete carry (HR-04): a split XTVERSION reply never leaks as keys
// ---------------------------------------------------------------------------

const enc = new TextEncoder();

test('ST-2.1: an XTVERSION DCS reply split at every interior offset yields one query, zero keys', () => {
  // `ESC P > | xterm(370) ESC \` — a DCS opened with ESC P, terminated by ST (ESC \).
  const reply = enc.encode('\x1bP>|xterm(370)\x1b\\');

  for (let k = 1; k < reply.length; k += 1) {
    const { keys, queries } = feedSplit(reply, k);
    expect(keys.length, `split at ${k}`).toBe(0); // no fragment leaked as a keystroke
    expect(queries.length, `split at ${k}`).toBe(1); // exactly one recognised response
    expect(queries[0]?.kind, `split at ${k}`).toBe('xtversion');
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Feed `bytes` as two chunks split at `k` (threading state), then flush; collect keys + queries. */
function feedSplit(
  bytes: Uint8Array,
  k: number,
): { keys: InputEvent[]; queries: ReturnType<typeof decode>['queries'] } {
  let state = createDecoderState();
  const keys: InputEvent[] = [];
  const queries: ReturnType<typeof decode>['queries'] = [];
  const collect = (r: ReturnType<typeof decode>): void => {
    for (const e of r.events) if (e.type === 'key') keys.push(e);
    for (const q of r.queries) queries.push(q);
  };
  const r1 = decode(bytes.subarray(0, k), state);
  collect(r1);
  state = r1.state;
  const r2 = decode(bytes.subarray(k), state);
  collect(r2);
  state = r2.state;
  collect(flush(state));
  return { keys, queries };
}

/** Assert every printable key event carries a Unicode scalar value (not a surrogate / out of range). */
function assertScalarKeys(events: readonly InputEvent[]): void {
  for (const event of events) {
    if (event.type !== 'key' || event.codepoint === undefined) continue;
    const cp = event.codepoint;
    expect(cp).toBeGreaterThanOrEqual(0);
    expect(cp).toBeLessThanOrEqual(0x10ffff);
    expect(cp >= 0xd800 && cp <= 0xdfff).toBe(false); // no lone surrogates
    // The emitted key string round-trips the scalar value.
    expect(event.key).toBe(String.fromCodePoint(cp));
  }
}

/** A deterministic 32-bit PRNG (mulberry32) — reproducible corpus, no Math.random seed drift. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
