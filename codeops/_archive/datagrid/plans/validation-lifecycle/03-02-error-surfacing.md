# Error Surfacing

> **Document**: 03-02-error-surfacing.md
> **Parent**: [Index](00-index.md)

## Overview

Make a rejection legible: mark the invalid cell in a dedicated `gridInvalid` theme role and surface
the active validation/veto message in a reactive message band. Owns the `gridInvalid` core role
(AR-4/AR-18), the error registry (AR-10), and the message band (AR-11).

## Architecture

### Current

The dirty registry (`editing.ts:53-102`) paints a `•` in `gridDirty` at `paintDirtyMarkers`
(`editable-grid-rows.ts:767-782`). There is no invalid-cell state and no message surface.

### Proposed

A parallel, richer registry keyed by the same `cellKey`, holding a **message** per invalid cell; a new
`gridInvalid` overpaint above the dirty marker; and a grid-owned reactive `Text` band showing the
current message.

## Implementation Details

### The `gridInvalid` core role (AR-4, AR-18)

Additive to `@jsvision/core`. Touch exactly:

1. `theme.ts` — `Theme` interface: add `readonly gridInvalid: ThemeRole;` after `gridSelectedRow`
   (`:236`), with JSDoc: *a solid band marking a cell whose edit failed validation, distinct from the
   `gridDirty` pending marker and the `gridCursor` focus.*
2. `theme.ts` — `defaultTheme` literal: `gridInvalid: { fg: PALETTE.white, bg: PALETTE.red }`
   (white on the deep DOS red — a legible band; white-on-`brightRed` was rejected for weak contrast).
   Pinned by `grid-theme.spec.test.ts`.
3. `roles.ts` — the derived-role builder: `gridInvalid: { fg: PALETTE.white, bg: PALETTE.red }` — a
   **fixed** deep-red band, NOT seeded from `danger`. (Corrected at execution, AR-22: deriving from
   `danger` was found to violate the immutable core invariant that `danger` seeds only the
   severity-text roles — the same reason `gridDirty` avoids `danger`, `roles.ts:104-108`. Guarded by
   `create-theme.spec.test.ts` + `accelerator-aliases.impl.test.ts`.) A theme may override the role
   directly. Covers every `createTheme(seeds)` preset automatically.
4. `presets.ts` — `monochromeTheme` literal (`:122-124`): `gridInvalid: { fg: W, bg: B, attrs: REV }`
   (monochrome has no color; reverse-video marks it).
5. `severity-text-theme.spec.test.ts:32` — bump the role count `71 → 72` (+ the explanatory comment):
   a legitimate role-addition update, exactly as `gridSelectedRow` set it to 71.
6. `core/CHANGELOG.md` — an additive-role entry (lockstep; the first datagrid→core touch since RD-05).

The enumeration oracles (`serialize-theme.spec.test.ts:51` role-order, `presets.spec.test.ts:65`,
`create-theme.spec.test.ts:62`, the ui `*-theme.spec` encode-safety loops) auto-adapt as long as the
role is present in `defaultTheme` + derivation.

### The error registry (`error-registry.ts`, AR-10)

A twin of `createDirtyRegistry`, but each key carries a message and there is a notion of the **active**
message (the most recent, for the band):

```ts
export interface ErrorRegistry {
  /** Mark a cell invalid with a message (also becomes the active message). */
  set(key: string, message: string): void;
  /** Clear a cell (if it held the active message, the band recomputes to the next / empty). */
  clear(key: string): void;
  /** Reactive: is this cell invalid? (drives the gridInvalid overpaint) */
  has(key: string): boolean;
  /** Reactive: the message for a cell, or undefined. */
  message(key: string): string | undefined;
  /** Reactive: the current active message to show in the band, or null. */
  active(): string | null;
  /**
   * Push (or clear, with `null`) a **transient** row/veto message that has no cell key — used by the
   * row gate ([03-03](03-03-row-gate.md)) for a message not anchored to one invalid cell. Shares the
   * single last-writer-wins `active()` channel with keyed `set`. `note(null)` recomputes `active()` to
   * the most-recent still-invalid keyed cell's message (else null), so a lingering red cell keeps its
   * explanation instead of the band going silently blank.
   */
  note(message: string | null): void;
  /** Reactive: the invalid-cell key set (for the paint pass). */
  keys(): ReadonlySet<string>;
}
```

