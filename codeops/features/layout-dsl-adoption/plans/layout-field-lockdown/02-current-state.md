# Current State: layout-field-lockdown

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

Every number here was **measured**, not read off the issues. The method and the three traps it
had to survive are recorded because the naive readings are all confidently wrong.

## How these numbers were obtained

1. Flip `View.layout` to `readonly Readonly<LayoutProps>` and mark the 10 subclass
   redeclarations `override readonly` (without this, ten sites stay hidden — AR-3).
2. Rebuild `ui` so downstream packages see the new `.d.ts` — they typecheck against `dist`, not
   `src`. Skip this and four packages report **zero**.
3. Run `tsc --noEmit` **per package**. `yarn typecheck` halts at the first failure and reports
   `core` + `ui` only.
4. For test coverage, add a `tsconfig.typecheck.json` per the `datagrid` pattern
   (`rootDir: "."`, `include: ["src","test"]`).
5. Restore the tree; rebuild `dist`.

**Measurement traps hit and corrected, in order:**

| Naive reading | Reported | Truth |
|---|---|---|
| `readonly LayoutProps` alone | 21 | shallow — misses all 32 rect mutations |
| adding `Readonly<>` without closing hatches | 21 (unchanged) | hatches masked 10 sites → 31 |
| widening `include` with `rootDir: "src"` | 606 errors | all `TS6059` config artifacts — zero real |
| dropping `rootDir` instead of setting `"."` | `ui` = 1 error | `TS2209` aborted resolution, hiding **80** |

## The write surface — ~817 sites

> Counts marked ≈ were re-derived at preflight with a **comment-excluding** grep; the originals
> included JSDoc and prose lines that match the pattern but are not sites. Re-derive before Phase 2
> so a delta during execution reads as a finding rather than as noise.

| Surface | Sites | Files | Typechecked today? |
|---|---|---|---|
| `ui/src` | ≈30 | 16 | yes |
| `datagrid/src` | 12 | 5 | yes |
| `examples/**` (demos, stories, shells) | ≈55 | ≈27 | **107 of 255 files only** |
| `docs-site` (`src` + `examples`) | 5 | 4 | yes |
| `theme-designer/src` | 4 | 4 | yes |
| **Subtotal — src + examples** | **≈106** | **≈56** | |
| `ui/test` | 474 | 147 | **no** |
| `datagrid/test` | 167 | 75 | yes (the one exception) |
| `forms/test` | 31 | 10 | **no** |
| `files/test` | 18 | 16 | **no** |
| `examples/test` | 6 | 3 | **no** |
| `docs-site/test` | 4 | 4 | **no** |
| `web/test` | 3 | 3 | **no** |
| `theme-designer/test` | **1** | 1 | **no** — missed in the original inventory |
| **Subtotal — tests** | **704** | **255** | |
| **TOTAL** | **≈810** | **≈311** | |

Excluded by AR-6: `spike-data-studio` (13 sites) — no build/test/typecheck script, marked for
deletion.

Split by kind: **81** wholesale `\.layout = {…}` writes and **32** in-place `layout.rect = …`
mutations in the src/examples subtotal. Of those 32, **23** are window/desktop placement, which
RD-01 keeps absolute — they change *writer*, not layout. Only ~6 carry a paired
`invalidateLayout()`; the rest are pre-mount construction (see FR-7).

## Not write sites, but they teach the idiom

The grep pattern also matches material the flip invalidates *without* producing a type error. None
of this was in the original inventory, and all of it is inside `yarn verify`:

| Surface | Count | What breaks |
|---|---|---|
| Shipped JSDoc `@example` blocks assigning `layout.rect` | 3 | `docs-site/test/jsdoc-examples.spec.test.ts` — an unlisted block must compile; `desktop.ts::Desktop` is allowlisted with exact codes |
| `packages/docs-site/**/*.md` snippets | 16 (15 files) | Nothing mechanically — which is why it is a silent miss |
| Shipped prose describing wholesale assignment as live | 8 sites | Stale contract in public JSDoc (`view.ts:68-73`) and a structural rationale (`split-view.ts:144`) |
| Plugin API-ref snapshot (`layout: LayoutProps`) | 5 rows | `check-plugin` → `[api] out of date` |

## The typecheck surface

| Package | `typecheck` script | Covers tests? |
|---|---|---|
| `datagrid` | `tsc --noEmit -p tsconfig.typecheck.json` | **yes** — the pattern to copy |
| `docs-site` | `tsc --noEmit -p tsconfig.json` | no (`examples` + `src` only) |
| `core` · `ui` · `web` · `files` · `forms` · `theme-designer` | `tsc --noEmit` | no (`include: ["src"]`) |
| `examples` | `tsc --noEmit` | no — and only 6 of ~30 dirs |

