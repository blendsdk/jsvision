/**
 * Specification tests — SGR mouse-modifier decoding (datagrid RD-05, AR #16;
 * plan doc plans/sorting/07-testing-strategy ST-1/ST-2).
 *
 * Immutable oracle: expectations derive from the sorting plan's Phase-1
 * prerequisite — a held Ctrl during a mouse-down must surface as `ctrl: true`
 * so datagrid's Ctrl+click multi-sort can distinguish it from a plain click.
 * Never derived from reading the implementation.
 *
 * The SGR button byte OR-encodes the modifier bits already parsed for wheels:
 * Shift 0x04, Meta/Alt 0x08, Ctrl 0x10. A left button-down is byte 0; Ctrl-held
 * left button-down is byte 16 (0 | 0x10).
 */
import { test, expect } from 'vitest';

import { createDecoderState, decode } from '../src/engine/input/decoder.js';
import type { MouseEvent } from '../src/engine/input/events.js';

const enc = new TextEncoder();

/** Decode `bytes` against a fresh state and return the single mouse event. */
function oneMouse(bytes: string): MouseEvent {
  const r = decode(enc.encode(bytes), createDecoderState());
  expect(r.events.length).toBe(1);
  const e = r.events[0];
  expect(e.type).toBe('mouse');
  return e as MouseEvent;
}

// ---------------------------------------------------------------------------
// ST-1 — a Ctrl-held mouse-down decodes with ctrl === true
// ---------------------------------------------------------------------------

test('ST-1: SGR mouse-down with the Ctrl bit set → ctrl === true', () => {
  const e = oneMouse('\x1b[<16;5;5M');
  expect(e.kind).toBe('down');
  expect(e.button).toBe(0);
  expect(e.ctrl).toBe(true);
});

// ---------------------------------------------------------------------------
// ST-2 — a plain mouse-down leaves all modifier flags falsy
// ---------------------------------------------------------------------------

test('ST-2: plain SGR mouse-down (no modifier bits) → ctrl/alt/shift falsy', () => {
  const e = oneMouse('\x1b[<0;5;5M');
  expect(e.kind).toBe('down');
  expect(e.ctrl).toBeFalsy();
  expect(e.alt).toBeFalsy();
  expect(e.shift).toBeFalsy();
});
