# RD-14: Non-Functional Requirements

> **Document**: RD-14-non-functional.md
> **Status**: Preflighted (re-audited 2026-07-18 against the shipped RD-01…RD-13 code)
> **Created**: 2026-07-12
> **Project**: @jsvision/datagrid — enterprise-class editable data grid (TUI)
> **Depends On**: — (cross-cutting; governs RD-01…RD-13)
> **CodeOps Skills Version**: 3.9.0

---

## Feature Overview

The cross-cutting quality bar the whole package must meet: frame performance at scale, the
consolidated security posture, terminal accessibility, the additive core Theme roles, the test-tier
strategy, and API/packaging governance. This RD is the single home for requirements that no single
capability RD owns but all must honor.

---

## Implementation Status (reconciled 2026-07-18)

Much of this RD shipped incrementally with the capability RDs. This table is the honest done-vs-todo
picture; evidence citations live in the re-preflight report (`RD-14-preflight-report.md`).

| AC | State | Evidence / remaining work |
|----|-------|---------------------------|
| AC-1 perf bench | **To do** (rescoped) | Core owns the 200×50 compose+diff budget (`core/perf-budget.spec.test.ts`). Datagrid adds a **representative editable-grid bench (60×22)** reusing core's `frame-bench.mjs` via a workspace-relative test-only import. |
| AC-2 memory / bytes∝damage | **Partial** | O(visible)@100k **done** (`datagrid/grid.impl.test.ts:218`, ST-19). Datagrid **bytes∝damage** assertion still **to do** (core has the pattern in `render-bytes-damage.spec.test.ts`). |
| AC-3 golden-screen + a11y | **To do** (bulk of remaining work) | No datagrid color-depth / `NO_COLOR` / ASCII-fallback coverage yet. Reuse core's `golden-screen-helpers.ts` + `a11y-golden.spec.test.ts`; requires adding `@xterm/headless` as a datagrid dev-dep. |
| AC-4 theme roles + byte-freeze | **Done** | 4 roles shipped (`gridCursor`/`gridDirty`/`gridSelectedRow`/`gridInvalid`), present in all three producers, byte-frozen by `datagrid/test/grid-theme.spec.test.ts` (ST-16). |
| AC-5 deps / docs / no-eval | **Done** | `check:deps` + `packaging.e2e.test.ts` green; `check:docs` passes (0 missing `@example`); no `eval`/dynamic-require test present. |
| AC-6 injection sanitize | **Partial** (rescoped) | Cell-value + render/format/lookup-hook sanitize + CSV-**export** escaping **done**. Paste + CSV-**import** surfaces don't exist yet (descoped from RD-13) → their sanitize obligation rides with the import follow-up. |
| AC-7 callback isolation | **Done** (renderer) | Throwing `render` degrades one cell (`cell-rendering.spec.test.ts:144`). Throwing formatter/comparator single-cell degradation is a Should-Have. |
| AC-8 test tiers / gate | **Largely done** | Every RD has spec+impl+smoke; acceptance gate green. Golden-screen tier is the AC-3 gap. |
| AC-9 security verified | **Largely done** | Rolls up AC-5/6/7; only the AC-6 paste/import surfaces (non-existent) remain. |

---

## Functional Requirements

### Must Have

- [ ] **Frame performance** — the generic 200×50 compose+diff 16 ms budget is **already owned by core**
      (`core/perf-budget.spec.test.ts`; the diff engine under test is core's, not datagrid's). Datagrid
      adds a **representative editable-grid bench** (the 60×22 Should-Have) reusing the core `frame-bench.mjs`
      helpers via an **in-repo relative import** — they are exported but not shipped in `dist`, so reuse is
      workspace-local and test-tier only, matching how core's own perf specs consume them; the assertion
      runs off-CI and auto-skips under `CI` / `TUI_SKIP_PERF`.
