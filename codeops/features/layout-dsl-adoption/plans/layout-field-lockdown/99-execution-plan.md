# Execution Plan: layout-field-lockdown

> **Parent**: [Index](00-index.md)
> **CodeOps Skills Version**: 3.11.0
> **Last Updated**: 2026-07-20 (Phase 2 · 2.2.2)
> **Progress**: 20/55 tasks (36%)
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
- [ ] 2.2.3 `datagrid/src` (12; 8 in `grid-panels.ts`). Note `grid-panels.ts:201`'s shared `fr` singleton — the conversion de-aliases it, which is the point, not a side effect
- [ ] 2.2.4 **Rule 1a / AR-16** — the 3 deliberate-erasure sites, converted with the discarded props named as explicit `undefined`: `app/application.ts:334`, `datagrid/src/overlay.ts:129`, `datagrid/src/editing.ts:233`. Behaviour must not change; two are public customization seams
- [ ] 2.2.5 `docs-site` `src` + `examples` (5) · `theme-designer/src` (4)
- [ ] 2.2.6 `examples/**` non-test (≈55 across ≈27 files), including the 9 raw-spine teaching sites which convert but **stay absolute** (AR-8). Re-render the 8 canvases against 2.1.3's baseline and record the diff
- [ ] 2.2.7 The 16 `packages/docs-site/**/*.md` snippets that teach `view.layout = …` (FR-13). Optional guard: assert no fenced `ts` block contains `.layout =`

### Step 2.3 — Convert tests (704 sites)

> Per AC-6 these are mechanical **setup** rewrites, not oracle changes. Nothing a spec test asserts
> may change; 152 spec files are touched this way and that is expected, not a violation.

- [ ] 2.3.1 `ui/test` — 474 sites / 147 files, by directory batch
- [ ] 2.3.2 `datagrid/test` — 167 / 75
- [ ] 2.3.3 `forms/test` (31) · `files/test` (18)
- [ ] 2.3.4 `examples/test` (6) · `docs-site/test` (4) · `web/test` (3) · `theme-designer/test` (1)

### Step 2.4 — Flip

> ST-6/ST-7/ST-8 are authored **here**, not at the head of the phase. An unused `@ts-expect-error`
> is `TS2578` — a hard compile error — and `turbo`'s `test → build` dependency means it aborts the
> whole verify run. Authored early they would leave every task in 2.2/2.3 unable to verify: exactly
> the condition AR-7 rejected. Keep author → red → flip → green inside this step.

- [ ] 2.4.1 [spec-author] ST-6, ST-7, ST-8 — the identity contract and the **type-level** ratchet. Observe them red against the pre-flip field
- [ ] 2.4.2 `view.ts`: `readonly layout: Readonly<LayoutProps>` + `setLayout` on `Object.assign`
- [ ] 2.4.3 The 10 subclass hatches → `override readonly layout: Readonly<LayoutProps>`
- [ ] 2.4.4 Correct the superseded contract: invert ST-I1's identity assertion and delete ST-I4 in `ui/test/view-setlayout.impl.test.ts`, one recorded verdict each
- [ ] 2.4.5 **FR-13** — rewrite the 3 shipped `@example` blocks that assign `layout.rect` (`window/window.ts:73`, `app/application.ts:316`, `desktop/desktop.ts:58,63`) to `setLayout({ rect })`, then re-verify `jsdoc-examples.allowlist.json`: `Desktop` is listed as `codes:[2322]` exactly and may now be stale
- [ ] 2.4.6 **FR-13** — rewrite the shipped prose that describes wholesale assignment as live: `view.ts:68-73` (the field's own JSDoc) and `:222`, `split-view.ts:144,185`, `dsl/{absolute,flex,index}.ts`, `ui/src/index.ts:52`, `demo-shell.ts:233`
- [ ] 2.4.7 `yarn plugin:sync --fix` + commit — the API-ref snapshot records `layout: LayoutProps` in 5 rows and `check-plugin` fails verify without this. Deterministic, no API key; `--detect` does not catch it
- [ ] 2.4.8 ST-6/ST-7/ST-8 and ST-12 go green

### Step 2.5 — Accept

- [ ] 2.5.1 **AC-3** widened grep (`packages/*/src packages/*/test packages/examples packages/docs-site/{examples,components}`): 0 hits outside comments, `spike-data-studio` and `setLayout`'s body. Enumerate the surviving prose matches
- [ ] 2.5.2 **AC-5** — `turbo run typecheck` green with the flip in place, **plus** `tsc --listFiles` proving each package's config resolves its `test/`. Record the two surfaces this cannot cover (`spike-data-studio`; any package still lacking a `test/`-inclusive config)
- [ ] 2.5.3 Full verify — including `jsdoc-examples.spec.test.ts` and `check-plugin`

**Verify**: `yarn verify`

---

## Phase 3: Canvas adoption (#129)

> **Reference**: [03-03](03-03-canvas-adoption.md) · **Routing**: standard, but design-heavy
> **Objective**: FR-9…FR-11. 18 sites / 8 canvases + 5 shadows.

### Step 3.1 — Baselines

- [ ] 3.1.1 Re-capture the 8 canvases and diff against **2.1.3's pre-Phase-2 baseline**; record the Phase 2 delta per canvas before changing anything further
- [ ] 3.1.2 Decide the witness question for `playground` and `controls-live` — both `return 0` without a TTY (`playground/main.ts:29`, `controls-live/main.ts:68`), so neither renders headlessly. Build a harness mounting the composition function into `createRenderRoot({width:80,height:24})` (as `themes-demo/main.ts:63-67` does), or record them review-only, or leave them absolute. Record which
- [ ] 3.1.3 [spec-author] ST-10, ST-11 — ST-11 scoped to files that **import** the shadowed builder

### Step 3.2 — Convert

- [ ] 3.2.1 `dropdowns-demo` (6) — largest; per-file judgment on what is structurally flex
- [ ] 3.2.2 `containers-demo` (5)
- [ ] 3.2.3 `playground` (2) · `themes-demo` · `color-demo` · `date-demo` · `controls-live` · `status-bar.story` (1 each)
- [ ] 3.2.4 Confirm `tabs-demo` carries 0 sites and needs no conversion
- [ ] 3.2.5 The 2 `theme-designer` shadows — real conversions; call sites become `g.add(at(v, …))`
- [ ] 3.2.6 The 3 examples shadows — `keyboard-mouse-playground:126`, `analog-clock:70` (a polar helper, not a placer), `layout.story:30` (a rename)

### Step 3.3 — Accept

- [ ] 3.3.1 Re-render; **a recorded verdict per canvas** — byte-identical, an explained and accepted delta, or (for a witness-less canvas) a review verdict naming why there is no render diff
- [ ] 3.3.2 AC-7 grep, scoped to files importing the shadowed name: no local binding shadows a DSL builder it imports
- [ ] 3.3.3 Full verify

**Verify**: `yarn verify`

---

## Phase 4: Close-out

> **Routing**: trivial

- [ ] 4.1.1 Close #132, #117, #129 with measured close-out comments; note #131 remains open as the uncoupled lane
- [ ] 4.1.2 Roadmap sync + portfolio cascade; the epic #108 umbrella can close once #117 and #129 do
- [ ] 4.1.3 `yarn lint:fix`, commit what it changes, final `yarn verify` (prime directive)

**Verify**: `yarn verify`

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
