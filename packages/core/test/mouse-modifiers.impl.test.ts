/**
 * Implementation tests — SGR mouse-modifier decoding edges.
 *
 * Complements mouse-modifiers.spec.test.ts (ST-1/ST-2) by covering the other
 * modifier bits (Alt 0x08, Shift 0x04) and confirming the flags ride every
 * button `kind` (down/up/drag/move), not just a plain press.
 */
import { test, expect } from 'vitest';

import { createDecoderState, decode } from '../src/engine/input/decoder.js';
import type { MouseEvent } from '../src/engine/input/events.js';

const enc = new TextEncoder();

function oneMouse(bytes: string): MouseEvent {
  const r = decode(enc.encode(bytes), createDecoderState());
  expect(r.events.length).toBe(1);
  const e = r.events[0];
  expect(e.type).toBe('mouse');
  return e as MouseEvent;
}

test('Alt bit (0x08) alone → alt true, ctrl/shift falsy', () => {
  const e = oneMouse('\x1b[<8;5;5M');
  expect(e.kind).toBe('down');
  expect(e.alt).toBe(true);
  expect(e.ctrl).toBeFalsy();
  expect(e.shift).toBeFalsy();
});

test('Shift bit (0x04) alone → shift true, ctrl/alt falsy', () => {
  const e = oneMouse('\x1b[<4;5;5M');
  expect(e.shift).toBe(true);
  expect(e.ctrl).toBeFalsy();
  expect(e.alt).toBeFalsy();
});

test('all three modifier bits (0x1c) → ctrl+alt+shift all true', () => {
  const e = oneMouse('\x1b[<28;5;5M');
  expect(e.ctrl).toBe(true);
  expect(e.alt).toBe(true);
  expect(e.shift).toBe(true);
});

test('a release (m-final) carries the held modifiers', () => {
  const e = oneMouse('\x1b[<16;5;5m');
  expect(e.kind).toBe('up');
  expect(e.ctrl).toBe(true);
});

test('a drag (motion bit + held button) carries the held modifiers', () => {
  const e = oneMouse('\x1b[<48;5;5M'); // 0x20 motion | button 0 | 0x10 ctrl
  expect(e.kind).toBe('drag');
  expect(e.ctrl).toBe(true);
});

test('a bare move (motion bit, no button) carries the held modifiers', () => {
  const e = oneMouse('\x1b[<51;5;5M'); // 0x20 motion | 0x03 no-button | 0x10 ctrl
  expect(e.kind).toBe('move');
  expect(e.ctrl).toBe(true);
});
