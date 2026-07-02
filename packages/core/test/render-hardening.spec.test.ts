/**
 * Specification tests (immutable oracles) — render/output hardening (RD-13).
 *
 * Source: jsvision-ui/RD-13 HR-05 + PA-5, plan docs 03-02-core-render-output.md and
 * 07-testing-strategy.md (ST-2.2). The grid boundary must never store a raw C0 control: `\t`/`\n`/DEL
 * become a single space cell so caller column math is preserved and the serialized stream is
 * control-free. Expectations derive from the RD/PA, never from reading the implementation.
 *
 * Later hardening phases append ST-5.c–g,k to this file.
 */
import { test, expect } from 'vitest';

import { serialize } from '../src/engine/render/serialize.js';
import { ScreenBuffer } from '../src/engine/render/buffer.js';
import type { Style } from '../src/engine/render/types.js';
import { resolveCapabilities } from '../src/engine/capability/index.js';
import { charWidth } from '../src/engine/render/width.js';
import { setClipboard } from '../src/engine/render/osc.js';

const STYLE: Style = { fg: 'default', bg: 'default' };
const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

/** The glyphs of row `y`, columns `[0, n)`, joined. */
function rowChars(buf: ScreenBuffer, y: number, n: number): string {
  let out = '';
  for (let x = 0; x < n; x += 1) out += buf.get(x, y)?.char ?? '';
  return out;
}

// ST-2.2 — C0 controls become one space cell each; serialized output carries no raw \t/\n.
test('ST-2.2: a tab in a grid write stores one space cell and serializes control-free', () => {
  const buf = new ScreenBuffer(8, 1, STYLE);
  buf.text(0, 0, 'a\tb', STYLE);

  // One input char = one cell; the tab is a space, positions match "a b".
  expect(rowChars(buf, 0, 3)).toBe('a b');

  const out = serialize(buf, null, { caps });
  expect(out.includes('\t')).toBe(false); // no raw tab leaked to the stream
  expect(out.includes('\n')).toBe(false); // no raw newline either
});

test('ST-2.2: a newline in a grid write stores one space cell (no row break)', () => {
  const buf = new ScreenBuffer(8, 1, STYLE);
  buf.text(0, 0, 'a\nb', STYLE);
  expect(rowChars(buf, 0, 3)).toBe('a b');
  const out = serialize(buf, null, { caps });
  expect(out.includes('\n')).toBe(false);
});

test('ST-2.2: a lone tab stores a single space cell', () => {
  const buf = new ScreenBuffer(4, 1, STYLE);
  const endCol = buf.text(0, 0, '\t', STYLE);
  expect(buf.get(0, 0)?.char).toBe(' ');
  expect(endCol).toBe(1); // advanced exactly one column (column math preserved)
});

test('ST-2.2: a C0 control written via set() becomes a space cell', () => {
  const buf = new ScreenBuffer(4, 1, STYLE);
  buf.set(0, 0, '\x07', STYLE); // BEL
  expect(buf.get(0, 0)?.char).toBe(' ');
  expect(buf.get(0, 0)?.width).toBe(1);
});

// ---------------------------------------------------------------------------
// ST-5.c–g,k — render/output minors (HR-17/18/19/20/21/25)
// ---------------------------------------------------------------------------

const capsUtf8 = resolveCapabilities({ env: {}, platform: 'linux', override: { unicode: { utf8: true } } }).profile;
const capsNoUtf8 = resolveCapabilities({ env: {}, platform: 'linux', override: { unicode: { utf8: false } } }).profile;

// ST-5.c — a combining mark composes onto the preceding base cell (HR-17).
test('ST-5.c: a combining mark composes onto the base cell', () => {
  const buf = new ScreenBuffer(4, 1, STYLE);
  buf.text(0, 0, 'éx', STYLE); // e + U+0301 (combining acute) + x
  expect(buf.get(0, 0)?.char).toBe('é'); // one cell carries the composed cluster
  expect(buf.get(0, 0)?.width).toBe(1); // width unchanged by the mark
  expect(buf.get(1, 0)?.char).toBe('x'); // next base glyph in the next cell
});

