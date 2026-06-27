/**
 * Specification tests — decoder core: chunk-boundary safety & ESC flush (RD-06).
 *
 * Immutable oracle: expectations derive from RD-06's acceptance criterion AC-2
 * (chunk-boundary safety) and plan decision PL-3 (pure decoder + host-driven
 * flush for ESC disambiguation), per 07-testing-strategy ST-2 and ST-10 — never
 * from reading the implementation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createDecoderState, decode, flush } from '../src/engine/input/decoder.js';
import type { DecoderState, KeyEvent } from '../src/engine/input/events.js';

const enc = new TextEncoder();

/** Carry a decode result's `rest` forward into the next state. */
function carry(state: DecoderState, rest: Uint8Array): DecoderState {
  return { ...state, carry: rest };
}

// ---------------------------------------------------------------------------
// ST-2 — chunk-boundary safety (AC-2)
// ---------------------------------------------------------------------------

test('ST-2: a CSI split across two chunks decodes once, no partial events', () => {
  const s0 = createDecoderState();

  // First chunk ends mid-sequence: nothing emitted, the bytes are carried.
  const r1 = decode(enc.encode('\x1b[1'), s0);
  assert.equal(r1.events.length, 0, 'no event from an incomplete sequence');
  assert.equal(r1.queries.length, 0);
  assert.ok(r1.rest.length > 0, 'incomplete bytes are carried in rest');

  // Second chunk completes it: exactly one event, nothing left over.
  const r2 = decode(enc.encode(';5C'), carry(s0, r1.rest));
  assert.equal(r2.events.length, 1, 'exactly one event after completion');
  const k = r2.events[0] as KeyEvent;
  assert.equal(k.type, 'key');
  assert.equal(k.key, 'right');
  assert.equal(k.ctrl, true);
  assert.equal(r2.rest.length, 0, 'no bytes left after completion');
});

// ---------------------------------------------------------------------------
// ST-10 — ESC disambiguation via flush (PL-3)
// ---------------------------------------------------------------------------

test('ST-10: a lone ESC is carried, then flush() emits escape', () => {
  const s0 = createDecoderState();

  const r1 = decode(Uint8Array.from([0x1b]), s0);
  assert.equal(r1.events.length, 0, 'a lone ESC emits nothing (ambiguous)');
  assert.equal(r1.rest.length, 1, 'the ESC is held in rest');

  const flushed = flush(carry(s0, r1.rest));
  assert.equal(flushed.events.length, 1, 'flush emits exactly one event');
  const k = flushed.events[0] as KeyEvent;
  assert.equal(k.type, 'key');
  assert.equal(k.key, 'escape');
  assert.equal(flushed.rest.length, 0, 'flush clears the carry');
});

test('ST-10: a byte arriving after ESC continues the sequence, not escape', () => {
  const s0 = createDecoderState();

  const r1 = decode(Uint8Array.from([0x1b]), s0);
  assert.equal(r1.events.length, 0);

  // The next byte completes a CSI introducer rather than producing Escape.
  const r2 = decode(enc.encode('[A'), carry(s0, r1.rest));
  assert.equal(r2.events.length, 1);
  const k = r2.events[0] as KeyEvent;
  assert.equal(k.key, 'up', 'ESC + [A is cursor-up, never escape');
});
