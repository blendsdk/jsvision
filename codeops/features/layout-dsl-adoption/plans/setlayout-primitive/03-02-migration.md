# 03-02 — migration + the replace-semantics audit (P2/P3)

Implements [FR-4, FR-5, FR-6](01-requirements.md). Site inventory:
[02 §2 and §3](02-current-state.md).

## The audit comes first — P3 before P2

The issue orders these P2 (migrate) then P3 (audit). **This plan inverts that**, because an audit run
after the migration cannot change the migration's outcome; it can only ratify it. Every site is
audited *before* it converts, and a site whose audit says "this replace is load-bearing" does not
convert at all — it stays a wholesale assignment with a plain-language comment, exactly as this
feature's earlier plans handled their preserved sites.

**The question is never "is this a replace?"** — that is trivially greppable. It is **"does anything
downstream depend on the replace having cleared a prop?"** A replace is only meaningful where the
object was non-empty, and only *load-bearing* where nothing later restores what it cleared.

## The audit table — one row per site, filled before any conversion

Recorded here, not in shipped source (AR-8). Two rows are pre-filled from
[02 §3–§4](02-current-state.md); the rest are completed during task 2.1.

| Site | Starting object | Replace clears | Restored downstream? | Verdict |
|---|---|---|---|---|
| `dialog.ts:109` | `{position:'absolute', padding:1}` (from `Window`'s field initializer) | `position:'absolute'` | **Yes** — every path passes through `center()` (`absolute.ts:94`) or `at()` (`:44`), both of which write `position:'absolute'`; the block is guarded by `width && height` | ✅ convert — end state identical, pinned by ST-S7 |
| `statusline.ts:83` | `{}` (`Group` initializes nothing) | nothing | n/a | ✅ convert — replace ≡ merge |
| `color-picker.ts:220` | `{}` | nothing | n/a | ✅ convert — replace ≡ merge |
| `window.ts:161` · `edit-window.ts:77` · `form-dialog.ts:82` · `filter-popup.ts:285` | — | — | already spreads; merge is what they already express | ✅ convert — mechanical |
| the 13 DSL sites | — | 8 are already spreads; 5 write a freshly-constructed Group/Stack | — | ✅ convert — see below |

**Any row that comes out ⛔ halts the phase** and becomes a preserved site with a comment, plus an
entry in the register as a runtime addition. Nothing is converted on the assumption that a replace
was incidental.

## The DSL sites (FR-4)

Eight of the thirteen are literally `view.layout = { ...view.layout, … }` and become
`view.setLayout({ … })` — the spread was always emulating this method.

The five that write a **freshly constructed** Group or Stack (`flex.ts:96`, `:100`, `stack.ts:192`,
`:196`) are indistinguishable either way, since the object is `{}`. They convert for consistency: a
reader should not have to work out which of two idioms a builder uses, and a future edit that adds a
prop before one of these lines would silently lose it under replace.

**`stack.ts:149` is the one site where invalidation batching is visible.** It sits inside a loop that
tracks a `changed` flag and calls `this.invalidateLayout()` once afterwards (`:153`). Under
`setLayout` each layer invalidates as it is written. That is correct and free — `markRelayout` sets a
flag and `scheduleFlush()` early-returns when a flush is pending ([02 §1](02-current-state.md)) — so
the trailing batched call becomes redundant. **Leave it.** It is harmless, it keeps the loop readable,
and removing it would couple this file to an implementation detail of `setLayout`.

## The behaviour change, stated plainly (AR-5)

Converting the taggers means `at`, `cover`, `center`, `fixed`, `grow` and the `stack` placement
helpers now request a reflow when applied to an **already-mounted** view. Today they do not, and a
caller must remember to invalidate — the "set and forget silently doesn't repaint" defect the issue
opens with.

- At build time (the overwhelming majority of calls) `host` is `null` and nothing changes.
- `filter-popup.ts:285` is the only site in the codebase that re-tags a mounted view. There, today's
  silence is the bug.
- Sites that already call `invalidateLayout()`/`invalidate()` next to a tagger now do so redundantly.
  Harmless — `markRelayout` is idempotent and coalesced — and not worth chasing.

ST-S5 pins the new behaviour so it cannot regress; ST-S6 pins that merge-preservation still holds, so
the conversion cannot quietly turn a merge back into a clobber.

## Ordering within the phase

1. Complete the audit table (task 2.1) — **no code changes**.
2. Convert the DSL sites (13). They are the highest-traffic and best-covered by the existing adoption
   suites, so a mistake surfaces immediately.
3. Convert the 7 self-layout sites, `dialog.ts:109` last — it is the only one whose safety rests on a
   traced argument rather than an empty starting object.
