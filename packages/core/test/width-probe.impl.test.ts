/**
 * Implementation tests — two-group ambiguous-width probe internals & edge cases.
 *
 * Covers behaviour beyond the ST oracle: the write sequence (both groups + both
 * DSR requests + a trailing cleanup), a pair of CPRs split across read chunks, the
 * untrusted-response byte cap spanning both replies, a throwing stream, the
 * digit-overflow guard, a single-group reply degrading to not-probed, and the
 * per-group probe-glyph constants.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { describe, expect, it } from 'vitest';

import type { TerminalQuery } from '../src/engine/capability/profile.js';
import {
  AMBIGUOUS_PROBE_GLYPHS,
  BOX_PROBE_GLYPHS,
  parseCursorPosition,
  probeAmbiguousWidth,
} from '../src/engine/host/width-probe.js';

function bytes(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'latin1'));
}

/** A fake query yielding a scripted sequence of read chunks, recording every write. */
function fakeQuery(chunks: Uint8Array[]): TerminalQuery & { readonly writes: string[] } {
  const writes: string[] = [];
  return {
    writes,
    write(data: string): void {
      writes.push(data);
    },
    read(): AsyncIterable<Uint8Array> {
      return {
        async *[Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
          for (const c of chunks) yield c;
        },
      };
    },
  };
}

describe('probeAmbiguousWidth internals (two groups)', () => {
  it('writes home+arrows+DSR then home+boxes+DSR, then erases the probe artifact', async () => {
    const q = fakeQuery([bytes('\x1b[1;9R\x1b[1;9R')]);
    await probeAmbiguousWidth(q, { timeoutMs: 50 });
    const all = q.writes.join('');
    expect(all).toContain(AMBIGUOUS_PROBE_GLYPHS); // group 1 probe glyphs
    expect(all).toContain(BOX_PROBE_GLYPHS); // group 2 probe glyphs
    // Two DSR cursor-position requests were issued (one per group).
    expect(all.split('\x1b[6n').length - 1).toBe(2);
    expect(all).toContain('\x1b[2K'); // erase-line cleanup
    // Cleanup must come AFTER both requests (measure first, then erase).
    expect(all.indexOf('\x1b[2K')).toBeGreaterThan(all.lastIndexOf('\x1b[6n'));
  });

  it('parses two CPRs arriving split across multiple read chunks', async () => {
    // arrows col 17 (advance 16 > 8 ⇒ wide), boxes col 9 (advance 8 ⇒ narrow).
    const q = fakeQuery([bytes('\x1b[1;1'), bytes('7R\x1b['), bytes('1;9R')]);
    const r = await probeAmbiguousWidth(q, { timeoutMs: 50 });
    expect(r.probed).toBe(true);
    expect(r.arrows.measuredWidth).toBe(16);
    expect(r.arrows.wide).toBe(true);
    expect(r.boxes.measuredWidth).toBe(8);
    expect(r.boxes.wide).toBe(false);
  });

  it('degrades to not-probed when only one group answers', async () => {
    const q = fakeQuery([bytes('\x1b[1;9R')]); // a single CPR — the second never arrives
    const r = await probeAmbiguousWidth(q, { timeoutMs: 30 });
    expect(r.probed).toBe(false);
    expect(r.arrows.measuredWidth).toBeNull();
    expect(r.boxes.measuredWidth).toBeNull();
  });

  it('gives up (not probed) when the reply floods past the byte cap without two CPRs', async () => {
    const q = fakeQuery([bytes('x'.repeat(300))]);
    const r = await probeAmbiguousWidth(q, { timeoutMs: 50 });
    expect(r.probed).toBe(false);
    expect(r.arrows.measuredWidth).toBeNull();
  });

  it('degrades to not-probed when write() throws', async () => {
    const throwing: TerminalQuery = {
      write(): void {
        throw new Error('stream closed');
      },
      read(): AsyncIterable<Uint8Array> {
        return { async *[Symbol.asyncIterator]() {} };
      },
    };
    const r = await probeAmbiguousWidth(throwing, { timeoutMs: 20 });
    expect(r.probed).toBe(false);
    expect(r.arrows.wide).toBe(false);
    expect(r.boxes.wide).toBe(false);
  });

  it('respects a per-group probe-string override for the expected width', async () => {
    const q = fakeQuery([bytes('\x1b[1;4R\x1b[1;4R')]); // advance 3 each
    const r = await probeAmbiguousWidth(q, { arrowGlyphs: '▲▼◄', boxGlyphs: '┌┐└', timeoutMs: 50 });
    expect(r.arrows.expectedWidth).toBe(3);
    expect(r.boxes.expectedWidth).toBe(3);
    expect(r.arrows.wide).toBe(false);
    expect(r.boxes.wide).toBe(false);
  });
});

describe('parseCursorPosition edge cases', () => {
  it('rejects an over-long numeric field (overflow guard)', () => {
    expect(parseCursorPosition(bytes('\x1b[1;1234567R'))).toBeNull(); // 7 digits > cap
  });

  it('parses the first CPR when several are present', () => {
    expect(parseCursorPosition(bytes('\x1b[2;5R\x1b[9;9R'))).toEqual({ row: 2, col: 5 });
  });
});

describe('probe-glyph constants', () => {
  it('AMBIGUOUS_PROBE_GLYPHS is the 8 arrow/geometric chrome glyphs (one code point each)', () => {
    expect([...AMBIGUOUS_PROBE_GLYPHS]).toHaveLength(8);
    expect(AMBIGUOUS_PROBE_GLYPHS).toBe('▲▼◄►•↑↕×');
  });

  it('BOX_PROBE_GLYPHS is the 8 box-drawing + shade glyphs (one code point each)', () => {
    expect([...BOX_PROBE_GLYPHS]).toHaveLength(8);
    expect(BOX_PROBE_GLYPHS).toBe('┌┐└┘─│▒█');
  });
});
