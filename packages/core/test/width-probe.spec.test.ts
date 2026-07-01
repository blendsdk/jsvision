/**
 * Specification tests — ambiguous-width startup probe & warning.
 *
 * Traceability: the RD-11 follow-up "detect double-width chrome glyphs and warn"
 * (this conversation's design). These oracles derive from the documented contract
 * of `src/engine/host/width-probe.ts`, NOT from its implementation:
 *
 *   • `parseCursorPosition(bytes)` parses the first well-formed CPR
 *     `ESC [ <row> ; <col> R` (1-based) out of a byte buffer, ignoring
 *     surrounding noise; returns `null` when none is present.
 *   • `probeAmbiguousWidth(query)` homes the cursor to column 1, prints the probe
 *     glyphs, and requests a CPR. Given a reply reporting column `C`, the measured
 *     advance is `C - 1`; `ambiguousWide` iff the advance exceeds the probe's
 *     code-point count. A silent terminal ⇒ `probed:false`, `measuredWidth:null`.
 *   • `warnIfAmbiguousWide(query, { warn })` calls `warn` exactly once with a
 *     non-empty message iff the probe found wide glyphs; never otherwise.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { describe, expect, it } from 'vitest';

import type { TerminalQuery } from '../src/engine/capability/profile.js';
import { parseCursorPosition, probeAmbiguousWidth, warnIfAmbiguousWide } from '../src/engine/host/width-probe.js';

/** Encode an ASCII/escape string to bytes (latin1 — the transport encoding). */
function bytes(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'latin1'));
}

/** A CPR reply reporting `row;col`. */
function cpr(row: number, col: number): Uint8Array {
  return bytes(`\x1b[${row};${col}R`);
}

/**
 * A fake {@link TerminalQuery} that records writes and yields a scripted reply
 * (or nothing, modelling a silent terminal) on `read()`, then ends.
 */
function fakeQuery(reply: Uint8Array | null): TerminalQuery & { readonly writes: string[] } {
  const writes: string[] = [];
  return {
    writes,
    write(data: string): void {
      writes.push(data);
    },
    read(): AsyncIterable<Uint8Array> {
      return {
        async *[Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
          if (reply) yield reply;
        },
      };
    },
  };
}

describe('parseCursorPosition (CPR grammar)', () => {
  it('parses a well-formed CPR into 1-based row/col', () => {
    expect(parseCursorPosition(cpr(12, 34))).toEqual({ row: 12, col: 34 });
  });

  it('finds the CPR embedded in surrounding noise', () => {
    const buf = bytes(`abc\x1b[3;9Rxyz`);
    expect(parseCursorPosition(buf)).toEqual({ row: 3, col: 9 });
  });

  it('returns null for a partial or malformed sequence', () => {
    expect(parseCursorPosition(bytes('\x1b[12;'))).toBeNull(); // truncated
    expect(parseCursorPosition(bytes('\x1b[12;34'))).toBeNull(); // no terminator
    expect(parseCursorPosition(bytes('hello world'))).toBeNull();
    expect(parseCursorPosition(new Uint8Array(0))).toBeNull();
  });
});

describe('probeAmbiguousWidth', () => {
  const NARROW = '▲▼◄'; // 3 probe glyphs

  it('reports NOT wide when each glyph advances one column', async () => {
    // Homed to col 1, 3 narrow glyphs ⇒ cursor at col 4.
    const r = await probeAmbiguousWidth(fakeQuery(cpr(1, 4)), { glyphs: NARROW, timeoutMs: 50 });
    expect(r.probed).toBe(true);
    expect(r.expectedWidth).toBe(3);
    expect(r.measuredWidth).toBe(3);
    expect(r.ambiguousWide).toBe(false);
  });

  it('reports wide when the glyphs advance two columns each', async () => {
    // 3 double-width glyphs ⇒ cursor at col 7 (advance 6).
    const r = await probeAmbiguousWidth(fakeQuery(cpr(1, 7)), { glyphs: NARROW, timeoutMs: 50 });
    expect(r.probed).toBe(true);
    expect(r.measuredWidth).toBe(6);
    expect(r.ambiguousWide).toBe(true);
  });

  it('reports not-probed when the terminal is silent (no CPR)', async () => {
    const r = await probeAmbiguousWidth(fakeQuery(null), { glyphs: NARROW, timeoutMs: 30 });
    expect(r.probed).toBe(false);
    expect(r.measuredWidth).toBeNull();
    expect(r.ambiguousWide).toBe(false);
  });
});

describe('warnIfAmbiguousWide', () => {
  const G = '▲▼◄';

  it('warns exactly once with a non-empty message when glyphs are wide', async () => {
    const msgs: string[] = [];
    const r = await warnIfAmbiguousWide(fakeQuery(cpr(1, 7)), {
      glyphs: G,
      timeoutMs: 50,
      warn: (m) => msgs.push(m),
    });
    expect(r.ambiguousWide).toBe(true);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatch(/width/i);
    expect(msgs[0].length).toBeGreaterThan(0);
  });

  it('does not warn when glyphs render narrow', async () => {
    const msgs: string[] = [];
    await warnIfAmbiguousWide(fakeQuery(cpr(1, 4)), { glyphs: G, timeoutMs: 50, warn: (m) => msgs.push(m) });
    expect(msgs).toHaveLength(0);
  });

  it('does not warn when the terminal is silent', async () => {
    const msgs: string[] = [];
    await warnIfAmbiguousWide(fakeQuery(null), { glyphs: G, timeoutMs: 30, warn: (m) => msgs.push(m) });
    expect(msgs).toHaveLength(0);
  });
});
