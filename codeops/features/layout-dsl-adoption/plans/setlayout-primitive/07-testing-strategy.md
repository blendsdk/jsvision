# Testing Strategy — setlayout-primitive

## What is actually at risk here

Unlike the adoption plans, this one has a **new behaviour to specify** — so the spec tests come first
and go red, in the ordinary way. But it also carries a migration whose danger is the same one that
has bitten this feature repeatedly: a conversion that turns a *clobber* into a *merge* (or the
reverse) at a site where that difference is observable.

Two distinct oracles are therefore needed:

1. **Contract tests for `setLayout`** — derived from FR-1/FR-2/FR-2a/FR-4, written before the method
   exists. These are `*.spec.test.ts`.
2. **Equivalence witnesses for the migration** — pinning that converted sites still solve to the same
   geometry. These are `*.impl.test.ts`, and mostly they **already exist**.

**Spec vs impl, and why it matters here.** CLAUDE.md defines `*.spec.test.ts` as an *immutable
oracle derived from requirements* — if it fails after implementation, the code is wrong. A witness
derived from *current implementation output* (a literal `Dialog` rect, a constructor-set `direction`)
is not that: it is an internals test, and freezing it as an immutable oracle would leave a later
flex-elimination plan facing a test it is forbidden to edit — which collides directly with this
epic's recorded maximal-flex-elimination direction. Every existing witness of this kind in the repo
is correctly an impl test (`dialog.dsl-shape.impl.test.ts`, `dialog.centering.impl.test.ts`,
`dsl-hardening.impl.test.ts`). This plan follows that split.

**Where an existing suite already covers a converted site, that suite is the oracle and no new test
is written.** This rule was stated in the first draft and then violated by it; [02 §7](02-current-state.md)
now lists the existing coverage explicitly so the rule can actually be applied.

## Specification test cases — `packages/ui/test/view-setlayout.spec.test.ts` (new)

| # | Input | Expected |
|---|-------|----------|
| ST-S1 | A view with `{ direction:'col', padding:1 }`; `setLayout({ size: fixed 2 })` | All three props present. The pre-existing `direction` and `padding` survive — this is the whole point of the method |
| ST-S2 | A view with `size: { kind:'fixed', cells:1 }`; `setLayout({ size: { kind:'fr', weight:1 } })` | `layout.size` is **exactly** `{ kind:'fr', weight:1 }` — no residual `cells`. **This test exists to fail if the shallow merge is ever changed to a deep merge** (FR-2) |
| ST-S3 | A **mounted** view; `setLayout({ padding: 1 })` | The host's **`markRelayout`** was called — specifically, not merely "a frame was scheduled" |
| ST-S4 | An **unmounted** view (`host` is null); `setLayout({ padding: 1 })` | Does not throw; the props are still merged |
| ST-S5 | `fixed(view, 2)` applied to an **already-mounted** view | The host's `markRelayout` was called. **Red before the conversion, green after** — the one deliberate red in Phase 2 (AR-5). It *specifies new behaviour*; it does not witness a bug fix (see below) |
| ST-S9 | A view with `size: {kind:'fixed',cells:2}`; `setLayout({ size: undefined })` | `size` is cleared and the engine reads the default — `normalizeSize` yields `{kind:'auto'}`. Pins FR-2a's **supported reset** contract. This is a spec oracle, not an impl one: it derives from a requirement, not from observed output |

> **Identifier note.** ST-S6 and ST-S7 were **retired** — both were already covered verbatim by
> existing suites (see below) — and their numbers are **not reused**. The reset contract was promoted
> out of the impl tier (it was ST-I2) to ST-S9, because it derives from FR-2a rather than from
> current output. The prefix always means tier: `ST-S*` in `view-setlayout.spec.test.ts`, `ST-I*` in
> `view-setlayout.impl.test.ts`.

### The host seam for ST-S3 / ST-S5

**There is no existing `ViewHost` double to reuse.** `packages/ui/test/app-shell.fixtures.ts` and
`app-shell-host-doubles.ts` hold `RuntimeAdapter`/terminal fakes (`FakeRuntimeAdapter`,
`CaptureStream`, `FakeInput`); no file under `packages/*/test` defines a `ViewHost` or stubs
`markRelayout`. The word "host" means two unrelated things in this codebase, and the first draft of
this plan conflated them.

Use a two-line inline literal on the public `host` field (`view.ts:159`); `ViewHost`
(`view.ts:25-38`) has only two required members:

```ts
let relayouts = 0;
view.host = { markRepaint() {}, markRelayout() { relayouts += 1 } };
```

**Do not use the `createRenderRoot(size, { caps, schedule })` counting-scheduler pattern here**, even
though ~13 test files use it. It counts *scheduled frames*, and `markRepaint` schedules too
(`render-root.ts:296-300`) — so an implementation that called `invalidate()` where it should have
called `invalidateLayout()` would pass ST-S3 and ST-S5 green. That is precisely the defect these two
oracles exist to catch. FR-4/AC-3 say *reflow*, not *frame*.

## Implementation test cases — `packages/ui/test/view-setlayout.impl.test.ts` (new)

The internals and edges of a new primitive on the class every view inherits.

