# Execution Plan: layout-field-lockdown

> **Parent**: [Index](00-index.md)
> **CodeOps Skills Version**: 3.11.0
> **Last Updated**: 2026-07-21 (**complete** — 55/55; the three issues close on the branch's merge to `develop`)
> **Progress**: 55/55 tasks (100%) — plan complete
> **Revised**: 2026-07-20 after preflight (see [00-preflight-report.md](00-preflight-report.md))

> **Execution rules**
> 1. Specification-first: spec tests → red → implement → green → impl tests → verify.
> 2. Mark `[~]` on implementation, `[x]` only after verify passes.
> 3. Update Progress + Last Updated after EVERY task — never batch.
> 4. Verify command: `yarn verify` (AR-12).
> 5. If a detail is not covered here or in the register, STOP and ask — never guess.

---

## Phase 1: Typecheck coverage (#132 + the repo-wide gap)

> **Reference**: [03-01](03-01-typecheck-coverage.md) · **Routing**: standard
> **Objective**: FR-1…FR-4. 229 errors across ~126 files.

### Step 1.1 — Spec tests

- [x] 1.1.1 [spec-author] ST-1, ST-2, ST-3 — the coverage gate and its demonstrated failure. ST-2 must inject, observe failure, and revert. ST-3 is scoped to packages having **both** a `typecheck` script and a `test/`, with `spike-data-studio` named as exempt — *implemented + red 2026-07-20* (`packages/examples/test/typecheck-coverage.spec.test.ts`; ST-1 153 uncovered files, ST-2 `view-demo/main.ts` absent from the program, ST-3 8 packages). Coverage is read via the TypeScript config-resolution API — the same file set `tsc --listFiles` reports — rather than by shelling out to nine compilers

### Step 1.2 — Shared seam first

- [x] 1.2.1 The `.mjs` seam: **11** hand-written `.d.mts` files (AR-5) — 8 reached from `examples`, plus `docs-site/src/api/{jsdoc-examples,inject-back-links,validate-api-map}.mjs`. Declare only the surface the tests consume. Expect the 14 `TS7016` **and** most of the 14 `TS7006` to fall together — *done 2026-07-20*. **The true set is 13, not 11**: `scripts/gate.mjs` (imported by `core/test/gate.spec.test.ts`) and `packages/core/bench/frame-bench.mjs` (imported by `core/test/perf-budget.{spec,impl}` and `datagrid/test/perf-grid-bench.spec`) only surface once those test dirs are checked, and were not visible to the authoring spike. Each declares only the surface its tests consume. One residual, deferred to 1.3.1: `plugin-sync.spec.test.ts:160-172` builds its `draft` fake as an intermediate `const`, so the parameter gets no contextual type — that is a test-side fix, not a declaration gap

### Step 1.3 — Per package: turn it on **and** clear it in the same task

> Each task below both adds the config and drives that package to zero, so it verifies and commits
> standalone. Turning several on at once would leave the following tasks unable to satisfy rule 2,
> and turbo halts at the first failing package, so interim counts would not even be readable.
> **`rootDir: "."` is load-bearing** — `"src"` yields 606 phantom `TS6059`; omitting it yields
> `TS2209`, which aborts resolution and hid 80 real errors during measurement.

- [x] 1.3.1 `examples`: `include: ["**/*.ts"]` (`rootDir` is already `"."`); clear the ~25 ordinary errors. Latent defects deferred to 1.4.1 — *done 2026-07-20*: 25 errors exactly as measured; 17 cleared, the 8 latent left for 1.4.1. Three findings the compiler had been hiding: `files-demo`'s in-memory `FileSystem` never grew the four content methods the interface gained; `tvedit-demo` called `createTerminalQuery` with two positional arguments it does not take and overrode a `CapabilityProfile` field (`input`) that does not exist, so its mouse/unicode overrides were silently doing nothing; and `vitest.config.ts`'s `singleFork: true` had been ignored since the runner dropped that switch. ST-1 and ST-2 are now **green**; ST-3 is down to 7 packages
- [x] 1.3.2 `ui`: add `tsconfig.typecheck.json` + script; clear 80 errors / 50 files — *done 2026-07-20*: 80 exactly. Every one was a test-side fixture or annotation fault; no implementation defect. Two recurring shapes: `new Button(text, 'cmd')` (the second argument is an options object) and `ReturnType<typeof createApplication>`, a deferred conditional that resolves to `any`
- [x] 1.3.3 `core`: same; clear 65 / 32 (18 in `input-demux.spec`, 16 in `input-responses.impl`) — *done 2026-07-20*: **61**, not 65 — the `.mjs` seam had already retired the `gate.spec` and `perf-budget` imports. The 34 input errors were one root cause: the scanner returns `ResponseMatch | 'incomplete' | null` and the oracles read `.kind` off it unnarrowed, so a `'incomplete'` result would have asserted against `undefined`. A shared `matched()` narrowing helper *strengthens* those oracles
- [x] 1.3.4 `docs-site`: add `test/**/*.ts` to its existing include; clear **18** errors. Ordinary ones only — the 2 latent defects go to 1.4.1 — *done 2026-07-20*: **4**, not 18. The `.mjs` seam from 1.2.1 had already retired 14 of them (`jsdoc-examples`, `barrel-exports`, `inject-back-links`, `validate-api-map`), which is the first hard evidence that seam works. Two cleared here (`dialog-reopen.spec` reached an optional `Application.desktop`); the two named latent defects remain for 1.4.1
- [x] 1.3.5 `forms` (5) · `theme-designer` (**5** — the package **does** have a `test/`, contrary to the original inventory) · `files` (3) · `web` (0 — confirm) — *done 2026-07-20*: every count exact. `web` confirmed at 0. `theme-designer` and `files` cleared. **`forms`' 5 errors are the same 5 the plan books as latent defects**, so 1.3.5 only turns its config on and 1.4.1 clears them — the package's `typecheck` stays red until then, by design. `theme-designer/test/app.impl.test.ts` imported `FileSystem` from `@jsvision/core`, which never exported it (it lives in `@jsvision/files`)
- [x] 1.3.6 Cross-package test imports that cannot resolve: follow datagrid's documented `exclude` precedent, with a comment saying why — *done 2026-07-20*: **none arose**. No package outside datagrid needed a new exclusion
- [x] 1.3.7 Re-evaluate datagrid's three existing exclusions now that `core/test` is typechecked — their in-file rationale ("core never typechecks its `test/`") no longer holds. Fix with the `.d.mts` seam where possible; update the comment either way — *done 2026-07-20*: one of the three is retired. `perf-grid-bench.spec` is back in the program because `frame-bench.d.mts` removed its only objection. The other two import a `.ts` helper from `core/test` by workspace-relative path, which is a genuine cross-package `rootDir` violation (`TS6059`) rather than a missing declaration; the comment now says exactly that

- [x] 1.3.8 *(added by the Phase 1 quality review)* Retire `ReturnType<typeof createApplication>` in favour of the concrete `DesktopApplication` across 14 files — *done 2026-07-20*. It is a **deferred conditional type that resolves to `any`**, so every helper annotated with it, and everything reached through it, was unchecked while looking checked. A read as load-bearing as `app.desktop.layout.size` (`ui/test/app-shell.lifecycle.spec.test.ts:86`) was invisible. No `.layout =` write was hiding behind it, so the Phase 2 inventory stands — but the instrument Phase 2 drives from now actually sees these files. The precedent was already recorded in `ui/test/app-oncommand.spec.test.ts`

### Step 1.4 — The latent defects

- [x] 1.4.1 **One verdict each** — 4× `TS2722` + `TS2554` + `TS2345` + 2× `TS2740` in `examples/test`, 4× `TS2322` + `TS2739` in `forms/test`, `TS2345` at `docs-site/test/demo-shell.spec.test.ts:82`, `TS2322` at `docs-site/test/example-at.spec.test.ts:84`. Record *fixture wrong* or *assertion weaker than it reads*; no blanket non-null assertions — *done 2026-07-20*. Verdicts:

| Site | Verdict |
|---|---|
| `examples/test/datagrid-showcase.spy-source` ×4 | **Assertion weaker than it reads.** `SpySource` extended `GridDataSource` without re-declaring `setSort`/`setFilter` as required, so the type said *maybe implemented* about the two seams the source exists to implement. Made required |
| `examples/test/probe-nontty` ×2 | **Fixture wrong.** It injected `input`/`output` — the interactive TTY streams — into a run that asserts the *non*-TTY path, where neither is ever bound. Dropped; the test is unchanged otherwise |
| `examples/test/probe-readout` | **Fixture wrong.** The wheel-event literal predates the modifier fields; added as `false` |
| `examples/test/recipes.smoke` | **Fixture wrong.** `Sparkline.measure()` takes no argument; the available box handed to it was being ignored |
| `forms/test/async` ×4 | **Fixture wrong.** `((v) => seen.push(v))` returns a number into a `void \| Promise<void>` callback — a union does not get TypeScript's ignored-return exemption. Braced |
| `forms/test/bind-field` | **Fixture wrong.** The hand-built `Field` literal predates `validating`/`asyncError` |
| `docs-site/test/demo-shell:82` | **Assertion weaker than it reads.** The helper's structural parameter type asserted `desktop` is always present, dodging the optionality instead of checking it. Now takes `Application` and guards |
| `docs-site/test/example-at:84` | **Assertion weaker than it reads.** A registry `build` returns `Application \| View`; the assignment assumed a View without saying so. Now guards |

### Step 1.5 — Accept

- [x] 1.5.1 ST-2 in anger: break a demo entry, confirm `yarn typecheck` fails, revert — *done 2026-07-20*: a bad assignment appended to `view-demo/main.ts` failed `turbo run typecheck` at `view-demo/main.ts(98,7) TS2322`, naming the file; reverted, green again
- [x] 1.5.2 Measure the `turbo typecheck` wall-clock delta and record it — *done 2026-07-20*: per package, `ui` 3.1s → 6.2s and `core` 2.0s → 3.2s. Because turbo runs the packages in parallel the repo-wide delta is bounded by the slowest, ≈ **+3s**; a cold `yarn typecheck --force` (builds included) is 22.7s, a warm one 4.1s
- [x] 1.5.3 Full verify — *done 2026-07-20*: `yarn verify` green, 30/30 turbo tasks plus `check-plugin`. `yarn lint:fix` reformatted 5 files, committed with it

**Verify**: `yarn verify`

### Phase 1 quality review

Six findings; all resolved.

| # | Sev | Finding | Resolution |
|---|---|---|---|
| RV-001 | 🔴 | Clearing a type error made three theme oracles tautological — `create-theme.impl.test.ts` is named *"merges fields rather than replacing the whole role"* and proved nothing | **The type was the defect.** `roleOverrides?: Partial<Theme>` made each role optional but every field required, contradicting its own JSDoc and `applyRoleOverrides`. Widened to a per-field `RoleOverrides`; all three tests restored to real partial patches and **mutation-tested** — replacing the merge with an assignment fails both named oracles |
| RV-002 | 🟠 | ST-3 passed if *one* file under `test/` was in the program; a package with tests but no typecheck script slipped through unexempted; the script regex missed `--project` | All three closed. Coverage is now per file against a commented per-package allowlist, and mutation-tested by excluding a single file |
| RV-003 | 🟡 | The kitchen-sink canvas rect became a build-time snapshot, so a story opened after a zoom would be sized for the pre-zoom box | Restored to a live read behind an accessor that throws when the rect is absent |
| RV-004 | 🟡 | `singleFork` was retired in one vitest config and left dead in seven | Dropped in all seven; `fileParallelism: false` is what serializes those projects |
| RV-005 | 🟡 | `multiclick.consumers.spec` now recomputes the row list instead of reading the widget's own | **Accepted, not fixed** — the honest fix is a new public read on `Tree`, which is API surface this phase has no mandate to add. Equivalent today; recorded so it is not mistaken for coverage |
| RV-006 | 🟡 | Two declared types in `plugin-sync.d.mts` carried each other's doc comment | Swapped |

**Re-review of the fix diff** — seven further findings, all resolved except two recorded as accepted:

| # | Sev | Finding | Resolution |
|---|---|---|---|
| RV-007 | 🔴 | Eight long-standing spec oracles were edited outside the fix's stated scope | **Sanctioned**, not drift: this is task 1.3.8, decided before the sweep ran. No assertion changed; the annotation strictly *strengthens* checking. The reviewer's point that it was mechanical enough to corrupt comments is proven by RV-008 |
| RV-008 | 🟠 | The sweep's find/replace ate the contrast term, leaving two comments reading "`DesktopApplication` (not `DesktopApplication`)" — the reason the annotation exists became unrecoverable | Contrast term restored in both |
| RV-009 | 🟠 | Inserting `RoleOverrides` orphaned `ThemeOptions`' own JSDoc above it, leaving a public interface undocumented | Doc moved back onto the interface |
| RV-010 | 🟡 | `RoleOverrides` is inferable but unnameable — the sibling `overrides` option's type *is* on the barrel | **Accepted.** Widening the public type surface is not this phase's mandate, and it would drift the plugin API-ref snapshot. Callers pass literals |
| RV-011 | 🟡 | `Partial<Theme[K]>` newly admits an explicit `undefined`, which the spread wrote straight over the generated value — a realistic shape when a caller forwards optional config | Undefined-valued keys are filtered before the spread. Probed: `{ pattern: undefined }` now leaves `'░'` intact |
| RV-012 | 🟡 | The ST-3 rewrite moved the `test/`-exists check ahead of the exemption check, making `EXEMPT` unreachable | Exemption now gates on the typecheck script alone, so any package leaving the gate must be named. Each `ALLOWED_UNCHECKED` entry must also still exist *and* still be outside the program, so a stale allowance fails |
| RV-013 | 🟡 | `core/vitest.config.ts` still documented the removed switch — and repeated the misconception that made it look live | Rewritten; the other six configs gained the same one-line explanation |

> **Known flake, pre-existing:** `ui/test/editor-perf.spec.test.ts` ST-35 asserts a 16 ms wall-clock ceiling and fails intermittently when turbo runs packages in parallel on a loaded machine. It passes standalone and under `yarn verify --concurrency=1`, and it failed the same way before this phase. Not introduced here.

---

## Phase 2: The lockdown (#117-P4)

> **Reference**: [03-02](03-02-layout-field-lockdown.md) · **Routing**: sensitive (core engine)
> **Objective**: FR-5…FR-8, FR-12, FR-13. ~810 conversions, then the flip.

### Step 2.1 — Groundwork

- [x] 2.1.1 Re-derive the site inventory with a **comment-excluding** grep and record it. The documented counts are ≈; a delta found now is data, a delta found mid-phase is noise — *done 2026-07-20*. **843 sites / 337 files** against `(?<![=!<>])\.layout(\.rect)?\s*=(?!=)` with block and line comments blanked first. Of those, **13 are `spike-data-studio`** (inert: no build, no typecheck, and named as an allowed survivor by AC-3), leaving **830 to convert** against the plan's ~810. Per-batch delta:

| Batch | Plan | Measured | Δ |
|---|---|---|---|
| `ui/src` | 31 / 16 | 31 / 16 | — |
| `datagrid/src` | 12 / 5 | 12 / 5 | — |
| `docs-site` `src` + `examples` | 5 / 4 | 5 / 4 | — |
| `docs-site/**/*.md` | 16 | **17 / 15 files** | +1 |
| `theme-designer/src` | 4 / 4 | 4 / 4 | — |
| `examples/**` non-test | ≈55 / ≈27 | 55 / 27 | — |
| `ui/test` | 474 / 147 | **477 / 148** | +3 |
| `datagrid/test` | 167 / 75 | **166 / 75** | −1 |
| `forms/test` (31/10) · `files/test` (18/16) · `examples/test` (6/3) · `docs-site/test` (4/4) · `web/test` (3/3) · `theme-designer/test` (1/1) | | all exact | — |

The three `ui/test` and one `datagrid/test` deltas are churn since the survey, not a new shape. The extra `.md` snippet is `containers/scroller.md`, which carries two.
- [x] 2.1.2 Re-run the layout-object **holder** search (`= [A-Za-z.]*\.layout;` and `\.layout = <identifier>;`) across all packages **and** test dirs; record the inventory in AR-2. Known: `grid-panels.ts:201` is a module-level singleton aliased across every grid — *done 2026-07-20*, recorded as **EX-2** in the register. AR-2's inventory holds in full; the `fr` singleton is still aliased into three views per segment. **Two holders AR-2 does not list** turned up in `examples/kitchen-sink/stories` (`layout-dsl.story.ts:70`, `forms-showcase.story.ts:340`), both spreading `{ ...frame.layout, position, rect }` back onto the same view. Not aliasing hazards — the spread makes a fresh object — and both get *simpler* under conversion, since the spread only exists to emulate the merge `setLayout` performs natively
- [x] 2.1.3 Capture cell-exact baselines (glyph + fg/bg + attrs + width) for the 8 Phase-3 canvases at 80×24, against **pre-conversion** source. Captured here, not in Phase 3: task 2.2.6 converts these very files, and a baseline taken afterwards would bake any replace→merge regression into the "before" — *done 2026-07-20*, committed under [`baselines/`](baselines/) with a README stating the method and its limits. **6 of 8 captured**; two decisions were needed and are recorded as **EX-3** and **EX-4**. Capture is **glyph-level**, not cell-exact: `LayoutProps` is geometry-only (no colour, no attrs), so a replace→merge regression can only move, resize or clip a box — the fg/bg/attrs dimensions cannot report anything the glyphs miss, and no canvas exposes a mountable build export to hang a cell dumper on. Each of the five walkthroughs contributes **every frame it prints**, not one snapshot; `status-bar.story` is mounted at 80×24 through its `build(ctx)`. `playground` and `controls-live` `return 0` without a TTY (`main.ts:29`, `:68`) and have **no Phase-2 baseline** — deferred to 3.1.2, which already owns their witness question and must now account for the gap
- [x] 2.1.4 [spec-author] ST-9 — `applyMove` via the gesture path: rect updates and exactly one reflow. Express the "no separate `invalidateLayout()`" half as a scoped source grep, or drop it and rely on the reflow count — *done 2026-07-20* (`packages/ui/test/gesture-reflow.spec.test.ts`, two cases). The **source grep was dropped**: the reflow count subsumes it, because a conversion that left the old `invalidateLayout()` beside the new `setLayout()` calls `markRelayout` twice and the counter sees it. **Mutation-tested** — a second `invalidateLayout()` added to `applyMove` fails both cases (`expected 2 to be 1`, `expected 6 to be 3`); tree restored. Counted by wrapping the window's own `View.host` seam, not a render-root frame counter, which coalesces and cannot separate a reflow request from a repaint. Written **green, not red**: this is a preservation oracle for a refactor, not a spec for new behaviour, so the red-first ordering does not apply and dispatching an implementation-blind spec-author (which is contracted to report RED) would have been the wrong instrument. Scoped to the *move* gesture only — the resize gestures legitimately request a second reflow after `onResized()` (EX-5), and the test says so, so nobody generalizes "exactly one" to them

> ST-4 and ST-5 are **already committed** as ST-S1 (`view-setlayout.spec.test.ts:42`) and ST-S3
> (`:59`, `countingHost()` included). Record the equivalence; do **not** author duplicates into an
> immutable oracle. ST-6, ST-7 and ST-8 are deliberately deferred to Step 2.4 — see the note there.
>
> **Equivalence confirmed 2026-07-20** at the stated lines: ST-S1 *"setLayout merges, preserving props
> the patch does not name"* is ST-4, and ST-S3 *"setLayout on a mounted view calls markRelayout"* is
> ST-5, counting through the same `View.host` seam ST-9 uses. No duplicates authored. Two neighbours
> are load-bearing for this phase and worth naming: **ST-S2** pins the merge as *shallow*, which is
> what makes a `size` variant swap correct under `Object.assign`, and **ST-S9** pins an explicit
> `undefined` as a supported reset — the contract Rule 1a / AR-16 leans on at the three
> deliberate-erasure sites.

### Step 2.2 — Convert shipped source (~106 sites)

- [x] 2.2.1 `ui/src` wholesale writes (≈20 sites) — Rule 1 — *implemented 2026-07-20*: **21 sites**, all converted. Every target was checked for what the replacement was erasing, not converted blind. 18 write onto a view constructed on the spot, and no class among them declares an `override layout` initializer or calls `this.setLayout` in its own constructor (the 10 hatches are all elsewhere), so their layout is provably `{}` and merge is identical to replace. Two more restate their target's declared initializer exactly (`dropdown/popup.ts:240` against `PopupFrame`'s `{position:'absolute',padding:1}`; `menu/controller.ts:187` against `MenuPopup`'s `{position:'absolute'}`), so those are identical too. Two spreads that existed only to emulate a merge (`dropdown/popup.ts:244`, `router/router.ts:288`) collapse into a plain `setLayout` and their comments lose the now-meaningless "merge rather than replace" framing. `application.ts:437`'s paired `invalidateLayout()` collapses (Rule 2a). **Two sites needed the AR-16 erasure treatment and are not in AR-16's list — see EX-6**: `tabs/tab-view.ts:255` and `editor/edit-window.ts:115`. `ui` unit suite green, 1796/1796
- [x] 2.2.2 `ui/src` rect mutations (8) — Rule 2, **three-way**: collapse the pair only where one exists (`gestures.ts:43`, and any other write+invalidate pair with nothing between them); at the 4 sites carrying an `onResized()` (`gestures.ts:57,74`, `arrange.ts:18`, `window.ts:205`) replace **only the raw write** and leave `onResized()` and `invalidateLayout()` where they are — see **EX-5**, which corrects this task: the previously-prescribed `onResized()`-first order reads a stale rect; plain rewrite at `edit-window.ts:78`, which has no invalidate — *done 2026-07-20*: 8 exactly, split 3/4/1. **Collapsed the pair** at `gestures.ts:42` (`applyMove`) and at both branches of `window.ts` `zoom()`, whose single trailing `invalidateLayout()` served two writes; ST-9 covers the first and holds at exactly one reflow per pointer sample. **Kept all three statements** at `gestures.ts:57,75`, `arrange.ts:18` and `window.ts:205` per EX-5. **Plain rewrite** at `edit-window.ts:78`, pre-mount with no invalidate to collapse. `ui` unit suite green, 1796/1796; the package has no e2e project
- [x] 2.2.3 `datagrid/src` (12; 8 in `grid-panels.ts`). Note `grid-panels.ts:201`'s shared `fr` singleton — the conversion de-aliases it, which is the point, not a side effect — *done 2026-07-20*: 12 exactly, 8 in `grid-panels.ts`. Ten are plain Rule 1 onto views built on the spot (no class in `datagrid/src` declares a layout initializer, so each starts empty and merge equals replace); the other two are the AR-16 sites in 2.2.4. The `fr` singleton is de-aliased as designed — after the flip `setLayout` copies its props into each view's own object, so `header`/`band`/`body` no longer share one `LayoutProps` across every grid in the process. `datagrid` unit suite green, 689/689
- [x] 2.2.4 **Rule 1a / AR-16** — the 3 deliberate-erasure sites, converted with the discarded props named as explicit `undefined`: `app/application.ts:334`, `datagrid/src/overlay.ts:129`, `datagrid/src/editing.ts:233`. Behaviour must not change; two are public customization seams — *done 2026-07-20*, and **the site count is 5, not 3** (see EX-6). The named three converted as prescribed; `ui/src/tabs/tab-view.ts:255` and `ui/src/editor/edit-window.ts:115` needed the same treatment and were not in the list. Every one writes onto a **caller-supplied** view — a tab page, a hosted `Editor`, a `filterPopup` result, a `createCellEditor` result, or `createApplication`'s `content` — which is exactly why letting them merge would have been a silent behaviour change on a public seam. `overlay.ts` keeps reading `view.layout` *before* the write to honour a size the caller chose, so that seam is unaffected. A sixth candidate, `theme-designer/src/app.ts:306`, turned out **not** to be one (EX-7)
- [x] 2.2.5 `docs-site` `src` + `examples` (5) · `theme-designer/src` (4) — *done 2026-07-20*: 9 exactly. All five `docs-site` sites are `.layout.rect =` on a `Window`, which was already a merge, so those are plain rewrites. In `theme-designer`, two of the four are inside the package's own `at()` helpers (`view/gallery.ts:33`, `view/inspector-panel.ts:56`) — the name shadows Phase 3 task 3.2.5 retires entirely; converting the write now moves them toward the DSL `at()`'s merge semantics, which is where 3.2.5 takes them anyway. `app.ts:306` converts plainly per EX-7 and its comment loses the wholesale-vs-merge framing
- [x] 2.2.6 `examples/**` non-test (≈55 across ≈27 files), including the 9 raw-spine teaching sites which convert but **stay absolute** (AR-8). Re-render the 8 canvases against 2.1.3's baseline and record the diff — *done 2026-07-20*: **55 across 27 files**, exact. 50 converted mechanically; the 5 left over were all `{ ...x.layout, … }` spreads that existed only to emulate a merge, so each collapses to a plain `setLayout` — two of them (`layout-dsl.story.ts`, `forms-showcase.story.ts`) also shed a `LayoutProps` intermediate and its now-unused import. The AR-8 teaching sites in `view-demo/main.ts` (7) and `layout.story.ts` (2) convert and stay absolute, as decided. **Render control: all 6 capturable canvases are byte-identical to the 2.1.3 baseline** — zero delta from the conversion
- [x] 2.2.7 The 16 `packages/docs-site/**/*.md` snippets that teach `view.layout = …` (FR-13). Optional guard: assert no fenced `ts` block contains `.layout =` — *done 2026-07-20*: **17**, not 16 (`containers/scroller.md` carries two — see EX-1). 16 are fenced code; the 17th is inline prose in `controls/button.md:87`. **The guard was taken**, added to the existing `docs-site/test/snippet-drift.spec.test.ts` rather than a new file, and **mutation-tested** — restoring one snippet fails it by name and line. A doc snippet is the one teaching surface no compiler reads, so without it a stale snippet would sit there teaching a dead idiom until a reader tried it

### Step 2.3 — Convert tests (704 sites)

> Per AC-6 these are mechanical **setup** rewrites, not oracle changes. Nothing a spec test asserts
> may change; 152 spec files are touched this way and that is expected, not a violation.

- [x] 2.3.1 `ui/test` — 474 sites / 147 files, by directory batch — *done 2026-07-20*: **477 / 148** (EX-1). Converted in one mechanical pass rather than by directory batch: the rewrite is a single deterministic substitution the compiler checks in full, so splitting it would have produced four identical reviews of the same edit. Two files were held back and handled by hand — `view-setlayout.impl.test.ts`, whose ST-I1/ST-I4 assert the *replace* contract that 2.4.4 inverts (setup converted, assertions untouched), and the four files in EX-9
- [x] 2.3.2 `datagrid/test` — 167 / 75 — *done 2026-07-20*: **166 / 75** (EX-1). Four needed hand conversion: two multi-line setups that deliberately seed a caller layout to prove the AR-16 erasure (`custom-editor-layout.spec.test.ts:92`, `overlay-contract.spec.test.ts:46` — both convert as setup, and both still prove the erasure, now against the explicit-`undefined` reset), one spread-merge, and `kitchen-sink/story.ts:56`, the parameter alias AR-2 lists as a holder
- [x] 2.3.3 `forms/test` (31) · `files/test` (18) — *done 2026-07-20*: both exact. Every one of the 7 `files` spread-merges (`dlg.layout = { ...dlg.layout, rect }`) collapses to a plain `setLayout({ rect })`
- [x] 2.3.4 `examples/test` (6) · `docs-site/test` (4) · `web/test` (3) · `theme-designer/test` (1) — *done 2026-07-20*: all exact. Two of the `examples` six are **string literals fed to `jsvision-doctor`**, not code — they are the doctor's fixture for the retired idiom and stay verbatim. Probing them surfaced **EX-8**: the doctor's window exception only recognized the assignment form, so it flagged `win.setLayout({ position: 'absolute', … })` while passing the identical old spelling. Fixed and pinned

### Step 2.4 — Flip

> ST-6/ST-7/ST-8 are authored **here**, not at the head of the phase. An unused `@ts-expect-error`
> is `TS2578` — a hard compile error — and `turbo`'s `test → build` dependency means it aborts the
> whole verify run. Authored early they would leave every task in 2.2/2.3 unable to verify: exactly
> the condition AR-7 rejected. Keep author → red → flip → green inside this step.

- [x] 2.4.1 [spec-author] ST-6, ST-7, ST-8 — the identity contract and the **type-level** ratchet. Observe them red against the pre-flip field — *done 2026-07-20* (`ui/test/view-layout-readonly.spec.test.ts`). **Observed red at both levels**: all four `@ts-expect-error` directives reported `TS2578` *unused* — which is the ratchet proving itself, since it means the field really was open, through `Window`'s override as well as on the base class — and ST-6 failed on identity (`expected { direction: 'col', padding: 1 } to be { direction: 'col' }`). Authored here rather than at the head of the phase, per AR-7: an unused directive is a hard compile error, so authoring early would have left every task in 2.2/2.3 unable to verify
- [x] 2.4.2 `view.ts`: `readonly layout: Readonly<LayoutProps>` + `setLayout` on `Object.assign` — *done 2026-07-20*. The field's own JSDoc is rewritten: it described a hazard (a wholesale write dropping props and never reflowing) that the compiler now prevents, so it states the contract instead
- [x] 2.4.3 The 10 subclass hatches → `override readonly layout: Readonly<LayoutProps>` — *done 2026-07-20*: 10 exactly, across 9 files. **`turbo run typecheck` went green on the first attempt, 15/15 tasks** — no conversion was missed anywhere in the repo, which is the return on Phase 1 plus Steps 2.2/2.3
- [x] 2.4.4 Correct the superseded contract: invert ST-I1's identity assertion and delete ST-I4 in `ui/test/view-setlayout.impl.test.ts`, one recorded verdict each — *done 2026-07-20*. **These two were the only runtime failures in the entire repo after the flip** — 2 failed / 1797 passed — which is itself the evidence that the identity change bit nothing unmeasured. Verdicts:

| Test | Verdict |
|---|---|
| ST-I1 *"setLayout({}) preserves the props, replaces the object, and invalidates"* | **Inverted, not deleted.** Only its identity clause is superseded; `not.toBe` becomes `toBe` and the title follows. The load-bearing clause — an empty patch still costs one reflow — is unchanged and still passes, because `setLayout` does not inspect the patch to decide |
| ST-I4 *"setLayout replaces the layout object rather than mutating it"* | **Deleted.** The whole test asserted the replace contract, and its own comment justified it by the `view.layout.rect = …` sites this phase removed — so its stated reason to exist is gone with them. Its inverse is not lost: ST-6 in `view-layout-readonly.spec.test.ts` pins in-place mutation as a *spec* oracle, which is the stronger home for it |
- [x] 2.4.5 **FR-13** — rewrite the 3 shipped `@example` blocks that assign `layout.rect` (`window/window.ts:73`, `app/application.ts:316`, `desktop/desktop.ts:58,63`) to `setLayout({ rect })`, then re-verify `jsdoc-examples.allowlist.json`: `Desktop` is listed as `codes:[2322]` exactly and may now be stale — *done 2026-07-20*: 4 assignments across the 3 blocks. **The `Desktop` allowlist entry is not stale and needs no edit** — its recorded `TS2322` is a `Platform` mismatch on `process.platform`, unrelated to layout, so the block still fails with exactly the recorded code. The ratchet passes untouched, 12/12
- [x] 2.4.6 **FR-13** — rewrite the shipped prose that describes wholesale assignment as live: `view.ts:68-73` (the field's own JSDoc) and `:222`, `split-view.ts:144,185`, `dsl/{absolute,flex,index}.ts`, `ui/src/index.ts:52`, `demo-shell.ts:233` — *done 2026-07-20*: 9 passages. Each stated a hazard as live (*"unlike a hand-rolled `view.layout = { … }` that would drop them"*, *"a caller assigning `split.layout` … can never clobber"*); all now describe the behaviour without contrasting against an idiom that no longer exists. The one surviving mention is in `view.ts:72`, where naming the closed spellings **is** the contract
- [x] 2.4.7 `yarn plugin:sync --fix` + commit — the API-ref snapshot records `layout: LayoutProps` in 5 rows and `check-plugin` fails verify without this. Deterministic, no API key; `--detect` does not catch it — *done 2026-07-20*: **5 rows across 4 pages**, exactly as predicted, all `layout: LayoutProps` → `layout: Readonly<LayoutProps>`
- [x] 2.4.8 ST-6/ST-7/ST-8 and ST-12 go green — *done 2026-07-20*: **`yarn verify` 30/30 plus `check-plugin` PASS**. ST-6/7/8 green (the four `@ts-expect-error` directives are now all used, so the fixture compiles only because the errors are real); ST-12 green via `jsdoc-examples.spec.test.ts` and `check-plugin`

### Step 2.5 — Accept

- [x] 2.5.1 **AC-3** widened grep (`packages/*/src packages/*/test packages/examples packages/docs-site/{examples,components}`): 0 hits outside comments, `spike-data-studio` and `setLayout`'s body. Enumerate the surviving prose matches — *done 2026-07-20*. **The grep was widened again, to include comments**, and that caught one the phase had missed: `examples/matrix-rain/matrix-rain.ts:23`, an `@example` block. The inventory grep blanks comments by design (so prose does not inflate the count), which made every JSDoc code sample invisible to it — and `examples/` is outside the `packages/*/src` scope of the `@example` ratchet, so nothing else would have caught it either. Converted. The surviving matches, all intentional:

| Survivor | Why it stays |
|---|---|
| `spike-data-studio/src` ×13 | AR-6 — inert package, no build/test/typecheck, awaiting deletion |
| `ui/src/view/view.ts:254` | `setLayout`'s own body: the one blessed writer |
| `ui/src/view/view.ts:72` | The field's JSDoc, where naming the closed spellings **is** the contract |
| `ui/test/view-layout-readonly.spec.test.ts:13` | The oracle's own header, explaining why the subclass case is not redundant |
| `examples/test/jsvision-doctor.spec.test.ts:43,46` | String literals fed to the footgun linter — its fixture for the retired idiom, not code |
- [x] 2.5.2 **AC-5** — `turbo run typecheck` green with the flip in place, **plus** `tsc --listFiles` proving each package's config resolves its `test/`. Record the two surfaces this cannot cover (`spike-data-studio`; any package still lacking a `test/`-inclusive config) — *done 2026-07-20*: `turbo run typecheck` **15/15**, and every one of the 9 packages resolves its own `test/` — **745 test files in the compiler**:

| Package | Files in program | Under `test/` | Config |
|---|---|---|---|
| `ui` | 489 | 318 | `tsconfig.typecheck.json` |
| `examples` | 256 | 56 | `tsconfig.json` |
| `core` | 182 | 125 | `tsconfig.typecheck.json` |
| `datagrid` | 167 | 126 | `tsconfig.typecheck.json` |
| `docs-site` | 56 | 40 | `tsconfig.json` |
| `files` | 53 | 34 | `tsconfig.typecheck.json` |
| `forms` | 32 | 22 | `tsconfig.typecheck.json` |
| `theme-designer` | 28 | 11 | `tsconfig.json` |
| `web` | 21 | 13 | `tsconfig.typecheck.json` |

Surfaces this cannot cover: **`spike-data-studio`** (no typecheck script at all — named as exempt in the ST-3 oracle, so removing a script elsewhere would fail rather than silently un-gate), and **the 2 `datagrid` files** in `ALLOWED_UNCHECKED`, which import a `.ts` helper from `core/test` by workspace-relative path — a genuine cross-package `rootDir` violation, still covered by vitest. Both are named allowances the ST-3 oracle re-checks each run: an allowance whose file no longer exists, or that is no longer needed, fails
- [x] 2.5.3 Full verify — including `jsdoc-examples.spec.test.ts` and `check-plugin` — *done 2026-07-20*: `yarn verify` **30/30 turbo tasks**, `jsdoc-examples` 12/12, `check-plugin: PASS — all integrity checks green`

**Verify**: `yarn verify`

### Phase 2 quality review

Dispatched in parallel on the phase diff (`3c888fb8..4f1f3582`): the phase reviewer (correctness ·
maintainability · standards · **api-surface**) and, because the profile sets `perf_critical`, a
separate perf auditor.

**Perf: no findings** — and measured rather than asserted. `Object.assign` is **25–35% cheaper per
call than the spread it replaced** (73.9 → 54.8 ns for a 1-key patch; 264.7 → 172.3 ns for an 8-key
one) and allocates one fewer object. No reflow request was added to any per-frame or per-pointer
path — every converted site already had one pending. `packages/core/src` is untouched, so the 16 ms
frame bench measures nothing this phase changed. The audit independently confirmed task 2.2.3's
aliasing claim: the shared `LayoutProps` singleton in `grid-panels.ts` *would* have become a live
cross-grid hazard under in-place semantics, and the conversion closed it first.

**Correctness: 6 findings, 2 🟠 and 4 🟡, all resolved.** The reviewer re-ran typecheck (15/15) and
the `ui` suite (1798/1798), re-derived the residue grep, audited all 5 erasure sites against the
8-prop interface, checked the EX-5 ordering at all four sites, and script-scanned every converted
site in the **pre-phase** tree for a receiver whose layout was non-empty. It found **no
replace→merge regression and no weakened spec assertion**.

| # | Sev | Finding | Resolution |
|---|---|---|---|
| RV-001 | 🟠 | The agent-facing plugin skill tree still taught the retired idiom as live at 8 hand-written sites — while this same phase regenerated the API-ref half of that tree, leaving it self-contradictory. AC-3's grep scoped to `packages/*`, so it was never swept | All 8 converted. The snippet guard now covers `tools/claude-plugin/skills/**/*.md` as well, scans **whole pages** rather than only fenced blocks (half the offenders were inline prose), and its pattern was tightened from `\.layout(\.\w+)* = ` to `\.layout(\.\w+)*\s*=[^=]`, which the old one would have missed as `.layout={`. **Mutation-tested against both gaps** |
| RV-002 | 🟠 | The 5 erasure seams hand-enumerated all 8 `LayoutProps` props as explicit `undefined`, five times, with nothing tying the lists to the interface. A 9th prop would silently flip all five from *erase* to *inherit* — on five **public** customization seams — and no test would fail, since `justify`/`align`/`gap` were already unguarded | A `CLEARED_LAYOUT` mapped over `Required<LayoutProps>`, declared once per package (internal to each — no public surface widened, consistent with the Phase-1 RoleOverrides ruling). **Mutation-tested**: adding a 9th prop now fails to compile at exactly two named places |
| RV-003 | 🟡 | `Readonly<LayoutProps>` is shallow, so `view.layout.rect.x = 5` still compiled — the exact hazard the new JSDoc presented as closed. `Window.currentRect(): Rect` handed a mutable alias to every subclasser | `rect?: Readonly<Rect>` and `currentRect(): Readonly<Rect>`; the oracle gained the deep case. Verified free — 15/15 typecheck green |
| RV-004 | 🟡 | The comment justifying `Object.assign` gave a **wrong reason**: `reflow()` rebuilds the `LayoutBox` tree every pass, so no box outlives a write and the aliasing it warned about cannot happen | Restated as the real reason — the field is read-only, and identity is the ST-6 contract. A wrong *why* is worse than none |
| RV-005 | 🟡 | `theme-designer/src/app.ts` still called `workspace.invalidate()` beside a `setLayout` that now relayouts — the Rule-2a collapse missed because the trailing call was `invalidate()`, not `invalidateLayout()` | Deleted |
| RV-006 | 🟡 | Six sites read `setLayout({ rect: rect })`; lint does not catch it (`object-shorthand` is off) and the Phase-3 sweep would copy it forward | Shorthand at all six |

**Perf observation acted on.** The auditor read the four EX-5 trailing `invalidateLayout()` calls as
leftover tidiness — the exact misreading that would delete them, from the exact kind of reader that
would. They are load-bearing: `setLayout`'s own reflow fires *before* `onResized()` re-pins, so the
trailing call is the one that schedules a pass seeing the re-pinned children. All four now say so.

**Perf observation recorded, not acted on.** `reflow.ts:78` stores `view.layout` by reference, so
in-place mutation is now visible to an in-flight solve. Unreachable today (`firePendingMounts` runs
after `layout()` returns), but a real seam for whoever adds a `measure()` that writes layout.

**Re-review of the fix diff** (`4f1f3582..80ab9f7f`) — 4 further findings, all resolved. It confirmed
the five `CLEARED_LAYOUT` seams are prop-for-prop equivalent to the hand lists they replaced, that the
constant is absent from both public barriers, that the `Readonly<Rect>` narrowing is free, and that
the new `@ts-expect-error` is genuinely load-bearing.

| # | Sev | Finding | Resolution |
|---|---|---|---|
| RV-007 | 🔴 | The fix diff edited **three long-standing spec oracles** purely to apply RV-006's object shorthand. No assertion changed, but AR-15's allowance covers rewrites *required to keep compiling*, and a style nit is not one — as the reviewer put it, nothing required touching an oracle to satisfy a shorthand nit | **The three reverted.** The shorthand stays only where it was legitimate (`matrix-rain/main.ts` in shipped source, and the impl test). Two further spec files in the diff are **not** oracle mutation and are recorded as such: `view-layout-readonly.spec.test.ts` was authored *this phase* at `9bf6c009` (task 2.4.1), and the widened test in `snippet-drift.spec.test.ts` is one added this phase in 2.2.7 — that file's pre-existing test is untouched |
| RV-008 | 🟡 | The four "not redundant" comments added after the perf audit **state a mechanism that is false**: a reflow request only sets a coalesced flag, so under the default `queueMicrotask` scheduler the pass runs after the whole handler and already sees the re-pinned children. Same defect class as RV-004 — a claim planted to stop a deletion, which a reader who checks it will find untrue | Restated with the scheduler dependency made explicit. The claim holds **only** under a synchronous scheduler, which is what several suites install (`view.occlusion.impl`, `layout-dsl.spec`) — there `setLayout`'s request flushes inline, before the re-pin, and the trailing call is what schedules the pass that sees it. EX-5's *decision* is unaffected; only its in-code justification was overstated |
| RV-009 | 🟡 | The guard's `/references/api/` exemption used a hard-coded `/`, so it never fires on win32 — and CI runs the docs-site project on the Windows matrix. Latent: the day the generated API ref picks up `View.layout`'s JSDoc (which names the closed spellings verbatim), the suite would pass on Linux and fail only on Windows | Separators normalized before the test. The header now also states that this exemption is the **only** escape hatch, since whole-page scanning means no teaching page can show the assignment even as a labelled anti-pattern |
| RV-010 | 🟡 | Two more mutable-rect launder points the RV-003 narrowing left open — `gestures.ts:24` and `menu/controller.ts:155` both re-widen the live `layout.rect` to a mutable `Rect`, which TypeScript will not flag. Neither is mutated today, but they defeat the invariant the new JSDoc advertises, inside `ui/src` | Both annotated `Readonly<Rect>`. Free — typecheck stays 15/15 |

---

## Phase 3: Canvas adoption (#129)

> **Reference**: [03-03](03-03-canvas-adoption.md) · **Routing**: standard, but design-heavy
> **Objective**: FR-9…FR-11. 18 sites / 8 canvases + 5 shadows.

### Step 3.1 — Baselines

- [x] 3.1.1 Re-capture the 8 canvases and diff against **2.1.3's pre-Phase-2 baseline**; record the Phase 2 delta per canvas before changing anything further — *done 2026-07-21*. All 6 capturable canvases re-render **byte-identical** to the baseline, re-confirming 2.2.6's zero delta on a clean tree. The 2 witness-less canvases are proven zero-delta at the layout level instead of the pixel level (EX-11): a replace→merge swap can only differ where the target's layout was non-empty in a prop the write omits, and neither has such a site
- [x] 3.1.2 Decide the witness question for `playground` and `controls-live` — *done 2026-07-21* (EX-10). **`controls-live/form.ts` → mount harness + convert** (`buildDialog()` is exported and un-gated; its `Dialog` mounts at 58×19, baseline committed as `baselines/controls-live-form.txt`); **`playground` → left absolute**, both sites being a `Window` placement RD-01 keeps absolute and a lone `Text` inside it. **Phase 3 therefore converts 16 sites, not 18.**
- [x] 3.1.3 [spec-author] ST-10, ST-11 — ST-11 scoped to files that **import** the shadowed builder — *implemented + red 2026-07-21* (`packages/examples/test/dsl-name-shadows.spec.test.ts`). ST-10 is not a test file: 07's own wording makes it a recorded per-canvas render verdict, which task 3.3.1 executes. ST-11 is the automated half, and it found a **6th shadow** AR-10 does not list — `examples/recipes/data-grid.ts:67` (**EX-12**), the only one that meets AC-7's criterion literally. Comment-blanking is load-bearing, not hygiene: the DSL modules' own `@example` blocks import the very builders they define, so an unblanked scan reports all 14 definitions as shadows of themselves

### Step 3.2 — Convert

- [x] 3.2.1 `dropdowns-demo` (6) — largest; per-file judgment on what is structurally flex — *done 2026-07-21*. All 6 converted: each step's `controls` becomes `col({ padding: 1 }, fixed(row(…), 1))`, the outer col fixing the row's height because neither `Input` nor `History` measures itself. **Explained delta, accepted (EX-13):** the field controls now paint. They never did — the old `controls` group held only absolute children, measured `0×0`, and was clipped away, so every frame of all four steps showed an empty field. The converted output lands on exactly the cells the old rects named
- [x] 3.2.2 `containers-demo` (5) — *done 2026-07-21*. The Scroller's 20 content lines become a `col` of `fixed(…, 1)` rows (**byte-identical**); the dialog becomes a `col` of a labelled-field row, a spacer, and a centred button row. **One accepted delta:** the buttons sit 2 cells left of before, because `justify:'center'` centres them for real and the hand-computed rects had them off-centre by 2 in a 32-cell content box
- [x] 3.2.3 `playground` (2) · `themes-demo` · `color-demo` · `date-demo` · `controls-live` · `status-bar.story` (1 each) — *done 2026-07-21*. **Converted, all byte-identical:** `themes-demo:63` → `cover(widgets)` (the rect merely restated the render-root size); `status-bar.story:47` → `at(bar, …)`, whose own comment said `at()` *"would drop the row direction"* — true under replace, no longer true under merge, so the workaround the lockdown obsoleted is gone; `controls-live/form.ts` → the whole 15-rect table becomes a `col` of rows, verified through the 3.1.2 harness. **Left absolute:** `playground` (2, EX-10) and `color-demo`/`date-demo` (2, EX-14) — one widget at one rect beside a `fill` overlay, where a padded wrapper would inset the popup too
- [x] 3.2.4 Confirm `tabs-demo` carries 0 sites and needs no conversion — *confirmed 2026-07-21*, `grep -c setLayout tabs-demo/*.ts` → 0
- [x] 3.2.5 The 2 `theme-designer` shadows — real conversions; call sites become `g.add(at(v, …))` — *done 2026-07-21*. 36 call sites across `gallery.ts` (19) and `inspector-panel.ts` (17); both local helpers deleted, `at` now imported from `@jsvision/ui`. The plan expected `inspector-panel` to have no witness, but the gallery walkthrough is one for `gallery.ts`, and stash-diffing the whole designer walkthrough before/after is **byte-identical** — the local helper did `setLayout` then `add` in the same order the DSL form does
- [x] 3.2.6 The 3 examples shadows + the 4th found at 3.1.3 (`recipes/data-grid.ts:67`, EX-12) — *done 2026-07-21*. `keyboard-mouse-playground:126` `row` → `readoutLine`; `amiga-clock/analog-clock.ts:70` `at` → `plot` (it plots a polar point, so the old name collided on spelling only); `layout.story:30` `row` → `rowBox`; `recipes/data-grid.ts:67` `col` → `column`, which also drifted the plugin recipe snapshot and needed `yarn plugin:sync --fix` — `keyboard-mouse-playground:126`, `analog-clock:70` (a polar helper, not a placer), `layout.story:30` (a rename)

### Step 3.3 — Accept

- [x] 3.3.1 Re-render; **a recorded verdict per canvas** — *done 2026-07-21*:

  | Canvas | Sites | Verdict |
  |---|---|---|
  | `dropdowns-demo` | 6 conv. | **Explained delta, accepted** — the field controls now paint at all (EX-13) |
  | `containers-demo` | 5 conv. | **One explained delta, accepted** — the button pair is now genuinely centred; everything else byte-identical |
  | `themes-demo` | 1 conv. | **Byte-identical** |
  | `status-bar.story` | 1 conv. | **Byte-identical** |
  | `controls-live/form` | 1 conv. | **Byte-identical** — through the harness built at 3.1.2 |
  | `theme-designer` | 36 shadow sites | **Byte-identical** — full walkthrough stash-diffed before/after |
  | `color-demo` · `date-demo` | 2 kept | **No render diff — not converted** (EX-14) |
  | `playground` | 2 kept | **No render diff — not converted** (EX-10) |
  | `tabs-demo` | 0 | Nothing to convert (3.2.4) |
- [x] 3.3.2 AC-7 grep, scoped to files importing the shadowed name: no local binding shadows a DSL builder it imports — *done 2026-07-21*. ST-11 is green across all packages, and a direct grep for module-level `at`/`row`/`col`/`center`/`place`/`stack` bindings in `examples` + `theme-designer` returns only the harmless kind PF-020 catalogued (files that never import the builder they happen to spell)
- [x] 3.3.3 Full verify — *done 2026-07-21*. `TURBO_CONCURRENCY=2 yarn verify` exit 0 (30/30 tasks), `check-plugin: PASS`

**Verify**: `yarn verify`

### Phase 3 quality review (2026-07-21)

Reviewer + perf auditor dispatched in parallel on `git diff cc7a39ae`. Spec-test integrity clean —
no pre-existing `*.spec.test.*` touched; the only spec file in the phase is the newly added oracle.

| # | Sev | Lens | Finding | Ruling |
|---|---|---|---|---|
| RV-001 | 🟠 | standards | **The phase introduced two shadows of the kind it exists to retire.** `dropdowns-demo:44` and `containers-demo:54` both hold `for (const row of rows)` in `printFrame`, and the conversion added `row` to those files' imports — so `row` means the flex builder on the import line and a buffer row twenty lines down. The 3.3.2 grep missed them because it looked for *module-level* bindings | **Fixed** — renamed to `line` in both |
| RV-002 | 🟠 | correctness | **The new guard was green with those shadows in the tree.** Two gaps: the declaration regex was anchored at line start, exempting `for`-loop bindings (the dominant shadow shape); and only the bare `@jsvision/ui` specifier was matched, so all of shipped `ui/src` — which imports the DSL relatively — was unguarded | **Fixed, per the maintainer's ruling** — anchor dropped, `class` added, relative `…/view/dsl/…` specifiers matched. Surfaced one pre-existing shadow, `ui/src/tabs/tab-view.ts:157` `for (let col = …)`, renamed to `x`. Parameter/destructuring shadows stay out of scope and the docstring now says so: the regex heuristic tried first false-positived on two test *titles*, so catching them needs a parser, and a guard that never cries wolf plus an honest limit beats a green that reads broader than it is |
| RV-003 | 🟡 | maintainability | `DSL_BUILDERS` is a hand-copied duplicate of the DSL barrel — correct today, but nothing fails when the DSL gains a builder | **Fixed** — a companion test pins the list to the barrel's value exports |
| PE-001 | 🟡 | perf | The guard comment-strips all ~1294 sources, then discards ~72% one line later; 121 ms of a 173 ms body | **Fixed** — cheap `includes` prescreen first; test body 193 ms → 130 ms |
| PE-002 | 🟡 | perf | `containers-demo`'s `Scroller` content became an `auto` flow child, so the 20-row column is intrinsically measured on every reflow where it was O(1) before | **Fixed** — the column carries an explicit size matching the `extent` declared two lines below. Not a problem at 20 rows, but the demo is now the reference for that shape |

Both new assertions were **mutation-tested, not assumed**: re-injecting the loop shadow fails with
`dropdowns-demo/main.ts:44 — local 'row'`, and deleting one builder from the list fails the barrel
check.

**Recorded for whoever touches the layout engine next** (out of scope here, no action taken).
`measure.ts:76` calls `naturalSize(child)` for every flow child, including a `fixed` one whose main
size is already known. The *main* result is then discarded — but the *cross* result is not: it feeds
`crossExtent = max(…)`, which becomes the container's own natural cross size. The real shape is that
`naturalSize` computes both axes while each of its two callers uses exactly one (`solveMainSizes`
takes `mainOf`, `crossPlacement` takes `crossOf`), so an axis-aware measure would skip the recursion
rather than a `fixed`-child special case.

**Measured effect today: none.** Instrumenting the built engine and mounting all 49 kitchen-sink
stories plus `controls-live/form` yields **7 `naturalSize` calls in total, 3 `measure()`
invocations, and 0 of the redundant kind**. The path is nearly unreachable here because the codebase
sizes explicitly — `solveMainSizes` only measures an `auto` child, and `crossPlacement` short-circuits
under the default `align:'stretch'` — so the redundant call fires only once you are already inside an
`auto` container. The one such container in this phase was `containers-demo`'s 20-row Scroller
content (~21 calls and 20 `Text.measure` per reflow), and giving it an explicit size removed it.

**Process note.** Reverting a one-line mutation with `git checkout <file>` discarded the whole
`dropdowns-demo` conversion. Caught, re-applied, and confirmed faithful by diffing against the
recorded after-render (byte-identical). The remaining mutation test used a file copy. This is the
second time in this plan that `git checkout` on a dirty tree cost work.

---

## Phase 4: Close-out

> **Routing**: trivial

- [x] 4.1.1 Close #132, #117, #129 with measured close-out comments; note #131 remains open as the uncoupled lane — *done 2026-07-21*, with one deviation put to the maintainer and ruled on: the three issues are **commented, not closed**. The work is 78 commits ahead of `develop` and unmerged, and every prior plan in this epic closed its issues through a PR to `develop` (#96, #123, #125, #127, #130); closing them here would mark shipped what has not shipped — the exact drift a tracker audit already caught once in this epic. They close on the merge of **PR #133** (`feat/dsl-adoptation` → `develop`), whose body carries `Closes #132/#117/#129/#108`; `origin/develop` was merged in first and `yarn verify` re-run green on the merged tree. #131 untouched: the `@example` allowlist drain is a separate lane and does not gate the epic
- [x] 4.1.2 Roadmap sync + portfolio cascade; the epic #108 umbrella can close once #117 and #129 do — *done 2026-07-21*. Feature roadmap: #117 🔄 → ✅, new ✅ rows for #132 and #129, #108 ⬜ → 🔄 (**code-complete in-branch, closes on merge**), progress 11/12 → 12/12 in-branch. Portfolio `codeops/00-roadmap.md` re-rolled with the three-issue result. Stage is deliberately *not* ✅ on the epic: the work sits 78 commits ahead of `develop` and unmerged, and the roadmap should not read done for code that has not shipped
- [x] 4.1.3 `yarn lint:fix`, commit what it changes, final `yarn verify` (prime directive) — *done 2026-07-21*. `yarn lint:fix` run before each PR-bound push and its changes committed; final `TURBO_CONCURRENCY=2 yarn verify` exit 0 (30/30), `check-plugin: PASS`

**Verify**: `yarn verify`

### CI follow-up (2026-07-21) — a warm-tree blind spot in the local verify

**PR #133 failed all 12 matrix jobs on `@jsvision/files:typecheck`:**
`test/files.packaging.spec.test.ts` — `Cannot find module '@jsvision/files'`.

Root cause is a direct consequence of Phase 1. Making every package typecheck its own `test/` brought
`files.packaging.spec.test.ts` into the program, and that file imports **its own package by name** —
deliberately, because a packaging spec exists to prove the barrel resolves the way a consumer sees
it. Resolving `@jsvision/files` goes through `package.json#exports` to `dist/`, but `turbo.json` had
`typecheck.dependsOn: ["^build"]`, which builds a package's **dependencies** and not the package
itself. `files` is a leaf that nothing else depends on, so nothing ever built it first.

**It passed locally only because the working tree had a stale `dist` from an earlier build.** No
number of `yarn verify` runs on a warm tree could have caught it; `mv packages/files/dist` away
reproduces it exactly. Three other packages (`core`, `ui`, `web` — 35 test files) carry the same
latent dependency and were saved only by build ordering that happens to run them first.

**Fix:** `typecheck.dependsOn: ["^build", "build"]`. General rather than a per-package override,
since the shape is repo-wide. Verified from a fully cold tree (`rm -rf packages/*/dist .turbo`):
typecheck 15/15, `yarn verify` 30/30, and a forced `--filter=@jsvision/files` run shows `files:build`
now sequenced ahead of `files:typecheck`.

**The lesson for the prime directive:** "run `yarn verify` before the PR-bound push" is necessary but
not sufficient — it validates the tree you have, not the tree CI checks out. A cold-tree run belongs
in the pre-PR ritual for any change that alters what the compiler is allowed to see.

---

## Dependencies

```
Phase 1  (#132 — the instrument: without it Phase 2 measures 57 of 113)
    ↓
Phase 2  (#117-P4 — compiler-driven; ~810 conversions, the doc migration, then the flip)
    ↓
Phase 3  (#129 — design work, wants both the compiler and the render control behind it)
    ↓
Phase 4  (close-out)
```

Phase 3 has no hard technical dependency on Phase 2, but runs after it so only one surface moves
at a time and so its canvases are already compiler-covered.

## Risk register

| Risk | Phase | Mitigation |
|---|---|---|
| Test typechecking surfaces more than 229 errors | 1 | Measured with the exact datagrid pattern; a delta is a finding, not a surprise |
| ~810 edits swamp review | 2 | Batched by directory; each batch verifies and commits independently |
| A site relied on wholesale replacement erasing a prop | 2 | The 3 known sites are named and decided (task 2.2.4 / AR-16), not left to be noticed |
| The flip breaks something that is not a type error | 2 | Tasks 2.4.4–2.4.7 cover the four: the `@example` ratchet, the plugin snapshot, the two identity impl tests, and the doc snippets |
| A shared `LayoutProps` object is mutated for every holder | 2 | Task 2.1.2 re-runs the holder search; `grid-panels.ts:201` is known and de-aliased by its conversion |
| A canvas is not structurally flex | 3 | It may stay absolute — record why; the compiler cannot decide this |
| `readonly` silently dropped later | — | ST-7/ST-8 are the only guard; runtime tests cannot catch it |
