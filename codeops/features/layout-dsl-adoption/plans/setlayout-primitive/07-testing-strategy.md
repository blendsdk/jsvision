# Testing Strategy — setlayout-primitive

## What is actually at risk here

Unlike the adoption plans, this one has a **new behaviour to specify** — so the spec tests come first
and go red, in the ordinary way. But it also carries a migration whose danger is the same one that
has bitten this feature repeatedly: a conversion that turns a *clobber* into a *merge* (or the
reverse) at a site where that difference is observable.

Two distinct oracles are therefore needed:

1. **Contract tests for `setLayout`** — derived from FR-1/FR-2/FR-4, written before the method exists.
2. **Equivalence tests for the migration** — pinning that specific converted sites still solve to the
   same geometry. These are green-first against unmodified source, like the adoption plans'
   witnesses, so a later red proves the conversion moved something.

Where an existing suite already covers a converted site (the DSL builders are well covered by the
adoption plans' spec suites), that suite is the oracle and no new test is written. New tests are
added only where nothing watches today.

## Specification test cases

### `setLayout` contract — `packages/ui/test/view-setlayout.spec.test.ts` (new)

| # | Input | Expected |
|---|-------|----------|
| ST-S1 | A view with `{ direction:'col', padding:1 }`; `setLayout({ size: fixed 2 })` | All three props present. The pre-existing `direction` and `padding` survive — this is the whole point of the method |
| ST-S2 | A view with `size: { kind:'fixed', cells:1 }`; `setLayout({ size: { kind:'fr', weight:1 } })` | `layout.size` is **exactly** `{ kind:'fr', weight:1 }` — no residual `cells`. **This test exists to fail if the shallow merge is ever changed to a deep merge** (FR-2) |
| ST-S3 | A **mounted** view; `setLayout({ padding: 1 })` | The host's relayout was requested |
| ST-S4 | An **unmounted** view (`host` is null); `setLayout({ padding: 1 })` | Does not throw; the props are still merged |

ST-S3 needs a host double exposing `markRelayout`. `packages/ui/test/app-shell.fixtures.ts` already
holds local host doubles for this package — reuse it rather than adding a second seam.

### Migration equivalence — green-first, written before any conversion

| # | Subject | Asserted | Where |
|---|---------|----------|-------|
| ST-S5 | `fixed(view, 2)` applied to an **already-mounted** view | The host's relayout was requested. **Red before the conversion, green after** — the one intentional behaviour change (AR-5), and the only ST here that is not green-first | `view-setlayout.spec.test.ts` |
| ST-S6 | `at(view, rect)` on a view already carrying `direction:'col'` | `direction` survives alongside `position`/`rect` — the merge-preservation guarantee cannot regress through the conversion | existing DSL suite if it covers this; otherwise added here |
| ST-S7 | A `Dialog` constructed with `width`+`height` and no `rect` | Its solved rect is unchanged, and `layout.position === 'absolute'`. Pins the [02 §4](02-current-state.md) trace — the single site where replace ≠ merge | `packages/ui/test/` dialog suite |
| ST-S8 | `StatusLine` and `ColorPicker` after construction | `layout.direction === 'row'` on both, and each solves to its current literal geometry | `packages/ui/test/` |

**ST-S5 is deliberately red-first and must be called out as such**: every other test in this plan is
green before its change, and a reviewer seeing one red test should find it already explained here
rather than wonder whether a witness was written backwards.

## Non-vacuity

Carried over from the sibling plans, because it caught real defects there:

- A relation between two solved values (`b.y === a.y + a.height`) is never a sole assertion — it holds
  when both operands collapse to zero. Assert **literal** rects.
- Read `bounds` only after forcing a layout pass; an unflushed read captures `{0,0,0,0}` and bakes the
  zeros in as the expectation.
- ST-S2's assertion is `toEqual` on the whole `size` token, not a check that `weight` is set. A
  deep-merge regression leaves `cells` behind *alongside* a correct `weight`, so any weaker assertion
  passes straight through the bug it exists to catch.

## Verification

Per phase: `TUI_SKIP_PERF=1 yarn verify && yarn workspace @jsvision/examples test:e2e` (AR-4).

The e2e half is load-bearing rather than belt-and-braces: `yarn verify` runs only the `unit` project,
and `@jsvision/ui` reaches the demos through its **built `dist`** — so a layout regression introduced
here shows up in a spawned demo's rendered frame and nowhere else. The frame snapshots added by the
canvas plan are, in effect, this plan's integration oracle.

At close-out additionally: `yarn check:deps`; `yarn plugin:sync --fix` clean (NFR-5/AC-10); a grep
audit that no `{ ...view.layout` spread survives in `packages/ui/src/view/dsl/`; and
`git diff --stat` confirming nothing under `packages/spike-data-studio` or another package's `src/`
was touched (AC-9).

`yarn bench` is run once, informationally (NFR-3). It never gates — but a visible regression in the
layout pass stops the phase, since `setLayout` sits on the hot path's write side.
