# 03-02 — datagrid widgets (#116)

Site inventory: [02-current-state.md §2](02-current-state.md#2-116--packagesdatagridsrc-48-conversions).
48 conversions across 10 modules. This document specifies shape and risk per group.

## Group A — `grid-panels.ts` (24 sites)

The largest and most load-bearing file. `buildGridBody()` assembles up to eight horizontal bands over
a `FreezePartition`; the bands are built in loops, so most conversions are **tag-in-place**
(`x.layout = fixed1` → `fixed(x, 1)`) rather than expression rewrites.

**Convert in two passes, verifying between them:**

1. **Tag sites first** (`:208, 255, 517, 522, 527, 536, 540, 544, 549, 553, 557, 566, 567, 591, 619,
   625, 637, 658` — the `fixed1`/`fr`/`segLayout`/`prefixLayout` assignments). These are provably
   depth-neutral, so `golden-screen.spec` and `a11y-golden.spec` must stay green with zero edits. If
   either moves, stop — the transcription is wrong.
2. **Container sites second** (`:441, 445, 448, 578, 674` — `inner`, `bodyRow`, `freezeRowsRow`,
   `bodyStack`, `host`). These become `col`/`row` builders. `bodyStack` and `host` are conditional
   (lifecycle swap), so preserve the branch structure rather than flattening it.

The shared `fixed1`/`fr` module consts stay — they are referenced by `segLayout`/`prefixLayout`
computations, not only by direct assignment. Delete only what genuinely becomes unreferenced.

`deps.vbar`/`deps.hbar`/`deps.messageBand` are container-supplied but **internal** (created at
`grid.ts:529-530`/`:554` with no prior `.layout`), so the taggers are safe here (AR-1). Because
`buildGridBody` runs again on rebuild (`grid.ts:665`, `:744`), the merge must be idempotent — it is:
re-tagging sets the same size over the same layout.

## Group B — pure-flex modules (17 sites)

`value-list-popup.ts` (5), `grid-lifecycle.ts` (5), `filter-popup.ts` (4), `button-row.ts` (3).
All locally constructed or internal, all `size`-only descriptors → direct tagger substitution, plus
`row(...)` for `button-row.ts:81` and `:87`'s centered cell.

`filter-popup.ts:47-48` (`labelledField`'s `caption`/`editor` params) and `button-row.ts:84` (the
caller's button) are caller-supplied but **module-internal** — `labelledField` is module-private
(`:46`) and `buttonRow` is **not** exported from the datagrid barrel. Taggers are safe (AR-1).

`filter-popup.ts:272` is **excluded** — `this.layout` self-config, which no builder can wrap (AR-7).

## Group C — `position:'fill'` → `cover()` (4 sites)

`grid.ts:508`, `:511`, `:1417` and `editing.ts:230`. `cover(view)` is a one-for-one merge-preserving
replacement for `{ position: 'fill' }` and changes no nesting.

**All four mount into a live host** — unlike the T-AO1 app overlay, which is `visible:false` until a
popup mounts and therefore never receives solved bounds from the layout pass. Confirm that premise
holds for each of the three `grid.ts` sites during conversion; if any turns out to be a hidden host,
stop and leave it absolute rather than repeating T-AO1.

## Group D — anchored placement → `at()` (3 sites)

`quick-filter-row.ts:155`, `personalize-dialog.ts:391`, `overlay.ts:125`. All compute coordinates
from live measurements (scroll indent, resolved column widths, popup anchor with viewport clamping),
so they stay absolute — `at()` is the blessed builder for exactly that shape, not a step toward flex.

`at()` merges and writes the same `{ position:'absolute', rect }` descriptor, so
`quick-filter-row.impl.test.ts`'s 15 `.layout.rect?.x/width` reads keep working unchanged. That is the
specific reason this group is safe; if any read breaks, `at()` was called with the wrong argument
form.

## Cross-cutting: build order

`packages/datagrid` tests import `@jsvision/ui` **by name → built `dist`**. Rebuild `ui` after Phase 2
before trusting any datagrid result (NFR-4). A stale dist produces failures that look like datagrid
regressions and are not.