// ST-5.c — a combining mark at row start (nothing to compose onto) is dropped (HR-17).
test('ST-5.c: a leading combining mark with no base is dropped', () => {
  const buf = new ScreenBuffer(4, 1, STYLE);
  buf.text(0, 0, '́a', STYLE); // mark first — nothing precedes it
  expect(buf.get(0, 0)?.char).toBe('a'); // the base glyph takes column 0; the mark is gone
});

// ST-5.d — a wide glyph under unicode.utf8:false falls back to two cells '? ' (HR-18/PA-11).
test('ST-5.d: a wide-glyph fallback keeps two columns as "? "', () => {
  const buf = new ScreenBuffer(4, 1, STYLE);
  buf.set(0, 0, '世', STYLE); // width-2 lead + width-0 continuation
  const out = serialize(buf, null, { caps: capsNoUtf8 });
  expect(out).toContain('? '); // lead '?' + space pad — the 2-column footprint holds
  expect(out).not.toContain('世'); // the wide glyph itself was not emitted
});

// ST-5.e — charWidth is 2 for EAW W/F samples the old table missed (HR-19/PA-18).
test('ST-5.e: EAW wide/fullwidth samples all measure width 2', () => {
  const WIDE_SAMPLES = [
    0x2b50, 0x231a, 0x231b, 0x23e9, 0x23f3, 0x2705, 0x2728, 0x274c, 0x1f004, 0x1f200, 0x17000, 0x1f600,
  ];
  for (const cp of WIDE_SAMPLES) {
    expect(charWidth(cp, 'wcwidth')).toBe(2);
  }
});

// ST-5.f — recoloring only a wide glyph's continuation re-emits the lead glyph, not an empty run (HR-20/PA-14).
test('ST-5.f: a continuation-only recolor re-emits the lead glyph', () => {
  const prev = new ScreenBuffer(4, 1, STYLE);
  prev.set(0, 0, '世', STYLE);
  const cur = prev.clone();
  const cont = cur.get(1, 0); // the width-0 continuation cell
  expect(cont).toBeDefined();
  if (cont) cont.bg = 'red'; // recolor ONLY the continuation
  const out = serialize(cur, prev, { caps: capsUtf8 });
  expect(out.length).toBeGreaterThan(0); // damage produced output (not an empty styled run)
  expect(out).toContain('世'); // the lead glyph was re-emitted with the new style
});

// ST-5.g — the clipboard payload is byte-exact (no pre-encode sanitize) (HR-21/PA-7).
test('ST-5.g: setClipboard encodes the exact input bytes', () => {
  const capsClip = resolveCapabilities({
    env: {},
    platform: 'linux',
    override: { osc: { clipboard52: true } },
  }).profile;
  for (const payload of ['line1\r\nline2', 'a\x01b\x7fc', 'plain']) {
    const seq = setClipboard(payload, capsClip);
    const b64 = seq.slice(seq.indexOf(';c;') + 3, seq.length - 1); // between ';c;' and the trailing BEL
    expect(Buffer.from(b64, 'base64').toString('utf8')).toBe(payload); // exact round-trip
  }
});

// ST-5.k — box() centers a CJK title by display width and clips it to the interior (HR-25).
test('ST-5.k: a CJK box title is centered by display width', () => {
  const buf = new ScreenBuffer(12, 3, STYLE);
  buf.box(0, 0, 12, 3, STYLE, 'single', '世界'); // label " 世界 " → display width 6, interior 10 → tx=3
  expect(buf.get(4, 0)?.char).toBe('世'); // 世 lands at col 4 (space at 3)
  expect(buf.get(6, 0)?.char).toBe('界'); // 界 at col 6
  expect(buf.get(11, 0)?.char).toBe('┐'); // the top-right corner is intact (no overflow)
});

// ST-5.k — an over-long CJK title clips to the box interior without overflowing the border (HR-25).
test('ST-5.k: an over-long CJK title clips to the box interior', () => {
  const buf = new ScreenBuffer(8, 3, STYLE);
  buf.box(0, 0, 8, 3, STYLE, 'single', '世界世界世界'); // far wider than the 6-col interior
  expect(buf.get(7, 0)?.char).toBe('┐'); // right corner never overwritten by the title
});