**743 test files never typecheck, 395 of them `*.spec.test.ts` oracles.** `datagrid` is the sole
exception — but "already carries the fix" needs one qualification: its `exclude` for three
cross-package specs is justified in-file as *"mirrors core's own posture (core never typechecks its
`test/`)"*, and Phase 1 destroys that precedent while the underlying `TS6059`/`TS7016` cause
persists. Those three files hold **0** write sites, so there is no lockdown hole — but the exclusion
should be re-evaluated once `core/test` is covered (the `TS7016` half is fixable with the same
`.d.mts` seam as AR-5), and the comment updated either way.

Note also that `packages/examples/tsconfig.json` and `packages/docs-site/tsconfig.json` **already**
set `rootDir: "."`, so for those two the change is a pure `include` edit with no `rootDir` trap.

## The error surface Phase 1 must clear — 229

| Package | Errors | Files | Notes |
|---|---|---|---|
| `ui/test` | 80 | 50 | invisible until `rootDir: "."` was set correctly |
| `core/test` | 65 | 32 | concentrated in `input-demux.spec` (18), `input-responses.impl` (16) |
| `examples` | 53 | 33 | 28 of them one root cause — untyped `.mjs` imports (AR-5) |
| `docs-site/test` | **18** | tbd | added at preflight — 9× `TS7006`, 5× `TS7016`, 2× `TS18048`, `TS2322`, `TS2345`. Had a task but no budget |
| `forms/test` | 5 | 3 | `TS2322` number vs `void \| Promise<void>`; an incomplete fixture |
| `theme-designer/test` | **5** | tbd | added at preflight — the package was recorded as having no `test/` |
| `files/test` | 3 | 3 | |
| `web/test` | 0 | 0 | clean |
| `datagrid` | 0 | — | already covered |
| **Total** | **229** | **~126** | |

Error mix across the test dirs: `TS2339` (17), `TS18047` (17), `TS2345` (11), `TS2322` (10),
`TS18048` (6), `TS7016` (4), `TS2352` (3), `TS2741` (2), `TS2739` (1).

## Latent defects in passing tests

These compile-fail today while their suites pass, so each is either a wrong fixture or an
assertion weaker than it reads (see the register's *Latent-defect policy*):

| Site | Error |
|---|---|
| `examples/test/datagrid-showcase.spy-source.spec.test.ts` ×4 | `TS2722` cannot invoke possibly-undefined |
| `examples/test/recipes.smoke.spec.test.ts` | `TS2554` expected 0 args, got 1 |
| `examples/test/probe-readout.impl.test.ts` | `TS2345` wheel-event shape |
| `examples/test/probe-nontty.spec.test.ts` ×2 | `TS2740` stream type mismatch |
| `forms/test/async.{spec,impl}.test.ts` ×4 | `TS2322` timer return type |
| `docs-site/test/demo-shell.spec.test.ts:82` | `TS2345` — `Application` not assignable to `{ desktop: { children: readonly View[] } }` |
| `docs-site/test/example-at.spec.test.ts:84` | `TS2322` — `Application \| View` not assignable to `View` |

## Tests that assert the contract this plan inverts

Not defects — committed, passing, deliberate. They must be handled in Phase 2, and the original
inventory missed them:

| Site | Asserts |
|---|---|
| `ui/test/view-setlayout.impl.test.ts:52` (ST-I1) | `expect(v.layout).not.toBe(before)` — *"replaces the object"* |
| `ui/test/view-setlayout.impl.test.ts:115` (ST-I4) | same, plus `expect(before).toEqual({ direction: 'col' })` |
| `ui/test/view-setlayout.spec.test.ts:42` (ST-S1) | the merge contract — **already** this plan's ST-4 |
| `ui/test/view-setlayout.spec.test.ts:59` (ST-S3) | one `setLayout` → one `markRelayout`, with a `countingHost()` double — **already** this plan's ST-5 |

## The 10 escape hatches

`color-picker.ts:112,136` · `dropdown/popup.ts:125` · `dropdown/combo-box.ts:64` ·
`date/date-picker.ts:33` · `menu/popup.ts:56` · `window/window.ts:81` · `tree/tree.ts:96` ·
`tabs/tab-view.ts:138` · `list/list-view.ts:83`

Each redeclares `override layout: LayoutProps = {…}` **without** `readonly`, silently restoring
write access with no diagnostic.

## #129's canvas surface

`dropdowns-demo` (6) · `containers-demo` (5) · `playground` (2) · `themes-demo` (1) ·
`color-demo` (1) · `date-demo` (1) · `controls-live` (1) · `status-bar.story` (1) = **18** across
**8** canvases. *(`tabs-demo` is named in #129 but carries **0** write sites.)*

Five residual name shadows: `theme-designer/view/gallery.ts:32` ·
`theme-designer/view/inspector-panel.ts:55` · `examples/keyboard-mouse-playground/main.ts:126` ·
`examples/amiga-clock/analog-clock.ts:70` · `examples/kitchen-sink/stories/layout.story.ts:30`.
The two `theme-designer` helpers place **and** add, so retiring them rewrites their call sites.
