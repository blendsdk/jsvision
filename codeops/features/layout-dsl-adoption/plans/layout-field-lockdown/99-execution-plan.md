# Execution Plan: layout-field-lockdown

> **Parent**: [Index](00-index.md)
> **CodeOps Skills Version**: 3.11.0
> **Last Updated**: 2026-07-20
> **Progress**: 10/54 tasks (19%)
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

- [ ] 1.5.1 ST-2 in anger: break a demo entry, confirm `yarn typecheck` fails, revert
- [ ] 1.5.2 Measure the `turbo typecheck` wall-clock delta and record it
- [ ] 1.5.3 Full verify

**Verify**: `yarn verify`

---

## Phase 2: The lockdown (#117-P4)

> **Reference**: [03-02](03-02-layout-field-lockdown.md) · **Routing**: sensitive (core engine)
> **Objective**: FR-5…FR-8, FR-12, FR-13. ~810 conversions, then the flip.

### Step 2.1 — Groundwork

- [ ] 2.1.1 Re-derive the site inventory with a **comment-excluding** grep and record it. The documented counts are ≈; a delta found now is data, a delta found mid-phase is noise
- [ ] 2.1.2 Re-run the layout-object **holder** search (`= [A-Za-z.]*\.layout;` and `\.layout = <identifier>;`) across all packages **and** test dirs; record the inventory in AR-2. Known: `grid-panels.ts:201` is a module-level singleton aliased across every grid
- [ ] 2.1.3 Capture cell-exact baselines (glyph + fg/bg + attrs + width) for the 8 Phase-3 canvases at 80×24, against **pre-conversion** source. Captured here, not in Phase 3: task 2.2.6 converts these very files, and a baseline taken afterwards would bake any replace→merge regression into the "before"
- [ ] 2.1.4 [spec-author] ST-9 — `applyMove` via the gesture path: rect updates and exactly one reflow. Express the "no separate `invalidateLayout()`" half as a scoped source grep, or drop it and rely on the reflow count

> ST-4 and ST-5 are **already committed** as ST-S1 (`view-setlayout.spec.test.ts:42`) and ST-S3
> (`:59`, `countingHost()` included). Record the equivalence; do **not** author duplicates into an
> immutable oracle. ST-6, ST-7 and ST-8 are deliberately deferred to Step 2.4 — see the note there.

### Step 2.2 — Convert shipped source (~106 sites)

- [ ] 2.2.1 `ui/src` wholesale writes (≈20 sites) — Rule 1
- [ ] 2.2.2 `ui/src` rect mutations (8) — Rule 2, **three-way**: collapse the pair only where one exists (`gestures.ts`, `arrange.ts`, `window.ts`); keep `onResized()` **before** `setLayout` at `gestures.ts:57,74`, `arrange.ts:18`, `window.ts:205`; plain rewrite at `edit-window.ts:78`, which has no invalidate
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
