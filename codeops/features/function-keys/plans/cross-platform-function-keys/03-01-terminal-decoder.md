# Terminal Decoder: Cross-Platform Function Keys

> **Document**: 03-01-terminal-decoder.md
> **Parent**: [Index](00-index.md)

## Overview

The core decoder converts a bounded set of interoperable terminal byte representations into the
existing canonical F1–F12 `KeyEvent` vocabulary. It does not apply the number-row fallback policy.
See AR-2, AR-4, AR-8, and AR-9.

## Architecture

### Current Architecture

`decode()` prioritizes terminal replies, mouse, focus, and paste before calling `decodeKey()`.
`decodeKey()` handles Escape-prefixed CSI/SS3 grammar and printable/control bytes. Unknown complete
sequences are dropped and incomplete tails are carried under the shared response cap.

### Proposed Changes

Keep the scan order and public `KeyEvent` shape. Extend the keyboard grammar with three exact
families:

1. CSI final `P/Q/R/S`, with either no parameters or the xterm `1;<modifier>` form.
2. Linux-console `ESC [[ A/B/C/D/E`.
3. Kitty CSI-u functional identifiers for F1–F12, with optional valid modifier parameters.

The primary SS3 and numeric-tilde tables remain authoritative for existing behavior.

## Implementation Details

### Constants and Tables

- Add a read-only map for CSI F1–F4 finals.
- Add a read-only map for Linux-console finals A–E.
- Add an exact read-only map for Kitty F1–F12 private-use identifiers.
- Replace the lossy new-family parse boundary with structured CSI metadata that retains raw
  parameter validity, exact field boundaries, private/colon markers, intermediates, and bounded
  decimal conversion. Do not broaden strictness into unrelated cursor/backtab behavior.
- Reuse `decodeModifiers()` only after validating the sequence family, parameter positions, and
  family-specific modifier domain.

### Classification Rules

- Bare CSI `P/Q/R/S` produces unmodified F1–F4.
- CSI `1;<modifier>P/Q/R/S` produces F1–F4 with decoded modifiers only for exact decimal modifier
  values 1–16. This preserves the existing legacy xterm Meta-to-Alt projection.
- Other parameter shapes ending in `P/Q/R/S` are dropped.
- `ESC [[ A/B/C/D/E` produces unmodified F1–F5; other finals are dropped as one complete family.
- CSI `<functional-id>u` and CSI `<functional-id>;<modifier>u` produce only mapped F1–F12 keys.
  CSI-u modifiers are exact decimal values 1–8, representing only Shift/Alt/Ctrl; unsupported
  Super/Hyper/Meta/lock bits are rejected rather than discarded or folded.
- Unknown CSI-u identifiers, zero/out-of-range modifiers, private markers, colon subparameters,
  empty/extra fields, intermediates, oversized decimal values, and out-of-scope F13+ identifiers
  are dropped without printable leakage.
- Numeric-tilde physical keys retain current behavior.
- A modifier-bearing physical F-key retains Ctrl/Alt/Shift. A later UI fallback consumes its Alt
  introducer and produces an unmodified F-key under AR-4.

### Integration Points

No capability negotiation is required. `DecodeOptions.caps` remains available but does not select
the grammar; recognizing multiple unambiguous forms is safe because each begins with a complete
escape sequence.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Unknown complete functional identifier | Consume the complete CSI and emit nothing | AR-8, AR-9 |
| Invalid/extra modifier parameters | Consume the complete sequence and emit nothing | AR-4, AR-8 |
| Partial escape sequence | Preserve existing bounded carry behavior | AR-8 |
| Linux-console prefix with unknown final | Consume the fixed family without leaking printable bytes | AR-8 |
| F13+ CSI-u identifier | Treat as out of scope and drop | AR-9 |

## Testing Requirements

- Specification tests cover every accepted family and representative modifiers.
- Corpus tests cover chunk splits within each newly accepted family.
- Implementation tests cover invalid arity, unknown identifiers/finals, private markers, colon
  subparameters, empty fields, intermediates, oversized decimals, and exact modifier boundaries.
- Existing hardening and fuzz suites remain unchanged and green.