- [ ] **Bounded memory at scale** — virtual scroll keeps live view/allocation O(visible), not O(rows),
      at 100k rows (RD-11; **done** — `grid.impl.test.ts:218` ST-19 asserts a bounded mounted-view count);
      output bytes are proportional to damage (only changed cells re-serialize) — a datagrid
      bytes-∝-damage assertion is still to add (core's `render-bytes-damage.spec.test.ts` is the pattern).
- [ ] **Security posture (consolidated)** — (a) the core `sanitize` boundary on **all** rendered,
      pasted, and imported text; (b) CSV/formula-injection escaping on export (RD-13); (c) trusted-
      callback isolation — a throwing custom editor/renderer/formatter/comparator degrades one cell,
      never the frame; (d) zero runtime dependencies (`check:deps`); (e) no `eval` / dynamic require;
      (f) client-side validation is UX — server-side (the caller's `onCommit`/source) is the
      authoritative boundary (RD-12).
- [ ] **Accessibility (terminal)** — correct rendering under ASCII-only caps (Unicode glyphs fall back
      to ASCII), `NO_COLOR`, and color-depth downsampling (truecolor→256→16→mono) for every grid glyph
      and role; the terminal-a11y ceiling (no screen-reader semantics beyond what the emulator exposes)
      is documented honestly. **This is the bulk of RD-14's remaining forward work** — datagrid has no
      golden-screen coverage today. Reuse core's emulator harness (`golden-screen-helpers.ts`
      `makeTerm`/`feed`/`readCell`) and mirror `a11y-golden.spec.test.ts` (the `NO_COLOR` +
      Unicode→ASCII oracle); the plan must add `@xterm/headless` as a datagrid dev-dependency (core has
      it; datagrid does not import it yet).
- [x] **Additive core Theme roles (AR-24)** — **DONE.** Four grid-specific `@jsvision/core` roles
      shipped incrementally: **`gridCursor`**, **`gridDirty`**, **`gridSelectedRow`**, **`gridInvalid`**
      (present in all three producers — `defaultTheme`, `rolesFromAliases`, `monochromeTheme` — total
      role count 74). The originally-anticipated `gridFooter` / `gridError` / `gridFunnel` /
      `gridFrozenDivider` were **not** added: the footer and funnel reuse existing list roles, the error
      state became `gridInvalid`, and the frozen divider reuses `listDivider` — the RD's own "reuse where
      the meaning matches" guidance, applied. The bytes are byte-frozen by
      `packages/datagrid/test/grid-theme.spec.test.ts` (ST-16), which also guards `encode()` across all
      four color depths. (Adding a role stays "not free" — compiler-guarded across all three producers,
      bumps the serialized-theme format, ripples into the theme-designer — which is why the set was kept
      to the four genuinely-new states.)
- [ ] **Test tiers** — spec tests (immutable oracles from each RD's acceptance criteria), impl tests
      (internals/edges), e2e (a headless walkthrough), golden-screen (across all four color depths),
      and the mandatory kitchen-sink smoke story per component; JSDoc `@example` governance
      (`check:docs`) and the acceptance gate.
- [ ] **API & packaging governance** — every public export carries JSDoc + `@example`; a `CHANGELOG.md`
      and a "Versioning & stability" policy; lockstep version via `yarn sync-versions`; ESM-only,
      NodeNext, `strict`.

### Should Have

- [ ] The 60×22 representative bench also reports p95 (median is the Must-Have; the 60×22 bench itself
      was promoted to AC-1 since the generic 200×50 budget is core-owned).
- [ ] Throwing-**formatter** and throwing-**comparator** single-cell draw-error isolation (AC-7 covers
      the renderer path; these extend the same guarantee to the other trusted callbacks).
- [ ] A treeshake check (importing one symbol ≪ the whole barrel).

### Won't Have (Out of Scope)

- Full screen-reader / ARIA accessibility — bounded by the terminal emulator (AR #11).
- npm publish — deferred until `@jsvision/ui` is public.

---

## Technical Requirements

### Performance targets

| Metric | Target | How measured |
|--------|--------|--------------|
| Frame compose+diff (200×50) | ≤ 16 ms median | **core-owned** bench, off-CI assert (`core/perf-budget.spec.test.ts`) |
| Representative editable grid (60×22) | ≤ 16 ms median | datagrid bench reusing core `frame-bench.mjs` (relative import), off-CI assert — *to add* |
| Live views at 100k rows | O(visible rows × columns) | view-count assertion — **done** (`grid.impl.test.ts:218`, ST-19) |
| Output bytes | ∝ damaged cells | bytes∝damage test — *to add* (pattern: `core/render-bytes-damage.spec.test.ts`) |

### Theme roles

- Roles are additive to `@jsvision/core`'s theme (the established pattern for every ui subsystem); the
  `packages/datagrid/test/grid-theme.spec.test.ts` spec freezes their attribute bytes so a downstream
  change is caught. Each role is added to `defaultTheme` + `rolesFromAliases` + `monochromeTheme`
  (compiler-enforced) with an alias derivation; persisted themes predating the roles must be migrated
  (they fail `parseTheme` otherwise). **Shipped**: the four roles `gridCursor` / `gridDirty` /
  `gridSelectedRow` / `gridInvalid`.

### Test tier → RD mapping

- Each RD's acceptance criteria become spec-test oracles; the security ACs (sanitize boundary, CSV
  injection, callback isolation, no-native-deps) get dedicated tests; golden-screen covers the visual
  roles at 4 depths.

---

## Integration Points

- Governs every RD: RD-01 packaging/deps, RD-02/03/04 sanitize + callback isolation, RD-11 perf/memory,
  RD-13 CSV injection, and the theme roles RD-04/RD-02/RD-08 paint with.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Perf gating | hard gate / informational | Informational, off-CI assert | Matches the repo's existing bench policy | AR #10 |
| Theme roles | reuse only / additive | Additive core roles | Every ui subsystem does this | AR #24 |
| Callback trust | sandbox / trusted+isolated | Trusted + error isolation | SDK trusted-code model | AR #25 |
| Client validation | authoritative / UX-only | UX-only (server authoritative) | Security standard | AR #26 |

---

## Security Considerations

> This RD is the consolidated security home for the package.

- **Data sensitivity**: the grid renders/edits arbitrary caller data in memory; it persists nothing
  except through the caller's `onCommit`/`RowMutations`.
- **Input validation & sanitization**: **all** text rendered, pasted, or imported passes the core
  `sanitize` boundary; imported/pasted values additionally pass `parse` + the column validator
  (RD-12/RD-13). Server-side validation is authoritative; client validation is UX. *(Paste and import
  are not yet surfaces in the package — export-only today; this is the posture they inherit when the
  import follow-up lands, and where the AC-6 multi-surface injection test will be completed.)*
- **Injection prevention**: control-byte/escape-sequence injection (via cell values, formats, pastes,
  imports) is blocked by `sanitize`; CSV/formula injection is blocked by export escaping (RD-13);
  push-down sort/filter pass structured models, never SQL (RD-05/06/11).
- **Authentication & authorization**: N/A at the widget layer — enforced by the caller's commit/mutation
  seams; the grid never bypasses them.
- **Secrets management**: none handled; the grid has no credentials.
- **Encryption**: N/A (in-process library; transport/storage is the source's concern).
- **Infrastructure hardening**: zero native runtime deps (`check:deps`), no `eval`/dynamic require,
  ESM-only.
- **Security testing**: dedicated tests for the sanitize boundary, CSV formula-injection escaping,
  import sanitize+validate, callback draw-error isolation, and the no-native-deps guard.

---

## Acceptance Criteria

1. [ ] A **representative editable-grid bench (60×22)** reports ≤ 16 ms median off-CI, reusing core's
       `frame-bench.mjs` via a workspace-relative test-only import; under `CI`/`TUI_SKIP_PERF` the hard
       assertion is skipped (informational only). *(The generic 200×50 compose+diff budget is core-owned
       — `core/perf-budget.spec.test.ts` — and is not re-implemented in datagrid.)*
2. [x] A 100k-row grid holds O(visible) live cell views — **done** (`grid.impl.test.ts:218`, ST-19).
   [ ] A single-cell edit re-serializes only the changed cells (bytes∝damage test) — *to add*.
3. [ ] Golden-screen tests render the grid correctly at truecolor / 256 / 16 / mono, and under
       `NO_COLOR` and ASCII-only caps (Unicode glyphs fall back to ASCII) — reusing core's
       `golden-screen-helpers.ts` + `a11y-golden.spec.test.ts` pattern (adds `@xterm/headless` dev-dep).
4. [x] The core Theme roles exist and their attribute bytes are frozen — **done**: four roles
       (`gridCursor`/`gridDirty`/`gridSelectedRow`/`gridInvalid`) byte-frozen by
       `packages/datagrid/test/grid-theme.spec.test.ts` (ST-16); a byte change fails the test.
5. [x] `yarn check:deps` reports zero native runtime deps; `yarn check:docs` passes (every public
       export has an `@example`); there is no `eval`/dynamic require in the package source — **done**
       (`packaging.e2e.test.ts:29`, `security.spec.test.ts:43`, `check:docs` clean).
6. [ ] A control byte injected via a cell value renders/stores sanitized, and a `=SUM()` cell exports
       escaped — **cell-value + export-escape done** (`grid.spec.test.ts:78`, `security.spec.test.ts:746`).
       *Paste and CSV-import are not yet surfaces in the package (descoped from RD-13); their sanitize
       obligation — and the combined multi-surface injection test — ride with the import follow-up when
       that surface lands.*
7. [x] A throwing custom **renderer** degrades a single cell and the rest of the frame renders —
       **done** (`cell-rendering.spec.test.ts:144`). *(Throwing-formatter and throwing-comparator
       single-cell degradation are a Should-Have, not required for this AC.)*
8. [ ] Every capability RD has spec + impl tests and a kitchen-sink smoke story; the acceptance gate is
       green — largely done; the golden-screen tier (AC-3) is the gap.
9. [ ] Security requirements verified: sanitize boundary (AC-6), CSV injection (AC-6), callback
       isolation (AC-7), no-native-deps (AC-5), client-vs-server validation documented (RD-12) — met
       except the AC-6 paste/import surfaces, which do not yet exist.
