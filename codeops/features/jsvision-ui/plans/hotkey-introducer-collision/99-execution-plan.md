# Task T-03: Decode a flushed `ESC O` / `ESC [` as Alt+letter (fix #40 collision)

> **Type**: Task (lightweight) · **Feature**: jsvision-ui · **CodeOps Skills Version**: 3.3.0
> **Progress**: 6/6 tasks (100%) · **Last Updated**: 2026-07-07
> **Tracks**: GitHub issue [#40](https://github.com/blendsdk/jsvision/issues/40) (the one concrete correctness defect only)

## Objective

`Alt+Shift+O` (terminal bytes `ESC O` = `1b 4f`) and `Alt+[` (`ESC [` = `1b 5b`) are **swallowed**:
the introducer bytes enter `decodeSs3`/`decodeCsi` (`keys.ts:114,163`), stay `incomplete`, get held,
and on the 50 ms disambiguation flush (`decoder.ts:83`, armed by `host.ts:117` HR-24) the held `ESC`
becomes a bare `escape` + a bare letter — the Alt accelerator never fires (a `~O~pen`-style button
must be clicked instead).

**Fix (flush-only, bounded):** in `flush()`, when the held carry is **exactly** the 2-byte
`ESC O` / `ESC [` introducer that never completed, emit `{key:'O'|'[', alt:true}` — byte-identical to
every other `Alt+<char>` the decoder already produces (`decodeEscape` → `{...decodeSingle, alt:true}`,
`keys.ts:127-136`). A longer in-progress CSI (`ESC [ 1 ;`) is a real modified-key sequence and is
**not** reinterpreted (strict `length === 2` guard).

**Accepted tradeoff (user-confirmed 2026-07-07):** a genuine SS3/CSI key (F1–F4, cursor) whose bytes
are split by a >50 ms lag across the introducer boundary flushes as `Alt+letter` — the *same* bounded
risk the existing lone-ESC disambiguation already accepts; a >50 ms mid-sequence split is pathological.

**Not TV-gated:** #40 carries the `tv-fidelity` label because *accelerators* map to TV `getAltCode`,
but this change is to the **xterm decoder grammar** (a byte layer TV/DOS never had) — GATE-1/2
(drawing/geometry/color) does not apply; the decode policy below is the spec.

## Scope decisions (grounded)

- **Flush-only, not the `ESC O <invalid-final>` same-chunk drop path.** The dominant real case is a
  lone 2-byte `ESC O` held → 50 ms → flush; a quickly-following byte within one read is rare and
  keeping `decodeSs3`'s drop path untouched keeps the change surgical. Documented known limitation.
- **`ESC [` disambiguation is inherently flush-only.** `ESC [ A` is unambiguously Up in the protocol,
  so a following byte can never be reinterpreted; only the timed-out bare `ESC [` can. `ESC O` is
  scoped the same way for consistency + minimal risk.
- **Regression lives in code, not the corpus.** The input-corpus harness feeds one chunk and never
  flushes (`input-corpus-helpers.ts`), so it cannot express a timeout-flush; the oracle is a
  `decode()`-then-`flush()` spec test (supersedes issue AC-1's "corpus fixture" wording).

## Existing-oracle check (done)

`input-hardening.spec.test.ts:177` **ST-5.j** already permits *either* `Alt+[` **or** `escape` + `[`
(its invariant is "the carry never fuses into a phantom CSI"). The HR-24 author anticipated this fix —
the new Alt+[ output still satisfies ST-5.j, so no immutable oracle is edited. Corpus/host/fuzz tests
feed complete sequences (timer cancelled before flush) → unaffected.

## Tasks

- [x] T-03.1 **Spec test (red)** — new `ST-5.k` in `packages/core/test/input-hardening.spec.test.ts`:
      `decode([0x1b,0x4f])` holds (0 events) then `flush()` → exactly `[{key:'O',alt:true}]`, carry 0;
      `decode([0x1b,0x5b])` then `flush()` → exactly `[{key:'[',alt:true}]`, carry 0. Assert no bare
      `escape` and no fused CSI key. Trace to #40.
- [x] T-03.2 **Run red** — confirm ST-5.k fails (today: `escape` + letter) and ST-5.j still passes.
- [x] T-03.3 **Implement (green)** — in `packages/core/src/engine/input/decoder.ts` `flush()`: before
      the leading-lone-ESC branch, detect a held **length-2** `ESC O`/`ESC [` and return the single
      `Alt+letter` event (reuse the `decodeSingle`+alt shape; no new surface). Keep every other flush
      path (lone ESC, longer carries) unchanged.
- [x] T-03.4 **Run green** — ST-5.k + ST-5.j + the full `input-*` suites pass.
- [x] T-03.5 **Impl test** — `input-hardening.impl.test.ts`: a >50 ms-split F1 (`ESC O` flush **then**
      `P`) surfaces `Alt+O` + a bare `P` (the documented tradeoff), and a same-window `ESC O P` (no
      flush) still decodes as F1 — proving the fix is flush-scoped.
- [x] T-03.6 **Full verify.**

**Verify**: `yarn verify`
