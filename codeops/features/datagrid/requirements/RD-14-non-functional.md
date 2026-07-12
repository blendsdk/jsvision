# RD-14: Non-Functional Requirements

> **Document**: RD-14-non-functional.md
> **Status**: Draft
> **Created**: 2026-07-12
> **Project**: @jsvision/datagrid — enterprise-class editable data grid (TUI)
> **Depends On**: — (cross-cutting; governs RD-01…RD-13)
> **CodeOps Skills Version**: 3.4.1

---

## Feature Overview

The cross-cutting quality bar the whole package must meet: frame performance at scale, the
consolidated security posture, terminal accessibility, the additive core Theme roles, the test-tier
strategy, and API/packaging governance. This RD is the single home for requirements that no single
capability RD owns but all must honor.

---

## Functional Requirements

### Must Have

- [ ] **Frame performance** — a visible-window compose+diff for a 200×50 viewport meets the framework's
      16 ms frame budget (median), measured by a bench (reusing the core `frame-bench.mjs` helpers via an
      **in-repo relative import** — they are exported but not shipped in `dist`, so reuse is
      workspace-local, matching how core's own perf specs consume them); the assertion runs off-CI and
      auto-skips under `CI` / `TUI_SKIP_PERF`.
- [ ] **Bounded memory at scale** — virtual scroll keeps live view/allocation O(visible), not O(rows),
      at 100k rows (RD-11); output bytes are proportional to damage (only changed cells re-serialize).
- [ ] **Security posture (consolidated)** — (a) the core `sanitize` boundary on **all** rendered,
      pasted, and imported text; (b) CSV/formula-injection escaping on export (RD-13); (c) trusted-
      callback isolation — a throwing custom editor/renderer/formatter/comparator degrades one cell,
      never the frame; (d) zero runtime dependencies (`check:deps`); (e) no `eval` / dynamic require;
      (f) client-side validation is UX — server-side (the caller's `onCommit`/source) is the
      authoritative boundary (RD-12).
- [ ] **Accessibility (terminal)** — correct rendering under ASCII-only caps (Unicode glyphs fall back
      to ASCII), `NO_COLOR`, and color-depth downsampling (truecolor→256→16→mono) for every grid glyph
      and role; the terminal-a11y ceiling (no screen-reader semantics beyond what the emulator exposes)
      is documented honestly.
- [ ] **Additive core Theme roles (AR-24)** — new `@jsvision/core` roles for the grid-specific states
      (`gridCursor`, `gridDirty`, `gridFooter`, `gridError`, `gridFunnel`; plus `gridSelected` /
      `gridFrozenDivider` **only if** their meaning doesn't already match `listSelected` / `listDivider`,
      which they MAY reuse), decoded against the list-viewer palette where a TV counterpart exists,
      otherwise chosen from the DOS-16 palette, and byte-frozen by a `datagrid-theme` spec. Adding a role
      is additive but **not free**: it is compiler-guarded across the three `Theme` producers
      (`defaultTheme`, `rolesFromAliases`, `monochromeTheme`), so each new role needs an alias-derivation
      in `rolesFromAliases` (so all presets cover it); it **bumps the serialized-theme format** (a
      persisted theme JSON missing the new role fails `parseTheme` — migration required); and it ripples
      into the theme-designer's role list. Minimize the genuinely-new set by reusing existing list roles
      where the meaning matches.
- [ ] **Test tiers** — spec tests (immutable oracles from each RD's acceptance criteria), impl tests
      (internals/edges), e2e (a headless walkthrough), golden-screen (across all four color depths),
      and the mandatory kitchen-sink smoke story per component; JSDoc `@example` governance
      (`check:docs`) and the acceptance gate.
- [ ] **API & packaging governance** — every public export carries JSDoc + `@example`; a `CHANGELOG.md`
      and a "Versioning & stability" policy; lockstep version via `yarn sync-versions`; ESM-only,
      NodeNext, `strict`.

### Should Have

- [ ] A grid-specific frame-perf bench (median/p95 for a representative 60×22 editable grid).
- [ ] A treeshake check (importing one symbol ≪ the whole barrel).

### Won't Have (Out of Scope)

- Full screen-reader / ARIA accessibility — bounded by the terminal emulator (AR #11).
- npm publish — deferred until `@jsvision/ui` is public.

---

## Technical Requirements

### Performance targets

| Metric | Target | How measured |
|--------|--------|--------------|
| Frame compose+diff (200×50) | ≤ 16 ms median | bench, off-CI assert |
| Live views at 100k rows | O(visible rows × columns) | view-count assertion (RD-11) |
| Output bytes | ∝ damaged cells | bytes∝damage test |

### Theme roles

- Roles are additive to `@jsvision/core`'s theme (the established pattern for every ui subsystem); a
  `datagrid-theme` spec freezes their attribute bytes so a downstream change is caught. Each role is
  added to `defaultTheme` + `rolesFromAliases` + `monochromeTheme` (compiler-enforced) with an alias
  derivation; persisted themes predating the roles must be migrated (they fail `parseTheme` otherwise).

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
  (RD-12/RD-13). Server-side validation is authoritative; client validation is UX.
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

1. [ ] The 200×50 compose+diff bench reports ≤ 16 ms median off-CI; under `CI`/`TUI_SKIP_PERF` the hard
       assertion is skipped (informational only).
2. [ ] A 100k-row grid holds O(visible) live cell views (asserted), and a single-cell edit re-serializes
       only the changed cells (bytes∝damage test).
3. [ ] Golden-screen tests render the grid correctly at truecolor / 256 / 16 / mono, and under
       `NO_COLOR` and ASCII-only caps (Unicode glyphs fall back to ASCII).
4. [ ] The new core Theme roles exist and their attribute bytes are frozen by a `datagrid-theme` spec
       (a byte change fails the test).
5. [ ] `yarn check:deps` reports zero native runtime deps; `yarn check:docs` passes (every public
       export has an `@example`); there is no `eval`/dynamic require in the package source.
6. [ ] A control byte injected via a cell value, a paste, and a CSV import each renders/stores sanitized
       (three-surface injection test); a `=SUM()` cell exports escaped.
7. [ ] A throwing custom renderer/editor degrades a single cell and the rest of the frame renders
       (draw-error isolation test).
8. [ ] Every capability RD has spec + impl tests and a kitchen-sink smoke story; the acceptance gate is
       green.
9. [ ] Security requirements verified: sanitize boundary (AC-6), CSV injection (AC-6), callback
       isolation (AC-7), no-native-deps (AC-5), client-vs-server validation documented (RD-12).
