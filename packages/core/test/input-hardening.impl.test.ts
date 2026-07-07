/**
 * Implementation tests — input decoder hardening (RD-13, HR-01).
 *
 * Edge/robustness coverage beyond the ST oracles: resync position after a hostile drop, a hostile
 * sequence embedded between valid keys, and chunk-split hostile sequences. Covers the
 * 03-01 "Testing Requirements → Impl tests" bullet (resync position after a drop).
 */
import { test, expect } from 'vitest';

import { createDecoderState, decode, flush } from '../src/engine/input/decoder.js';
import type { DecoderState, KeyEvent } from '../src/engine/input/events.js';

const enc = new TextEncoder();

/** Decode a one-shot byte array from a fresh state. */
function decodeOnce(bytes: readonly number[]): ReturnType<typeof decode> {
  return decode(Uint8Array.from(bytes), createDecoderState());
}

test('a hostile sequence drops, then a trailing ASCII key decodes (resync)', () => {
  // U+110000 (4 bytes) then 'a' (0x61): the four bytes drop, the 'a' surfaces.
  const r = decodeOnce([0xf4, 0x90, 0x80, 0x80, 0x61]);
  expect(r.events.length).toBe(1);
  expect((r.events[0] as KeyEvent).key).toBe('a');
  expect(r.rest.length).toBe(0);
});

test('a hostile sequence embedded between two valid keys leaves both keys intact', () => {
  // 'x', lone surrogate (U+D800), 'y': only 'x' and 'y' emit.
  const r = decodeOnce([0x78, 0xed, 0xa0, 0x80, 0x79]);
  const keys = r.events.filter((e): e is KeyEvent => e.type === 'key').map((e) => e.key);
  expect(keys).toEqual(['x', 'y']);
});

test('every hostile family resyncs to the following valid key', () => {
  const cases: ReadonlyArray<readonly number[]> = [
    [0xf4, 0x90, 0x80, 0x80], // out of range
    [0xed, 0xa0, 0x80], // lone surrogate
    [0xe0, 0x80, 0x80], // overlong 3-byte NUL
    [0xc0, 0x80], // overlong 2-byte NUL
  ];
  for (const hostile of cases) {
    const r = decodeOnce([...hostile, 0x7a]); // trailing 'z'
    const keys = r.events.filter((e): e is KeyEvent => e.type === 'key').map((e) => e.key);
    expect(keys).toEqual(['z']);
  }
});

test('a hostile sequence split across chunks stays total and emits nothing', () => {
  let state = createDecoderState();
  const r1 = decode(Uint8Array.of(0xf4, 0x90), state); // partial (incomplete 4-byte lead)
  expect(r1.events.length).toBe(0);
  state = r1.state;
  const r2 = decode(Uint8Array.of(0x80, 0x80), state); // completes the out-of-range point
  expect(r2.events.length).toBe(0);
  expect(r2.rest.length).toBe(0);
});

// HR-04 — a DCS reply split across THREE chunks still demuxes to a single query, zero keys.
test('a DCS reply split across three chunks yields one query and no keys', () => {
  const reply = enc.encode('\x1bP>|xterm(370)\x1b\\');
  const cuts = [3, 9]; // two interior split points → three chunks
  let state: DecoderState = createDecoderState();
  let keys = 0;
  let queries = 0;
  let start = 0;
  for (const cut of [...cuts, reply.length]) {
    const r = decode(reply.subarray(start, cut), state);
    keys += r.events.filter((e) => e.type === 'key').length;
    queries += r.queries.length;
    state = r.state;
    start = cut;
  }
  queries += flush(state).queries.length;
  expect(keys).toBe(0);
  expect(queries).toBe(1);
});

// HR-04 — an ordinary CSI key sequence following a DCS still decodes (DCS carry does not stick).
test('a complete DCS followed by an arrow key decodes the arrow', () => {
  const bytes = enc.encode('\x1bP>|v\x1b\\\x1b[A'); // XTVERSION then CSI A (up)
  const r = decode(bytes, createDecoderState());
  expect(r.queries.length).toBe(1);
  const keys = r.events.filter((e): e is KeyEvent => e.type === 'key');
  expect(keys.map((k) => k.key)).toEqual(['up']);
});

// ---------------------------------------------------------------------------
// Phase-5 impl edges: HR-16 Alt-prefix regressions (ESC ESC did not break ESC x)
// ---------------------------------------------------------------------------

// HR-16 regression: ESC + a printable is still Alt+<char> (the ESC-ESC branch is additive).
test('ESC x still decodes to Alt+x after the HR-16 change', () => {
  const r = decode(Uint8Array.from([0x1b, 0x78]), createDecoderState()); // ESC 'x'
  expect(r.events).toHaveLength(1);
  expect(r.events[0]).toMatchObject({ type: 'key', key: 'x', alt: true });
});

// HR-16: ESC ESC ESC — the first pair is Alt+Escape; the trailing lone ESC is held for flush.
test('ESC ESC ESC yields Alt+Escape plus a held trailing ESC', () => {
  const r = decode(Uint8Array.from([0x1b, 0x1b, 0x1b]), createDecoderState());
  expect(r.events).toHaveLength(1);
  expect(r.events[0]).toMatchObject({ type: 'key', key: 'escape', alt: true });
  const f = flush(r.state);
  expect(f.events).toEqual([{ type: 'key', key: 'escape', ctrl: false, alt: false, shift: false }]);
});

// ---------------------------------------------------------------------------
// #40 impl edges: the introducer flush is strictly flush-scoped (Alt+letter on timeout only)
// ---------------------------------------------------------------------------

// A complete `ESC O P` in one window is still F1 — the fix touches only the timed-out bare hold.
test('#40: an in-window ESC O P still decodes as F1 (not Alt+O)', () => {
  const r = decodeOnce([0x1b, 0x4f, 0x50]); // ESC O P — SS3 F1
  expect(r.events).toEqual([{ type: 'key', key: 'f1', ctrl: false, alt: false, shift: false }]);
  expect(r.rest.length).toBe(0);
});

// The accepted tradeoff: an F1 whose final byte lags past the flush surfaces Alt+O then a bare P.
test('#40: a >window-split ESC O … P flushes to Alt+O then a bare P (documented tradeoff)', () => {
  const held = decode(Uint8Array.from([0x1b, 0x4f]), createDecoderState()); // ESC O held
  expect(held.events).toHaveLength(0);
  const f = flush(held.state); // the 50 ms timer fires before P arrives
  expect(f.events).toEqual([{ type: 'key', key: 'O', ctrl: false, alt: true, shift: false, codepoint: 0x4f }]);
  const late = decode(Uint8Array.from([0x50]), f.state); // the late 'P' is its own key
  expect(late.events).toEqual([{ type: 'key', key: 'P', ctrl: false, alt: false, shift: false, codepoint: 0x50 }]);
});

// A longer held CSI (params in progress) is NOT reinterpreted — only the exact 2-byte introducer is.
test('#40: a held ESC [ 1 ; is a real in-progress CSI, not Alt+[ (length guard)', () => {
  const r = decode(Uint8Array.from([0x1b, 0x5b, 0x31, 0x3b]), createDecoderState()); // ESC [ 1 ;
  expect(r.events).toHaveLength(0); // held, waiting for the final byte
  const f = flush(r.state);
  // Not an Alt+[ accelerator: the flush falls through to the escape-prefixed path (no fused key).
  expect(f.events.some((e) => e.type === 'key' && e.key === '[' && e.alt)).toBe(false);
});
