/**
 * Specification tests — classic keyboard decoding (RD-06, AC-1).
 *
 * Immutable oracle: expectations derive from RD-06's acceptance criterion AC-1
 * and the keyboard grammar in plan doc 03-02 / 07-testing-strategy ST-1 — never
 * from reading the implementation. If a test here fails after implementation,
 * the implementation is wrong, not the test.
 *
 * All inputs are byte literals so no terminal is required.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createDecoderState, decode } from '../src/engine/input/decoder.js';
import type { KeyEvent } from '../src/engine/input/events.js';

const enc = new TextEncoder();

/** Decode `bytes` against a fresh state and return the single decoded event. */
function decodeOne(bytes: Uint8Array): KeyEvent {
  const result = decode(bytes, createDecoderState());
  assert.equal(result.events.length, 1, 'expected exactly one event');
  assert.equal(result.queries.length, 0, 'expected no query responses');
  assert.equal(result.rest.length, 0, 'expected no carried bytes');
  const event = result.events[0];
  assert.equal(event.type, 'key', 'expected a KeyEvent');
  return event as KeyEvent;
}

// ---------------------------------------------------------------------------
// ST-1 — classic keyboard map (AC-1): each input → exactly one KeyEvent
// ---------------------------------------------------------------------------

test('ST-1: CSI cursor up (ESC [ A) → up', () => {
  const k = decodeOne(enc.encode('\x1b[A'));
  assert.equal(k.key, 'up');
  assert.equal(k.ctrl, false);
  assert.equal(k.alt, false);
  assert.equal(k.shift, false);
});

test('ST-1: SS3 cursor up (ESC O A) → up', () => {
  const k = decodeOne(enc.encode('\x1bOA'));
  assert.equal(k.key, 'up');
});

test('ST-1: modified cursor (ESC [ 1 ; 5 C) → right + ctrl', () => {
  const k = decodeOne(enc.encode('\x1b[1;5C'));
  assert.equal(k.key, 'right');
  assert.equal(k.ctrl, true);
  assert.equal(k.alt, false);
  assert.equal(k.shift, false);
});

test('ST-1: function key (ESC [ 1 5 ~) → f5', () => {
  const k = decodeOne(enc.encode('\x1b[15~'));
  assert.equal(k.key, 'f5');
});

test('ST-1: alt-prefixed printable (ESC x) → x + alt', () => {
  const k = decodeOne(enc.encode('\x1bx'));
  assert.equal(k.key, 'x');
  assert.equal(k.alt, true);
  assert.equal(k.ctrl, false);
});

test('ST-1: carriage return (\\r) → enter', () => {
  const k = decodeOne(Uint8Array.from([0x0d]));
  assert.equal(k.key, 'enter');
});

test('ST-1: DEL (0x7f) → backspace', () => {
  const k = decodeOne(Uint8Array.from([0x7f]));
  assert.equal(k.key, 'backspace');
});

test('ST-1: Ctrl-C (0x03) → c + ctrl', () => {
  const k = decodeOne(Uint8Array.from([0x03]));
  assert.equal(k.key, 'c');
  assert.equal(k.ctrl, true);
});