| # | Subject | Asserted |
|---|---------|----------|
| ST-I1 | `setLayout({})` on a view with existing props | Props unchanged; a fresh object is assigned (identity changes); one invalidation |
| ST-I3 | `setLayout` called N times in a loop on a mounted view | `markRelayout` called N times, but only one frame scheduled — pins the coalescing NFR-3 argues from |
| ST-I4 | Replace-not-mutate identity | `const before = v.layout; v.setLayout({padding:1}); expect(v.layout).not.toBe(before)` — the contract the 9 in-place mutation sites ([02 §5.5](02-current-state.md)) rely on not changing |
| ST-I5 | `StatusLine` and `ColorPicker` after construction | `layout.direction === 'row'` on both — an **object-shape** witness that the constructor write survives the conversion. Formerly numbered ST-S8; see the vacuity note below for what it deliberately does *not* claim |

## Migration witnesses — mostly already written

| # | Subject | Oracle |
|---|---------|--------|
| ~~ST-S6~~ | `at()` merge-preservation | **Already exists** — `dsl-absolute.spec.test.ts:20-33` asserts exactly this (`{direction:'col'}` → `at()` → whole-object `toEqual`, both overloads), reinforced by `dsl-hardening.impl.test.ts:120-128`. **No new test.** Task 2.2 runs them and records them green pre-migration |
| ~~ST-S7~~ | `Dialog` end state + solved rect | **Already exists** — `dialog.dsl-shape.impl.test.ts:14-36` (whole-object `toEqual` across all four constructor branches) and `dialog.centering.impl.test.ts:74-91` (solved bounds + re-centering). Stronger than the assertion the first draft specified. **No new test.** |
| ST-I5 | `StatusLine` and `ColorPicker` after construction | **The one genuinely new witness** — see the impl table above. Lands in `packages/ui/test/view-setlayout.impl.test.ts`, *not* in either widget's existing `.spec.` file. Justified by [02 §7](02-current-state.md): nothing asserts `direction` on either today, and the ColorPicker suites overwrite the constructor's layout wholesale, so `color-picker.ts:220`'s effect is currently invisible |
| — | `application.ts:343`/`:347` and the `:333` carve-out | **Already exists** — `app-shell.composition.spec.test.ts:107-122` (ST-W1) asserts the solved chrome rows, and `:151-160` (ST-W4) asserts `content.layout` `toEqual` the bare `{size:{kind:'fr',weight:1}}`, which goes red the moment `:333` is wrongly converted to a merge. **No new test**; task 2.2 records both green pre-migration |

**What ST-I5 deliberately does not claim.** An earlier draft added a solved-bounds half and called it
AC-6's rendered-geometry witness. That would have been vacuous: `direction:'row'` is the engine's
*default* (`layout/types.ts:213`), and nothing in `packages/*/src` reads `layout.direction` outside
JSDoc prose — so at these two sites replace, merge, and deleting the line outright all solve to the
same geometry. A bounds assertion there cannot fail for any reachable reason, which is exactly the
vacuity the non-vacuity rules below forbid. ST-I5 is an object-shape witness only. AC-6's real
geometry oracles are the `dialog.centering.*` and `dsl-*` suites, which assert literal rects derived
from a converted write.

## Non-vacuity

Carried over from the sibling plans, because it caught real defects there:

- A relation between two solved values (`b.y === a.y + a.height`) is never a sole assertion — it holds
  when both operands collapse to zero. Assert **literal** rects.
- Read `bounds` only after forcing a layout pass; an unflushed read captures `{0,0,0,0}` and bakes the
  zeros in as the expectation.
- ST-S2's assertion is `toEqual` on the whole `size` token, not a check that `weight` is set. A
  deep-merge regression leaves `cells` behind *alongside* a correct `weight`, so any weaker assertion
  passes straight through the bug it exists to catch.
- ST-S3/ST-S5 assert `markRelayout` specifically, never a frame count — see the seam note above.

## Verification

Per phase: `TUI_SKIP_PERF=1 yarn verify && yarn workspace @jsvision/examples test:e2e` (AR-4) —
effective only after **task 1.0** adds `"globalPassThroughEnv": ["TUI_SKIP_PERF", "CI"]` to
`turbo.json`. Without it the variable is stripped by Turborepo's strict environment mode and the perf
assertions run regardless of the prefix.

The e2e half is worth running, but be precise about what it proves: `yarn verify` runs only the
`unit` project, and `@jsvision/ui` reaches the demos through its **built `dist`**, so the e2e catches
a gross layout regression in a spawned demo. It is **not** a frame-snapshot comparison — the demos
assert glyph containment (e.g. `containers-demo.e2e.test.ts:44-60`: `toContain('╔')`,
`toContain('Line 09')`), which a five-column shift would pass. The frame-snapshot machinery belongs
to the canvas work on **PR #127, which is still open and not on this branch**; do not plan around it.
The real geometry oracles for this plan are the five files in [02 §7](02-current-state.md), all
present here, all asserting literal rects.

At close-out additionally:

- `yarn check:deps`;
- `yarn plugin:sync --fix` clean (NFR-5/AC-10);
- the two audit greps from [02 §8](02-current-state.md), each returning **0**;
- `git diff --stat` confirming nothing under `packages/spike-data-studio` or another package's `src/`
  was touched (AC-9);
- the kitchen-sink and `layout-dsl-playground` smoke suites green **and unedited** — FR-4 changes
  tagger runtime behaviour, and those suites exercise the taggers.

**`yarn bench` is not run for this change.** It measures `packages/core/bench/frame-bench.mjs`
(compose/diff/serialize on `ScreenBuffer`) and never imports `@jsvision/ui`, so it cannot observe a
`ui` layout-pass regression. NFR-3 rests on the analytical argument instead; claiming otherwise would
be a gate that measures somewhere else.
