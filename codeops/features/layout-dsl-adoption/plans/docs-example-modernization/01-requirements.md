# Requirements: docs-example-modernization

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: GH [#112](https://github.com/blendsdk/jsvision/issues/112) — issue-driven, no upstream RD

## Feature Overview

Three deliverables, sequenced by dependency: a permanent compile guard for public `@example`
blocks, a modernization sweep of every layout-shaped example onto the layout DSL, and the
retirement of the seven `at()` shadow helpers in the docs-site examples.

The issue was filed before #113 shipped `at()`/`cover()`/`center()` and explicitly anticipated its
own expansion (*"Scope may expand with #113"*). That expansion is taken (AR-1), which is why this
plan is substantially larger than the filed body.

## Functional Requirements

### Must Have

- [ ] **FR-1 — The guard exists.** A permanent spec test extracts every `@example` body from the
      **six shipped packages, enumerated** — `core`, `ui`, `web`, `files`, `datagrid`, `forms`
      (`packages/<pkg>/src/**/*.ts`, `.d.ts` excluded) — compiles each as a standalone module, and
      fails the build on any failure not present in a committed allowlist. **Never a
      `packages/*/src` glob**: that also matches `docs-site` and the inert `spike-data-studio`
      (AR-15). Design owned by [03-01](03-01-example-compile-guard.md). (AR-2, AR-5, AR-7, AR-15)
- [ ] **FR-1a — The gate actually runs.** A standing spec case asserts the guard over the **real
      repo**: `checkExamples(collectExamples(SHIPPED_ROOTS), readAllowlist())` reports zero
      `unexpected` and zero `stale`. Without this, FR-1 and FR-2 are inert — the allowlist would be
      a file nothing reads. Pinned by **ST-12**. (AR-2)
- [ ] **FR-2 — The allowlist is a ratchet.** It may only shrink. A *new* failure fails the build; a
      *changed* error on an allowlisted block fails the build; an allowlisted block that starts
      compiling fails the build as a stale entry; an entry naming a file or symbol that no longer
      exists fails the build as a stale entry. Entries are keyed `file::SymbolName`, qualified
      `file::Class.member` for members and suffixed `#N` where a key would otherwise repeat.
      (AR-9, AR-10, AR-11)
- [ ] **FR-3 — Flex examples use the flex DSL.** `group.ts` and `editor/indicator.ts` compose with
      `row()`/`col()`/`grow()`/`fixed()` rather than hand-written `direction`/`size` props.
- [ ] **FR-4 — Absolute examples use `at()`.** Every `@example` line writing
      `.layout = { position: 'absolute', rect: … }` in `packages/*/src` becomes an `at()` call.
      Measured surface: **53 lines across 37 files**. (AR-1)
- [ ] **FR-5 — `split-view.ts:109` uses `cover()`** in place of `layout = { position: 'fill' }`. (AR-1)
- [ ] **FR-6 — The four live defects are fixed**, not allowlisted: the `createEventLoop` arity in
      `tree.ts`, `tab-view.ts` and `table/data-grid.ts`, and the non-existent `syncOverlayVisible`
      import in `application.ts`. See [02](02-current-state.md) §Live defects. (AR-6)
- [ ] **FR-7 — The docs-site shadows are retired.** All seven local
      `function at<V extends View>(…) { view.layout = … }` helpers are replaced by
      `import { at } from '@jsvision/ui'`, preceded by the same replace→merge audit #114 used.
      Design owned by [03-03](03-03-docs-site-shadow-retirement.md). (AR-3)
- [ ] **FR-8 — `list-box.ts` composes with `col()`** — `cover(col(grow(list), spacer({ fixed: 1 }),
      fixed(echo, 1)))` in place of three `at()` calls. Two details are load-bearing and neither is
      optional: the **`cover()`** (a `col()` container with no extent of its own collapses to
      nothing — [03-03](03-03-docs-site-shadow-retirement.md) §FR-8), and **`spacer({ fixed: 1 })`**
      rather than `spacer(1)` — `packages/ui/src/view/dsl/flex.ts:219-225` makes a *numeric*
      argument a flex **weight**, so `spacer(1)` would take a 1fr share of the column instead of the
      intended one-row gap. (AR-3, AR-4)

### Should Have

- [ ] **FR-9** — The allowlist file is human-readable and review-friendly: one entry per line,
      keyed by symbol, carrying the recorded TypeScript error code and message. It is the worklist
      for the follow-up issue, so it must be legible as debt.

### Won't Have (Out of Scope)

- **Converting docs-site's absolute example canvases to `col`/`row` composition.** RD-01 FR-6
  sanctions it; #129 owns it, together with the manual showcase quality pass RD-02 attaches. (AR-4)
- **Driving the allowlist to zero.** ~160 blocks fail today, most of them legitimately — a snippet
  that references an ambient `dialog` is a valid documentation style, not a defect. Some are not
  even fixable *as examples*: a literal `{ ... }` elision
  (`packages/core/src/engine/capability/index.ts:75,123`) and a top-level `return`
  (`packages/datagrid/src/validation.ts:83`) are legitimate documentation idioms that cannot compile
  standalone. Emptying the list is a separate judgement about what an example *should* be, filed as
  a follow-up — which must be written knowing that a residue is permanent, not a backlog. (AR-5, AR-9)
- **The five residual `at()`/`row()` name shadows** in `theme-designer` and `packages/examples` —
  #129 owns those.
- **`packages/examples`, `packages/spike-data-studio`, `packages/docs-site/src` and
  `packages/theme-designer`** — outside the guard's roots (AR-15). `examples` has no `src/` at all;
  `spike-data-studio` is inert and slated for deletion; `theme-designer` is an app rather than
  shipped source and has no `build` script, so it has no `dist` for its blocks to resolve against.
- **Changing any example's runtime behaviour.** This plan edits comments and placement helpers. No
  widget, layout or rendering code changes.

## Technical Requirements

### Performance

- The guard runs one `ts.createProgram` over ~393 virtual modules. Measured during preflight at
  **~1.9 s** for 300 blocks against the full `@jsvision/*` typings, so this is comfortable inside
  the 60 s `docs-site` vitest timeout. `ci.yml:44-55` already names `ts.createProgram` as the reason
  Windows/macOS run the scoped `verify:shipped` instead of the full `verify`; siting the guard in
  `docs-site` (AR-7) keeps it on the Linux cell only, alongside the full `ts.createProgram` that
  `test/api-barrel-exports.spec.test.ts` already runs there.
- `turbo.json`'s `test dependsOn build` + `^build` supplies the built `@jsvision/*` `dist/` the
  extracted examples resolve against — `packages/ui/package.json:33-39` points `types` at `dist/`.
  **`^build` covers only docs-site's declared dependencies**, which today are `core`, `files`, `ui`
  and `web`. Because AR-15 puts `datagrid` and `forms` in the guard's roots, both must be added to
  `packages/docs-site/package.json` devDependencies — otherwise their builds are unordered against
  `docs-site#test` and the guard's result, and therefore the committed allowlist, becomes
  build-order dependent.

### Compatibility

- ESM-only, NodeNext specifiers, `strict`. The harness compiles extracted blocks with the project's
  own compiler options resolved from `tsconfig.base.json`, **minus `noUnusedLocals` and
  `noUnusedParameters`** (AR-14) — an unused local in a documentation snippet is not an API defect,
  and including those checks would put ~56 blocks on the allowlist for snippet hygiene alone. Every
  other option is the repo's, so a block that passes the guard compiles the way the repo compiles.
  `noEmit` is forced on: `tsconfig.base.json` sets `declaration`, `declarationMap` and `sourceMap`,
  and the guard must never emit anything.
- Zero runtime dependencies added. `typescript` is a devDependency only, already direct in
  `packages/docs-site/package.json`.

### Security

No user-input path, no network, **and no filesystem writes at all**. The original design wrote
scratch `.ts` files adjacent to real sources; preflight established that as the guard's single
largest hazard (a race against turbo's unordered `typecheck`/`build`, a *silent* leak — `tsc`'s
wildcard `include` does not match dot-prefixed filenames and `.gitignore` has no entry — and a
`finally` that cannot cover SIGINT). AR-16 replaces it with an **in-memory `ts.CompilerHost`**:
blocks are served as virtual `SourceFile`s at their source's own directory path, `writeFile` is a
no-op, and no file is ever created. The requirement is therefore inverted and much easier to hold:
**the harness must not write to the filesystem**, which AC-9 asserts directly.

## Scope Decisions

| Decision | Options considered | Chosen | Rationale | AR |
|---|---|---|---|---|
| `@example` scope | flex only · flex + split-view · flex + all absolute | all absolute | #113 inverted the issue's stated objection | AR-1 |
| Oracle | permanent guard · one-shot · manual | permanent guard | only option that keeps paying | AR-2 |
| docs-site slice | both · shadows only · defer | both | roadmap already assigns it here | AR-3 |
| Tier-3 composition | here · #129 | #129 | design rewrite ≠ documentation pass | AR-4 |
| Guard scope | repo-wide+allowlist · layout blocks · self-contained | repo-wide + allowlist | protects everything, keeps plan green | AR-5 |
| Four defects | fix · allowlist | fix | already-open files; allowlisting them is perverse | AR-6 |
| Guard home | docs-site · root script · ui | docs-site | Linux-only, has `typescript`, has built deps | AR-7 |
| Allowlist contract | shrink-only · edited⇒fix · shrink+opportunistic | shrink-only | survives the sweep without unrelated rewrites | AR-9 |
| Allowlist key | `file::symbol` · `file#ordinal` · `file:line` | `file::symbol` (+ `Class.member`, + `#N` on collision) | stable across the sweep's line shifts; the qualifiers close three real collisions | AR-10 |
| Stale entries | fail · warn | fail | makes the ratchet real | AR-11 |
| Unused-local checks | base verbatim · base minus · drop the baseline | base **minus** `noUnusedLocals`/`noUnusedParameters` | a doc snippet's unused local is not an API defect; ~56 blocks otherwise allowlisted for hygiene | AR-14 |
| Guard roots | six enumerated · `packages/*/src` glob · docs-site's four | six shipped packages, enumerated | the glob drags in `spike-data-studio` and `docs-site`; `theme-designer` has no `dist` | AR-15 |
| Block placement | in-memory host · on-disk hardened · sibling dir + shim | **in-memory `CompilerHost`** | deletes the hazard class instead of guarding it, preserving AR-13's resolution behaviour | AR-16 |

> **Traceability:** every row above resolves to an Ambiguity Register entry. See
> [00-ambiguity-register.md](00-ambiguity-register.md).

## Acceptance Criteria

1. [ ] **AC-1** — ST-1…ST-14 pass; the guard is green with its committed allowlist, **including the
   standing repo-wide case ST-12** (FR-1a) — without that case the rest is inert.
2. [ ] **AC-2** — `grep -rn "^ \* .*\.layout = .*position: 'absolute'" packages/*/src` returns
   **zero** hits. (Baseline: 53.)
3. [ ] **AC-3** — `grep -rn "^ \* .*\.layout = " packages/*/src` returns hits **only** under
   `packages/ui/src/view/dsl/` — three prose references to the raw field inside the documentation of
   the builders that replace it (`absolute.ts:21`, `flex.ts:5`, `index.ts:4`). *(Preflight
   correction: this criterion previously named `packages/ui/src/layout/` — `layout.ts:42-44` and
   `types.ts:61` document `LayoutBox` literals and a prose default-list respectively and **do not
   match this grep at all**, so AC-3 as originally written could never pass.)*
4. [ ] **AC-4** — `grep -rn "function at\|const at =" packages/docs-site/examples` returns zero hits.
5. [ ] **AC-5** — The four defects of FR-6 compile, and none of them appears in the allowlist.
6. [ ] **AC-6** — Of the nine pre-existing layout-block failures enumerated in
   [02](02-current-state.md) §"The layout surface this plan edits", exactly **six** remain in the
   final allowlist — the three `TS2554` arity defects are fixed under FR-6 and must not appear.
   Separately, `packages/ui/src/app/application.ts::syncOverlayVisible` (a `TS2305`, not a layout
   block, so not in that table) is also fixed under FR-6 and must not appear. **All four defects are
   in the *pre-sweep* allowlist generated at task 1.3.1 and leave it under FR-6** — the stale-entry
   rule (AR-11) enforces the removal, so the net movement is **−4 entries and +0**. No *other* file
   this plan edits contributes a new allowlist entry. **Checked explicitly at task 2.4.1.**
7. [ ] **AC-7** — Zero existing test files edited. **No file under `packages/docs-site/test/` that
   existed before this plan may appear in `git diff --name-only` at any point.** The suites stay
   green and unmodified. Note what they actually witness (see
   [07](07-testing-strategy.md) §"What the regression net can and cannot prove"): only
   `paint-smoke.spec` (liveness across all examples) and `dialog-reopen.spec` (2 of 7, structural)
   exercise converted code. **The primary control for FR-7/FR-8 is the rendered before/after
   comparison at task 3.4.1**, not this net.
8. [ ] **AC-8** — `yarn verify` green, including `check:docs` and `check-plugin.mjs`.
9. [ ] **AC-9** — **The guard writes nothing.** After a full guard run — passing, deliberately
   failing, and interrupted mid-compile — `git status --short` is clean and a recursive search under
   `packages/` for `.jsdoc-example.*` finds nothing. Under AR-16 this holds by construction (the
   host's `writeFile` is a no-op and no path is ever created); the criterion stays as the regression
   guard against someone reintroducing a filesystem write.
10. [ ] **AC-10** — A follow-up issue exists for draining the allowlist, linked from #112's
    close-out comment and from the feature roadmap.
