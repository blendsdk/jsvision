# Requirements: layout-field-lockdown

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: GH #132 · GH #117 (P4) · GH #129 · RD-01 FR-6 · RD-02

## Functional requirements

### Phase 1 — #132, the typecheck gate

- **FR-1 — `packages/examples/tsconfig.json` covers the whole package.** Its `include` currently
  names six directories and reaches 107 of 255 `.ts` files. After this phase every `.ts` in the
  package is typechecked, `vitest.config.ts` included.
- **FR-2 — All 229 exposed errors are resolved, not suppressed.** ~126 files. Hygiene errors
  (implicit `any`, missing declarations) are fixed at the source; the errors sitting in
  currently-passing test files are investigated individually and each given a recorded verdict
  (see AR register § *Latent-defect policy*). The budget is per package — `ui` 80 · `core` 65 ·
  `examples` 53 · `docs-site` 18 · `forms` 5 · `theme-designer` 5 · `files` 3 · `web` 0 — and each
  package is turned on and cleared in the **same** task, so every task verifies on its own.
- **FR-3 — Untyped `.mjs` tooling imports get hand-written `.d.mts` declarations** beside each of
  the 11 imported scripts (AR-5). The scripts stay plain ESM, runnable by `node`, and are not
  themselves pulled into the typecheck graph.
- **FR-4 — The gate is demonstrated, not assumed.** A deliberately broken demo entry file must
  fail `yarn typecheck`. A gate nobody has watched fail is not known to work.

### Phase 2 — #117-P4, the lockdown

- **FR-5 — `View.layout` becomes `readonly layout: Readonly<LayoutProps>`** (AR-1), and the 10
  subclass redeclarations become `override readonly layout: Readonly<LayoutProps>` (AR-3).
- **FR-6 — `setLayout()` is the only writer**, backed by `Object.assign(this.layout, patch)`
  (AR-2). No cast, no accessor, no second blessed writer.
- **FR-7 — All 114 write sites convert before the flip** (AR-7): 81 wholesale writes become
  `setLayout({…})` and 32 in-place `layout.rect = …` mutations become `setLayout({ rect })` (AR-4).
  The rect sites are **not** uniform, and the conversion splits three ways:
  - **~6 mounted-path sites** (`desktop/gestures.ts:42,57,74`, `desktop/arrange.ts:18`,
    `window/window.ts:188,190,205`) carry a paired `invalidateLayout()`; those collapse into the
    single `setLayout({ rect })` call.
  - **4 of those sites have an `onResized()` between the write and the invalidate**
    (`gestures.ts:57-59`, `gestures.ts:74-76`, `arrange.ts:18-20`, `window.ts:205-208`), and that
    ordering is load-bearing — the re-pin must happen before the repaint reads the children. There
    the shape stays `view.onResized(); view.setLayout({ rect });`, never the reverse.
  - **~21 pre-mount construction sites** carry **no** invalidate at all (verified:
    `editor/edit-window.ts:78`, `kitchen-sink/shell.ts:192,230`, `amiga-clock/main.ts:105,111,117,133`,
    `tvision-demo/main.ts:145,151,157`, `demo-shell.ts:216`, and others). Those are a plain rewrite;
    the invalidate `setLayout` adds is a documented no-op while `host` is null.
- **FR-8 — The nine raw-spine teaching sites convert too, staying absolute** (AR-8).
- **FR-12 — Three sites that rely on wholesale replacement *erasing* props convert explicitly**
  (AR-16): `app/application.ts:334`, `datagrid/src/overlay.ts:129`, `datagrid/src/editing.ts:233`.
  Each documents the erasure as intentional, and two sit on customization seams. They convert with
  the discarded props named as explicit `undefined`, preserving today's behaviour.
- **FR-13 — Everything that *teaches* the retired idiom migrates with it.** The flip makes
  `view.layout = …` a compile error, so no shipped artifact may keep demonstrating it: the 3 JSDoc
  `@example` blocks that assign `layout.rect` (`window/window.ts:73`, `app/application.ts:316`,
  `desktop/desktop.ts:58,63`), the 16 `packages/docs-site/**/*.md` snippets, the shipped prose that
  describes wholesale assignment as a live hazard (`view.ts:68-73,222`, `split-view.ts:144,185`,
  `dsl/{absolute,flex,index}.ts`, `ui/src/index.ts:52`, `demo-shell.ts:233`), and the regenerated
  plugin API-ref snapshot.

### Phase 3 — #129, canvas adoption

- **FR-9 — The 8 canvases carrying writes adopt `col`/`row` composition** where structurally flex,
  per RD-01 FR-6, each with the manual showcase quality pass RD-02 attaches.
- **FR-10 — All 5 residual name shadows are retired** (AR-10), including the two `theme-designer`
  helpers whose different signature (place **and** add) requires rewriting their call sites.
