/**
 * Specification tests — damage-diff serializer (RD-04, AC-1/AC-3/AC-6).
 *
 * Immutable oracle: expectations derive from RD-04's acceptance criteria and
 * ST-1, ST-2, ST-4, ST-9, ST-13 in plan doc 07-testing-strategy plus the PL-1
 * default-encoder format in 03-02 — never from reading the implementation. If a
 * test here fails after implementation, the implementation is wrong.
 *
 * Capabilities come from RD-02's `resolveCapabilities({ override })` with a
 * clean env so no real terminal is needed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { serialize } from '../src/engine/render/serialize.js';
import { ScreenBuffer } from '../src/engine/render/buffer.js';
import type { Style } from '../src/engine/render/types.js';
import { resolveCapabilities } from '../src/engine/capability/index.js';
import type { CapabilityProfile, DeepPartial } from '../src/engine/capability/index.js';

const DEFAULT_STYLE: Style = { fg: 'default', bg: 'default' };

/** Deterministic capability profile with the given fields overridden. */
function caps(override: DeepPartial<CapabilityProfile> = {}): CapabilityProfile {
  return resolveCapabilities({ env: {}, platform: 'linux', override }).profile;
}

/** A buffer pre-filled with spaces in the default style. */
function blank(w: number, h: number): ScreenBuffer {
  return new ScreenBuffer(w, h, { fg: 'default', bg: 'default' });
}

/** Count non-overlapping occurrences of `needle` in `haystack`. */
function count(haystack: string, needle: string): number {
  if (needle === '') return 0;
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n += 1;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

// ---------------------------------------------------------------------------
// ST-1 — one changed cell → bytes ∝ damage (AC-1)
// ---------------------------------------------------------------------------

test('ST-1: a single changed cell emits one cursor move, one glyph, < 32 bytes', () => {
  const previous = blank(80, 24);
  const current = blank(80, 24);
  current.set(5, 2, 'X', DEFAULT_STYLE); // col 5, row 2 (0-based)

  const out = serialize(current, previous, { caps: caps() });

  // 1-based cursor move to (row 3, col 6).
  assert.equal(count(out, '\x1b[3;6H'), 1, 'exactly one cursorTo(3,6)');
  assert.equal(count(out, 'H'), 1, 'no other cursor move appears');
  assert.equal(count(out, 'X'), 1, 'exactly one glyph emitted');
  assert.ok(out.length < 32, `payload must be < 32 bytes, got ${out.length}`);
});

// ---------------------------------------------------------------------------
// ST-2 — zero-cost unchanged frame (AC-6)
// ---------------------------------------------------------------------------

test('ST-2: two identical frames serialize to the empty string (sync on)', () => {
  const a = blank(80, 24);
  const b = blank(80, 24);
  assert.equal(serialize(a, b, { caps: caps({ sync2026: true }) }), '');
});

test('ST-2: two identical frames serialize to the empty string (sync off)', () => {
  const a = blank(80, 24);
  const b = blank(80, 24);
  assert.equal(serialize(a, b, { caps: caps({ sync2026: false }) }), '');
});

// ---------------------------------------------------------------------------
// ST-4 — synchronized output wrap (AC-3)
// ---------------------------------------------------------------------------

test('ST-4: sync2026=true wraps a non-empty frame with ?2026h … ?2026l', () => {
  const previous = blank(80, 24);
  const current = blank(80, 24);
  current.set(0, 0, 'Z', DEFAULT_STYLE);

  const out = serialize(current, previous, { caps: caps({ sync2026: true }) });
  assert.ok(out.startsWith('\x1b[?2026h'), 'frame begins with sync-begin');
  assert.ok(out.endsWith('\x1b[?2026l'), 'frame ends with sync-end');
});

test('ST-4: sync2026=false adds neither sync sequence', () => {
  const previous = blank(80, 24);
  const current = blank(80, 24);
  current.set(0, 0, 'Z', DEFAULT_STYLE);

  const out = serialize(current, previous, { caps: caps({ sync2026: false }) });
  assert.equal(count(out, '\x1b[?2026h'), 0);
  assert.equal(count(out, '\x1b[?2026l'), 0);
});

// ---------------------------------------------------------------------------
// ST-9 — style run-merge within damage (AC-1 detail, PL-1)
// ---------------------------------------------------------------------------

test('ST-9: three adjacent same-style changed cells emit one style SGR', () => {
  const previous = blank(10, 1);
  const current = blank(10, 1);
  const red: Style = { fg: '#ff0000', bg: 'default' };
  current.set(0, 0, 'a', red);
  current.set(1, 0, 'b', red);
  current.set(2, 0, 'c', red);

  const out = serialize(current, previous, { caps: caps({ colorDepth: 'truecolor' }) });
  // PL-1 default encoder emits 24-bit truecolor `38;2;r;g;b` for fg.
  assert.equal(count(out, '38;2;255;0;0'), 1, 'one fg SGR for the whole run');
});

test('ST-9: a style change mid-run breaks into two SGRs', () => {
  const previous = blank(10, 1);
  const current = blank(10, 1);
  const red: Style = { fg: '#ff0000', bg: 'default' };
  const green: Style = { fg: '#00ff00', bg: 'default' };
  current.set(0, 0, 'a', red);
  current.set(1, 0, 'b', red);
  current.set(2, 0, 'c', green);

  const out = serialize(current, previous, { caps: caps({ colorDepth: 'truecolor' }) });
  assert.equal(count(out, '38;2;255;0;0'), 1, 'red run SGR once');
  assert.equal(count(out, '38;2;0;255;0'), 1, 'green run SGR once');
});

// ---------------------------------------------------------------------------
// ST-13 — resize forces a full repaint (PL-13)
// ---------------------------------------------------------------------------

test('ST-13: a previous buffer of different dimensions forces a full paint', () => {
  const previous = blank(4, 3); // different width
  const current = new ScreenBuffer(5, 3, { fg: 'default', bg: 'default', char: 'Z' });

  const out = serialize(current, previous, { caps: caps() });
  assert.equal(count(out, 'Z'), 15, 'every cell of a 5×3 buffer is emitted');
});
