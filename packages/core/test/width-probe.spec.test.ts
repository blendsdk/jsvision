/**
 * Specification tests — ambiguous-width startup probe & warning (TWO-GROUP contract).
 *
 * Traceability: the RD-11 follow-up "detect double-width chrome glyphs and warn",
 * evolved by the glyph-auto-swap feature into a **two-group** probe. These oracles
 * were updated from the original single-aggregate shape to the grouped contract
 * **with explicit user approval recorded in AR-16** (glyph-auto-swap
 * 00-ambiguity-register) — the immutable-oracle exception scoped to this API
 * amendment. Expectations derive from `03-01-core-glyph-swap.md` §3 and
 * `07-testing-strategy.md` ST-05…ST-07, NOT from the implementation:
 *
 *   • `parseCursorPosition(bytes)` parses the first well-formed CPR
 *     `ESC [ <row> ; <col> R` (1-based) out of a byte buffer, ignoring
 *     surrounding noise; returns `null` when none is present. (unchanged)
 *   • `probeAmbiguousWidth(query)` measures TWO groups in one pass — group 1 the
 *     arrow/geometric chrome set, group 2 a box-drawing + shade sample — each
 *     re-homed to column 1. Given group replies at columns `C1`/`C2`, each group's
 *     measured advance is `C - 1`; `wide` iff the advance exceeds that group's
 *     code-point count. `probed` iff BOTH groups answered. A silent terminal ⇒
 *     `probed:false`, both `measuredWidth:null`, both `wide:false`.
 *   • `warnIfAmbiguousWide(query, { warn, adapted })` calls `warn` exactly once
 *     iff a group is wide; the message is `WIDTH_ADAPTED_MESSAGE` when
 *     `adapted:true`, else `WIDTH_WARNING_MESSAGE`; never otherwise.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { describe, expect, it } from 'vitest';

import type { TerminalQuery } from '../src/engine/capability/profile.js';
import {
  parseCursorPosition,
  probeAmbiguousWidth,
  warnIfAmbiguousWide,
  WIDTH_ADAPTED_MESSAGE,
  WIDTH_WARNING_MESSAGE,
} from '../src/engine/host/width-probe.js';

/** Encode an ASCII/escape string to bytes (latin1 — the transport encoding). */
function bytes(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'latin1'));
}

/** A CPR reply reporting `row;col`. */
function cpr(row: number, col: number): Uint8Array {
  return bytes(`\x1b[${row};${col}R`);
}

/**
 * A fake {@link TerminalQuery} that records writes and yields a scripted sequence
 * of read chunks (the two-group probe reads both CPR replies from one stream).
 */
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

describe('probeAmbiguousWidth (two groups, AR-16)', () => {
  // ST-05 — arrows wide (col 17 ⇒ advance 16 > 8), boxes narrow (col 9 ⇒ advance 8).
  it('ST-05: reports arrows wide, boxes narrow from the two group replies', async () => {
    const r = await probeAmbiguousWidth(fakeQuery([cpr(1, 17), cpr(1, 9)]), { timeoutMs: 50 });
    expect(r.probed).toBe(true);
    expect(r.arrows).toEqual({ expectedWidth: 8, measuredWidth: 16, wide: true });
    expect(r.boxes).toEqual({ expectedWidth: 8, measuredWidth: 8, wide: false });
  });

  // ST-06 — boxes wide, arrows narrow (the reply order is per group).
  it('ST-06: reports boxes wide, arrows narrow when the group replies swap', async () => {
    const r = await probeAmbiguousWidth(fakeQuery([cpr(1, 9), cpr(1, 17)]), { timeoutMs: 50 });
    expect(r.probed).toBe(true);
    expect(r.arrows.wide).toBe(false);
    expect(r.boxes.wide).toBe(true);
  });

  // ST-07 — a silent terminal answers neither group.
  it('ST-07: reports not-probed with null measurements when the terminal is silent', async () => {
    const r = await probeAmbiguousWidth(fakeQuery([]), { timeoutMs: 30 });
    expect(r.probed).toBe(false);
    expect(r.arrows.measuredWidth).toBeNull();
    expect(r.boxes.measuredWidth).toBeNull();
    expect(r.arrows.wide).toBe(false);
    expect(r.boxes.wide).toBe(false);
  });
});

describe('warnIfAmbiguousWide (two groups + variant, AR-10/AR-16)', () => {
  it('warns once with the warn-only message when a group is wide (adapted unset)', async () => {
    const msgs: string[] = [];
    const r = await warnIfAmbiguousWide(fakeQuery([cpr(1, 17), cpr(1, 9)]), {
      timeoutMs: 50,
      warn: (m) => msgs.push(m),
    });
    expect(r.arrows.wide).toBe(true);
    expect(msgs).toStrictEqual([WIDTH_WARNING_MESSAGE]);
  });

  it('warns once with the adapted message when adapted:true', async () => {
    const msgs: string[] = [];
    await warnIfAmbiguousWide(fakeQuery([cpr(1, 9), cpr(1, 17)]), {
      timeoutMs: 50,
      adapted: true,
      warn: (m) => msgs.push(m),
    });
    expect(msgs).toStrictEqual([WIDTH_ADAPTED_MESSAGE]);
  });

  it('does not warn when both groups render narrow', async () => {
    const msgs: string[] = [];
    await warnIfAmbiguousWide(fakeQuery([cpr(1, 9), cpr(1, 9)]), { timeoutMs: 50, warn: (m) => msgs.push(m) });
    expect(msgs).toStrictEqual([]);
  });

  it('does not warn when the terminal is silent', async () => {
    const msgs: string[] = [];
    await warnIfAmbiguousWide(fakeQuery([]), { timeoutMs: 30, warn: (m) => msgs.push(m) });
    expect(msgs).toStrictEqual([]);
  });
});