- **FR-11 — Every canvas conversion is controlled by a render diff** (AR-9): captured before,
  re-rendered after, and either byte-identical or explained and recorded.

## Out of scope

| Excluded | Why |
|---|---|
| GH #131 — the 161-entry `@example` allowlist **drain** | Own ratchet; would add ~161 rote entries (AR-11). **Not** zero-coupling: this plan does touch `jsdoc-examples.allowlist.json`, because the flip changes three `@example` blocks' compile status (FR-13). Editing those entries is in scope; draining the other ~158 is not |
| `packages/spike-data-studio` — 13 write sites | No build/test/typecheck script; marked for deletion in CLAUDE.md (AR-6) |
| A `setRect` / `moveTo` / `resize` API | Rejected in favour of the existing `setLayout({ rect })` (AR-4) |
| Making `layout` a private field behind a getter | Breaks all 10 subclass field initializers (AR-2) |
| Flex-converting the raw-spine teaching demos | The lesson is protected; only the writer changes (AR-8) |
| Window/desktop placement geometry | Keep-absolute by RD-01 policy; these sites change writer, not layout |

## Acceptance criteria

- **AC-1** — `packages/examples/tsconfig.json` typechecks all 255 `.ts` files; `yarn verify` green.
- **AC-2** — Introducing a type error into any demo entry file fails `yarn typecheck` (FR-4).
- **AC-3** — `grep -rn "\.layout = \|\.layout\.[a-zA-Z]* = " packages/*/src packages/*/test
  packages/examples packages/docs-site/examples packages/docs-site/components` returns **0** hits
  outside comments, `spike-data-studio`, and `setLayout`'s own body.
  The path list deliberately includes `packages/*/test` — the original list reached only
  `packages/*/src`, which is blind to 697 of the sites AR-13 pulled into scope, i.e. the exact hole
  AR-13 exists to close. The comment carve-out is not a loophole: the pattern legitimately matches
  prose that *describes* the retired idiom, and after FR-13 the only surviving matches are the
  rewritten explanations at `view.ts:222`, `dsl/absolute.ts:21`, `dsl/flex.ts:5`, `dsl/index.ts:4`,
  `split-view.ts:144,186` and `demo-shell.ts:233`. Enumerate them; a match outside that list is a
  real hit.
- **AC-4** — `View.layout` and all 10 subclass redeclarations are `readonly`; no cast or
  `ts-expect-error` anywhere under `packages/*/src`. The ST-7/ST-8 fixtures are the one exception,
  and their `@ts-expect-error` comments are the point — they live in `test/`.
- **AC-5** — `turbo run typecheck` is green with the flip in place **and** every package whose
  `typecheck` config now includes `test/` actually resolves it (proved by `tsc --listFiles`).
  Stated this way because after the flip lands, "re-run the spike" reduces to `tsc`, which earlier
  tasks already ran — it cannot report anything but 0 and is not an independent instrument.
  Two surfaces it cannot cover, named so the all-clear is honest: `spike-data-studio` (no typecheck
  script at all, AR-6), and any package left without a `test/`-inclusive config.
- **AC-6** — **No spec test's oracle changes meaning.** A `*.spec.test.*` file's assertions,
  expectations and fixture *values* are immutable; a mechanical rewrite of test **setup**
  (`x.layout = {…}` → `x.setLayout({…})`) is explicitly permitted and is not an oracle change.
  Any edit that is not that mechanical substitution — including the latent-defect fixes — gets an
  individually recorded verdict. This is the reading that makes AR-13(b) executable: 152 of the 395
  spec oracles contain write sites, so a blanket "do not modify" would forbid the conversion the
  plan is built on while leaving those files uncompilable once their `test/` is typechecked.
- **AC-7** — All 5 name shadows gone: no local binding shadows a DSL builder **that is imported in
  the same file**. The qualifier is load-bearing — the DSL exports 15 names (`at`, `row`, `col`,
  `grow`, `fixed`, `spacer`, `stack`, `center`, `centered`, `cover`, `place`, `topLeft`,
  `topRight`, `bottomRight`, `toLayout`), and harmless local bindings of them are everywhere
  (`core/src/engine/render/buffer.ts:187`, `datagrid/src/row-mutations.ts:113`, `tree/tree.ts:203`,
  `desktop/arrange.ts:16`, …). An unqualified grep can never return 0.
- **AC-8** — Every converted canvas has a recorded render verdict: byte-identical, or a described
  and accepted delta. Canvases with **no headless witness** are named explicitly and carry a
  review-only verdict instead: `theme-designer` `inspector-panel`, plus `playground` and
  `controls-live` unless a harness is built for them (see 03-03).
- **AC-9** — `yarn verify` green at every phase boundary. This includes `check-plugin`
  (the regenerated API-ref snapshot, FR-13) and `jsdoc-examples.spec.test.ts` (the `@example`
  ratchet) — both of which the flip breaks unless FR-13 lands with it.
