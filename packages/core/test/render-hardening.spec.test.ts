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
