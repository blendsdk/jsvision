/**
 * Implementation tests — ambiguous-width probe internals & edge cases.
 *
 * Covers behaviour beyond the spec oracle: the probe/cleanup write sequence, a
 * CPR split across read chunks, the untrusted-response byte cap, a throwing
 * stream, the digit-overflow guard, and the default probe-glyph set.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { describe, expect, it } from 'vitest';

import type { TerminalQuery } from '../src/engine/capability/profile.js';
import { AMBIGUOUS_PROBE_GLYPHS, parseCursorPosition, probeAmbiguousWidth } from '../src/engine/host/width-probe.js';

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

describe('probeAmbiguousWidth internals', () => {
  it('writes the home + glyphs + DSR request, then erases the probe artifact', async () => {
    const q = fakeQuery([bytes('\x1b[1;4R')]);
    await probeAmbiguousWidth(q, { glyphs: '▲▼◄', timeoutMs: 50 });
    const all = q.writes.join('');
    expect(all).toContain('\r'); // homed to column 1
    expect(all).toContain('▲▼◄'); // the probe glyphs
    expect(all).toContain('\x1b[6n'); // DSR cursor-position request
    expect(all).toContain('\x1b[2K'); // erase-line cleanup
    // Cleanup must come AFTER the request (measure first, then erase).
    expect(all.indexOf('\x1b[2K')).toBeGreaterThan(all.indexOf('\x1b[6n'));
  });

  it('parses a CPR that arrives split across multiple read chunks', async () => {
    const q = fakeQuery([bytes('\x1b[1'), bytes(';'), bytes('7R')]);
    const r = await probeAmbiguousWidth(q, { glyphs: '▲▼◄', timeoutMs: 50 });
    expect(r.probed).toBe(true);
    expect(r.measuredWidth).toBe(6);
    expect(r.ambiguousWide).toBe(true);
  });

  it('gives up (not probed) when the reply floods past the byte cap without a CPR', async () => {
    const q = fakeQuery([bytes('x'.repeat(300))]);
    const r = await probeAmbiguousWidth(q, { glyphs: '▲▼◄', timeoutMs: 50 });
    expect(r.probed).toBe(false);
    expect(r.measuredWidth).toBeNull();
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
    expect(r.ambiguousWide).toBe(false);
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

describe('AMBIGUOUS_PROBE_GLYPHS', () => {
  it('is the seven ambiguous chrome glyphs (one code point each)', () => {
    expect([...AMBIGUOUS_PROBE_GLYPHS]).toHaveLength(7);
    expect(AMBIGUOUS_PROBE_GLYPHS).toBe('▲▼◄►■▒▓');
  });
});