Implementation mirrors the dirty registry: a `signal<ReadonlyMap<string, string>>` publishing a fresh
Map on each `set`/`clear`. There is **one** active-message channel — a small companion
`signal<string | null>` — shared by keyed `set` and the keyless `note`, last-writer-wins (the RD's
"message area shows the active validation/veto message", RD-12 R4). It is recomputed whenever the
active source disappears: `clear(key)` on the active keyed message, and `note(null)`, both fall back to
the most-recent still-invalid keyed entry (else null) — so clearing a transient row/veto `note` never
hides a message that a still-invalid cell still needs. Bare signals only — no `computed` (the package
convention, AR-10).

### The `gridInvalid` overpaint (`editable-grid-rows.ts`, AR-17)

Add `paintInvalidCells(ctx)` beside `paintDirtyMarkers` (`:767`), running **before** it in the final
overpaint sequence (`:755-756`) so precedence is `cursor > gridInvalid > gridDirty > …` (AR-17). It
fills each visible invalid cell's rect in the `gridInvalid` role (a band, like `gridSelectedRow`,
`:708`), not just a glyph — a validation failure is a stronger signal than a pending `•`. The body
reads the registry via the same `EditableGridRowsConfig.errors?` seam the container threads; repaint
is driven by binding `errors.keys` in `onMount` (mirroring the dirty bind at `:295-296`).
`CellState.invalid` is added to `cell-draw.ts` and fed to a custom renderer at `:742` (twin of
`dirty`).

### The message band (`validation.ts` builder, AR-11)

A one-line reactive `Text`:

```ts
export function buildMessageBand(active: () => string | null, severity: () => 'error' | 'warning'):
  View { return new Text(() => active() ?? '', { severity: severity() }); }
```

Rendered as a dedicated one-cell-tall band in the footer region (beside/above the footer widget row,
`grid-panels.ts:583-590`), present **whenever validation is configured** — independent of whether a
footer with aggregates/widgets exists (validation must surface with no footer). Empty string when
there is no active message (the band collapses to blank; it is not removed, so layout is stable). The
message is sanitized for free at draw (`ui/src/view/draw-context.ts:108`) — a control byte in an
echoed value cannot inject (AR-19).

> **Layout tradeoff (accepted):** a validation-configured grid permanently spends **one body row** on
> the band even when it holds no message. This is the deliberate stable-layout choice — the body never
> jumps by a row as messages come and go. If body height is ever at a premium, a later refinement can
> collapse the band to zero rows when no message is active (accepting a 1-row shift when one appears);
> v1 keeps it always-reserved.

## Integration Points

- `grid.ts` owns `private readonly errors = createErrorRegistry()` (twin of `dirty` at `:274`) and
  threads it into `_bodyDeps` (twin of `:488`) and into the `EditHost` (03-01). It builds the message
  band and hands it to `grid-panels.ts` (a new `messageBand?: View` body-dep) so the band renders in
  the footer region.
- Severity is `'error'` for a validation/veto message; a `'warning'` channel is reserved (the band
  builder accepts it) but v1 emits only `'error'`.

## Error Handling

| Case | Handling | AR |
| ---- | -------- | -- |
| Invalid message contains control bytes | Sanitized at draw; renders clean | AR-19 |
| Cell corrected + re-committed | `errors.clear(ck)` on success → marker + (if active) message clear | AR-10 |
| Editor cancelled (Esc) on an invalid cell | `cancel()` clears the cell's error entry → marker + (if active) message clear; the record kept its prior valid value, so no stale marker survives ([03-01](03-01-column-validation-and-commit-pipeline.md)) | AR-10 |
| Two cells invalid at once | Both painted; the band shows the active (most recent) message | AR-10 |
| No footer configured | The message band still renders (validation-owned, not footer-owned) | AR-11 |

## Testing Requirements

- Spec: an invalid commit paints the `gridInvalid` role at the cell + shows the message; correcting
  clears both; a control-byte message renders sanitized (ST-7…ST-10, ST-20 security).
- Impl: registry `set`/`clear`/`active` last-writer-wins; precedence `cursor > invalid > dirty`; the
  band renders with no footer; core theme suite green + count `72`; every role-enumeration oracle
  green.
