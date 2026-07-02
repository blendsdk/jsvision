# Core Input Decoder Hardening: Runtime Hardening (RD-13)

> **Document**: 03-01-core-input-decoder.md
> **Parent**: [Index](00-index.md)
> **Covers**: HR-01, HR-04, HR-16, HR-22, HR-23, HR-24
> **Files**: `packages/core/src/engine/input/{keys.ts,decoder.ts,index.ts}`, `capability/{responses.ts,query.ts,index.ts}`, `engine/index.ts`

## Overview

Makes the byte→event boundary **total**: no byte sequence may throw, no terminal reply may leak as
keystrokes, no carry may fuse into a phantom key, and the decoder's documented public surface is
actually exported. This is the security-critical phase-1/phase-5 core work (stdin is untrusted).

## Implementation Details

### HR-01 — UTF-8 post-assembly validation (Critical)

**Defect** (`keys.ts:262-319`): `decodePrintable`/`utf8Length`/`decodeUtf8` validate only the
`10xxxxxx` continuation bit pattern and pass the assembled code point to `String.fromCodePoint`
unchecked → `RangeError` on `F4 90 80 80` (0x110000); lone surrogates (`ED A0 80`) and overlong
forms (`E0 80 80`, `C0 80`) surface as "printable" keys.

**Fix spec.** After assembly, validate the scalar value and the encoding shape; on any failure
return `{status:'drop'}` (identical to the existing invalid-lead path — the decoder resyncs at the
next byte):

1. **Range**: `cp > 0x10FFFF` → drop.
2. **Surrogates**: `0xD800 ≤ cp ≤ 0xDFFF` → drop.
3. **Overlong**: the assembled `cp` must require exactly the byte length consumed
   (2-byte ⇒ `cp ≥ 0x80`, 3-byte ⇒ `cp ≥ 0x800`, 4-byte ⇒ `cp ≥ 0x10000`) → else drop.
4. The existing printable-allowlist check still runs after (NUL/C1 can no longer arrive via overlong
   forms, restoring foundation AC-8's allowlist-only contract).

`decode` stays pure; `flush()` must leave no carry after a dropped sequence.

### HR-04 — DCS incomplete carry (Major)

**Defect** (`capability/responses.ts:118-130` + `input/decoder.ts:154-160`): `matchResponse`
returns `null` for an in-progress DCS (opened `ESC P`, no `ST` yet) — indistinguishable from "not a
response" — so the decoder's keyboard branch consumes the fragment as keys.

**Fix spec.** `matchResponse` (or its decoder call site) gains an **incomplete** result for an
opened-but-unterminated DCS, exactly parallel to the CSI fallback's incomplete path: the decoder
carries the fragment to the next chunk. A DCS terminates at `ST` (`ESC \`); a defensive upper bound
on carry growth reuses the decoder's existing bounded-buffer policy (foundation NFR — buffers stay
bounded). Splitting an `XTVERSION` reply at **every** interior byte offset yields the same single
query result and zero key events.

### HR-16 — `ESC ESC` → Alt+Escape *(Decision per PA-3)*

**Defect** (`keys.ts:106-127`): the Alt-prefix branch calls `decodeSingle(buf, i+1)`; an inner
`ESC` re-enters escape handling and both bytes vanish (reproduced: 0 events).

**Fix spec (PA-3).** In `decodeEscape`, when `next === 0x1b` **and** the pair is complete in the
chunk, emit one `escape` key event with `alt:true` (consuming both bytes). A lone trailing `ESC`
keeps the existing incomplete/flush behavior, so Esc-pause-Esc still yields two bare escapes.
HR-16's RD test row is superseded on this cell by PA-3 (recorded in the register's Resolution
Notes); the invariant "zero swallowed bytes" is unchanged.

### HR-24 — Flush timer for any ESC-prefixed carry

**Defect** (`decoder.ts:114-122`): the flush timer is armed only for `carry.length === 1`, so a
carried `ESC [` (Alt+`[`) waits forever and fuses with the next keypress into a phantom CSI.

**Fix spec.** Arm the flush timer whenever the carry begins with `ESC` (any length), not only for
the lone-ESC case. `flush()` on the carried `ESC [` decodes Alt+`[` (the existing Alt-prefix path).

### HR-22 — Passthrough re-injection

**Defect** (`capability/query.ts:36-41` returns passthrough bytes; `capability/index.ts:105`
destructures only `parsed`): keys typed during async detection are dropped, violating foundation AC-4.

**Fix spec.** `resolveCapabilitiesAsync`'s query consumer surfaces the passthrough bytes to its
caller; the host's detection wiring re-injects them into the decoder (in arrival order, ahead of
subsequent stdin chunks) so they surface as key events after detection completes.

### HR-23 — Missing public exports

**Fix spec.** Export `KEY_NAMES` from `input/index.ts` and re-export from `engine/index.ts`; export
the `PasteState` type (part of the public `DecoderState`) the same way. Single-entry-point rule;
additive only.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Out-of-range / surrogate / overlong UTF-8 | `{status:'drop'}` + resync; never throw | RD HR-01 (pinned) |
| Unterminated DCS at chunk end | `incomplete` carry, bounded | RD HR-04 (pinned) |
| Same-chunk `ESC ESC` | one `escape` event, `alt:true` | **PA-3** |
| ESC-prefixed carry, no follow-up bytes | flush timer → decode as Alt-prefixed / bare escape | RD HR-24 (pinned) |

## Testing Requirements

- Spec oracles ST-1.x (+fuzz), ST-2.1, ST-5.b,h,i,j (see [07-testing-strategy.md](07-testing-strategy.md)).
- HR-01 additionally gets a **fuzz seed**: full `0x80–0xFF` lead-byte space × random continuations,
  asserting `decode` never throws and every emitted key is a Unicode scalar value (AC-1).
- Impl tests: resync position after a drop; DCS carry across 3+ chunk splits; flush-timer arming
  states.
