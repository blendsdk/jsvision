/**
 * Implementation tests — keyboard decoder internals (RD-06, Session 2.3).
 *
 * Edge/internal coverage of `keys.ts` + `decoder.ts`: every nav/F-key, SS3
 * f1–f4, the xterm modifier matrix, the Ctrl-letter range, and UTF-8 multibyte
 * decoding (including a code point split across a chunk boundary and invalid
 * UTF-8 dropped without a crash). Complements the ST-1/2/10 spec oracles.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createDecoderState, decode } from '../src/engine/input/decoder.js';
import type { KeyEvent } from '../src/engine/input/events.js';

const enc = new TextEncoder();

/** Decode `bytes` against a fresh state and return the single KeyEvent. */
function one(bytes: Uint8Array): KeyEvent {
  const r = decode(bytes, createDecoderState());
  assert.equal(r.events.length, 1, 'expected exactly one event');
  return r.events[0] as KeyEvent;
}

// ---------------------------------------------------------------------------
// Cursor / nav keys (CSI single-final)
// ---------------------------------------------------------------------------

test('keys: CSI cursor keys A/B/C/D → up/down/right/left', () => {
  assert.equal(one(enc.encode('\x1b[A')).key, 'up');
  assert.equal(one(enc.encode('\x1b[B')).key, 'down');
  assert.equal(one(enc.encode('\x1b[C')).key, 'right');
  assert.equal(one(enc.encode('\x1b[D')).key, 'left');
});

test('keys: CSI H/F → home/end', () => {
  assert.equal(one(enc.encode('\x1b[H')).key, 'home');
  assert.equal(one(enc.encode('\x1b[F')).key, 'end');
});

test('keys: CSI ~ edit keys 1–6 → home/insert/delete/end/pageup/pagedown', () => {
  assert.equal(one(enc.encode('\x1b[1~')).key, 'home');
  assert.equal(one(enc.encode('\x1b[2~')).key, 'insert');
  assert.equal(one(enc.encode('\x1b[3~')).key, 'delete');
  assert.equal(one(enc.encode('\x1b[4~')).key, 'end');
  assert.equal(one(enc.encode('\x1b[5~')).key, 'pageup');
  assert.equal(one(enc.encode('\x1b[6~')).key, 'pagedown');
});

// ---------------------------------------------------------------------------
// Function keys: CSI ~ encodings and SS3 f1–f4
// ---------------------------------------------------------------------------

test('keys: CSI ~ function keys 11–24 → f1–f12', () => {
  const pairs: [number, string][] = [
    [11, 'f1'],
    [12, 'f2'],
    [13, 'f3'],
    [14, 'f4'],
    [15, 'f5'],
    [17, 'f6'],
    [18, 'f7'],
    [19, 'f8'],
    [20, 'f9'],
    [21, 'f10'],
    [23, 'f11'],
    [24, 'f12'],
  ];
  for (const [n, name] of pairs) {
    assert.equal(one(enc.encode(`\x1b[${n}~`)).key, name, `CSI ${n}~`);
  }
});

test('keys: SS3 P/Q/R/S → f1–f4', () => {
  assert.equal(one(enc.encode('\x1bOP')).key, 'f1');
  assert.equal(one(enc.encode('\x1bOQ')).key, 'f2');
  assert.equal(one(enc.encode('\x1bOR')).key, 'f3');
  assert.equal(one(enc.encode('\x1bOS')).key, 'f4');
});

// ---------------------------------------------------------------------------
// Modifier matrix (xterm `1 + bitmask`)
// ---------------------------------------------------------------------------

test('keys: modifier matrix on a cursor key (CSI 1 ; <mod> C)', () => {
  const right2 = one(enc.encode('\x1b[1;2C')); // shift
  assert.deepEqual([right2.shift, right2.alt, right2.ctrl], [true, false, false]);

  const right3 = one(enc.encode('\x1b[1;3C')); // alt
  assert.deepEqual([right3.shift, right3.alt, right3.ctrl], [false, true, false]);

  const right5 = one(enc.encode('\x1b[1;5C')); // ctrl
  assert.deepEqual([right5.shift, right5.alt, right5.ctrl], [false, false, true]);

  const right6 = one(enc.encode('\x1b[1;6C')); // ctrl+shift
  assert.deepEqual([right6.shift, right6.alt, right6.ctrl], [true, false, true]);

  const right7 = one(enc.encode('\x1b[1;7C')); // alt+ctrl
  assert.deepEqual([right7.shift, right7.alt, right7.ctrl], [false, true, true]);
});

test('keys: meta bit (mod 9) folds into alt', () => {
  const right9 = one(enc.encode('\x1b[1;9C'));
  assert.equal(right9.alt, true);
});

test('keys: modifier on a ~ key (CSI 3 ; 5 ~) → ctrl+delete', () => {
  const del = one(enc.encode('\x1b[3;5~'));
  assert.equal(del.key, 'delete');
  assert.equal(del.ctrl, true);
});

// ---------------------------------------------------------------------------
// Ctrl-letter range and the named-control exclusions
// ---------------------------------------------------------------------------

test('keys: Ctrl-letter range 0x01–0x1a → a–z with ctrl', () => {
  const a = one(Uint8Array.from([0x01]));
  assert.equal(a.key, 'a');
  assert.equal(a.ctrl, true);
  const z = one(Uint8Array.from([0x1a]));
  assert.equal(z.key, 'z');
  assert.equal(z.ctrl, true);
});

test('keys: named controls are not Ctrl-letters (tab/enter/backspace)', () => {
  assert.equal(one(Uint8Array.from([0x09])).key, 'tab');
  assert.equal(one(Uint8Array.from([0x0a])).key, 'enter');
  assert.equal(one(Uint8Array.from([0x08])).key, 'backspace');
  assert.equal(one(Uint8Array.from([0x20])).key, 'space');
});

// ---------------------------------------------------------------------------
// UTF-8 multibyte printables
// ---------------------------------------------------------------------------

test('keys: 2-/3-/4-byte UTF-8 decode to one code point each', () => {
  const e = one(enc.encode('é'));
  assert.equal(e.key, 'é');
  assert.equal(e.codepoint, 0x00e9);

  const euro = one(enc.encode('€'));
  assert.equal(euro.key, '€');
  assert.equal(euro.codepoint, 0x20ac);

  const grin = one(enc.encode('😀'));
  assert.equal(grin.key, '😀');
  assert.equal(grin.codepoint, 0x1f600);
});

test('keys: a multibyte char split across chunks is carried then completed', () => {
  const bytes = enc.encode('€'); // 3 bytes: E2 82 AC
  const s0 = createDecoderState();

  const r1 = decode(bytes.subarray(0, 2), s0); // first 2 bytes only
  assert.equal(r1.events.length, 0, 'incomplete code point emits nothing');
  assert.ok(r1.rest.length > 0, 'partial bytes carried');

  const r2 = decode(bytes.subarray(2), r1.state); // final byte
  assert.equal(r2.events.length, 1);
  assert.equal((r2.events[0] as KeyEvent).codepoint, 0x20ac);
  assert.equal(r2.rest.length, 0);
});

test('keys: invalid UTF-8 bytes are dropped without crashing', () => {
  // A lone continuation byte and an out-of-range lead byte: no events, no throw.
  const r = decode(Uint8Array.from([0x80, 0xff]), createDecoderState());
  assert.equal(r.events.length, 0);
  assert.equal(r.rest.length, 0);
});
