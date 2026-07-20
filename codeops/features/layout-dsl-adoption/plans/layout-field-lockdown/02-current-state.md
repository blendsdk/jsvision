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

## The write surface — 816 sites

| Surface | Sites | Files | Typechecked today? |
|---|---|---|---|
| `ui/src` | 31 | 16 | yes |
| `datagrid/src` | 12 | 5 | yes |
| `examples/**` (demos, stories, shells) | 61 | 30 | **107 of 255 files only** |
| `docs-site` (`src` + `examples`) | 5 | 4 | yes |
| `theme-designer/src` | 4 | 4 | yes |
| **Subtotal — src + examples** | **113** | **59** | |
| `ui/test` | 474 | 147 | **no** |
| `datagrid/test` | 167 | 75 | yes (the one exception) |
| `forms/test` | 31 | 10 | **no** |
| `files/test` | 18 | 16 | **no** |
| `examples/test` | 6 | 3 | **no** |
| `docs-site/test` | 4 | 4 | **no** |
| `web/test` | 3 | 3 | **no** |
| **Subtotal — tests** | **703** | **254** | |
| **TOTAL** | **816** | **313** | |

Excluded by AR-6: `spike-data-studio` (13 sites) — no build/test/typecheck script, marked for
deletion.

Split by kind: **81** wholesale `\.layout = {…}` writes and **32** in-place `layout.rect = …`
mutations in the src/examples subtotal. Of those 32, **23** are window/desktop placement, which
RD-01 keeps absolute — they change *writer*, not layout.

## The typecheck surface

| Package | `typecheck` script | Covers tests? |
|---|---|---|
| `datagrid` | `tsc --noEmit -p tsconfig.typecheck.json` | **yes** — the pattern to copy |
| `docs-site` | `tsc --noEmit -p tsconfig.json` | no (`examples` + `src` only) |
| `core` · `ui` · `web` · `files` · `forms` · `theme-designer` | `tsc --noEmit` | no (`include: ["src"]`) |
| `examples` | `tsc --noEmit` | no — and only 6 of ~30 dirs |

**743 test files never typecheck, 395 of them `*.spec.test.ts` oracles.** `datagrid` is the sole
exception and already carries the fix, with a documented `exclude` for three cross-package specs.

## The error surface Phase 1 must clear — 206

| Package | Errors | Files | Notes |
|---|---|---|---|
| `ui/test` | 80 | 50 | invisible until `rootDir: "."` was set correctly |
| `core/test` | 65 | 32 | concentrated in `input-demux.spec` (18), `input-responses.impl` (16) |
| `examples` | 53 | 33 | 28 of them one root cause — untyped `.mjs` imports (AR-5) |
| `forms/test` | 5 | 3 | `TS2322` number vs `void \| Promise<void>`; an incomplete fixture |
| `files/test` | 3 | 3 | |
| `web/test` | 0 | 0 | clean |
| `datagrid` | 0 | — | already covered |
| **Total** | **206** | **~121** | |

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
