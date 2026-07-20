# Requirements: layout-field-lockdown

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: GH #132 · GH #117 (P4) · GH #129 · RD-01 FR-6 · RD-02

## Functional requirements

### Phase 1 — #132, the typecheck gate

- **FR-1 — `packages/examples/tsconfig.json` covers the whole package.** Its `include` currently
  names six directories and reaches 107 of 255 `.ts` files. After this phase every `.ts` in the
  package is typechecked, `vitest.config.ts` included.
- **FR-2 — The 53 exposed errors are resolved, not suppressed.** 33 files. Hygiene errors
  (implicit `any`, missing declarations) are fixed at the source; the errors sitting in
  currently-passing test files are investigated individually and each given a recorded verdict
  (see AR register § *Latent-defect policy*).
- **FR-3 — Untyped `.mjs` tooling imports get hand-written `.d.mts` declarations** beside each of
  the 8 imported scripts (AR-5). The scripts stay plain ESM, runnable by `node`, and are not
  themselves pulled into the typecheck graph.
- **FR-4 — The gate is demonstrated, not assumed.** A deliberately broken demo entry file must
  fail `yarn typecheck`. A gate nobody has watched fail is not known to work.

### Phase 2 — #117-P4, the lockdown

- **FR-5 — `View.layout` becomes `readonly layout: Readonly<LayoutProps>`** (AR-1), and the 10
  subclass redeclarations become `override readonly layout: Readonly<LayoutProps>` (AR-3).
- **FR-6 — `setLayout()` is the only writer**, backed by `Object.assign(this.layout, patch)`
  (AR-2). No cast, no accessor, no second blessed writer.
- **FR-7 — All 113 write sites convert before the flip** (AR-7): 81 wholesale writes become
  `setLayout({…})`, 32 in-place `layout.rect = …` mutations become `setLayout({ rect })` (AR-4),
  and the paired `invalidateLayout()` call each of the latter carries today is dropped, since
  `setLayout` performs it.
- **FR-8 — The nine raw-spine teaching sites convert too, staying absolute** (AR-8).

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
| GH #131 — the 161-entry `@example` allowlist drain | Zero coupling; own ratchet; would add ~161 rote entries (AR-11) |
| `packages/spike-data-studio` — 13 write sites | No build/test/typecheck script; marked for deletion in CLAUDE.md (AR-6) |
| A `setRect` / `moveTo` / `resize` API | Rejected in favour of the existing `setLayout({ rect })` (AR-4) |
| Making `layout` a private field behind a getter | Breaks all 10 subclass field initializers (AR-2) |
| Flex-converting the raw-spine teaching demos | The lesson is protected; only the writer changes (AR-8) |
| Window/desktop placement geometry | Keep-absolute by RD-01 policy; these sites change writer, not layout |

## Acceptance criteria

- **AC-1** — `packages/examples/tsconfig.json` typechecks all 255 `.ts` files; `yarn verify` green.
- **AC-2** — Introducing a type error into any demo entry file fails `yarn typecheck` (FR-4).
- **AC-3** — `grep -rn "\.layout = \|\.layout\.[a-zA-Z]* = " packages/*/src packages/examples
  packages/docs-site/examples` returns **0** executable hits outside `spike-data-studio` and
  `setLayout`'s own body.
- **AC-4** — `View.layout` and all 10 subclass redeclarations are `readonly`; no cast or
  `ts-expect-error` anywhere in the lockdown.
- **AC-5** — Re-running the spike (flip + per-package `tsc`) after Phase 2 produces **0** `TS2540`.
  This is the phase's own oracle: it is the same instrument that measured the baseline.
- **AC-6** — No `*.spec.test.*` file that predates this plan is modified, except where the
  latent-defect policy explicitly rules a fixture wrong (each with a recorded verdict).
- **AC-7** — All 5 name shadows gone; no local `at`/`row` binding shadows a DSL builder.
- **AC-8** — Every converted canvas has a recorded render verdict: byte-identical, or a described
  and accepted delta.
- **AC-9** — `yarn verify` green at every phase boundary.
