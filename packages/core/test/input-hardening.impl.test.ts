/**
 * Implementation tests — input decoder hardening (RD-13, HR-01).
 *
 * Edge/robustness coverage beyond the ST oracles: resync position after a hostile drop, a hostile
 * sequence embedded between valid keys, and chunk-split hostile sequences. Covers the
 * 03-01 "Testing Requirements → Impl tests" bullet (resync position after a drop).
 */
import { test, expect } from 'vitest';

import { createDecoderState, decode } from '../src/engine/input/decoder.js';
import type { KeyEvent } from '../src/engine/input/events.js';

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
