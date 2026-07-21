# Preflight Report — RD-14 Non-Functional Requirements (re-audit)

> **Artifact**: `codeops/features/datagrid/requirements/RD-14-non-functional.md`
> **Date**: 2026-07-18 · **Iteration**: 1 · **CodeOps Skills Version**: 3.9.0
> **Scope**: a targeted re-preflight of RD-14 alone, against the codebase **as it exists after
> RD-01…RD-13 shipped**. Complements — does not replace — the whole-set `00-preflight-report.md`
> (2026-07-12), whose RD-14 pass predated most of the implementation this audit reconciles against.
> **Not a same-session review**: RD-14 was authored 2026-07-12, not in this session.
> **Grounding**: three independent read-only recon agents verified every codebase claim below
> against primary source (`packages/core/src/engine/color/*`, `packages/core/bench/*`,
> `packages/datagrid/test/*`, both packages' `package.json`/`tsconfig.json`); citations are real
> `file:line`, not recollection.

## Codebase Context Summary

RD-14 is the cross-cutting NFR home. Written 2026-07-12, it reads as **all-future work**, but by
2026-07-18 a large fraction of its Must-Haves shipped incrementally with the capability RDs — often
under **different names than the RD records**. The audit's centre of gravity is therefore
Dimension 13 (Codebase Alignment): *stale assumptions* and *scope-vs-reality*, not document logic.

Reality snapshot (all verified):

- **Grid theme roles = exactly 4**: `gridCursor` (`theme.ts:221`), `gridDirty` (`:227`),
  `gridSelectedRow` (`:236`), `gridInvalid` (`:244`) — present in all three producers
  (`defaultTheme` `theme.ts:396-399`, `rolesFromAliases` `roles.ts:103-119`, `monochromeTheme`
  `presets.ts:122-125`). Total role count **74**, asserted at `severity-text-theme.spec.test.ts:35`.
- **Byte-freeze spec already exists**: `packages/datagrid/test/grid-theme.spec.test.ts` (ST-16)
  pins all four roles' attribute bytes + an all-depth `encode()` no-throw guard.
- **frame-bench helper exists in core** (`packages/core/bench/frame-bench.mjs`, exports
  `measureComposeDiff`/`median`/`p95`/`perfBudgetMode`), **not shipped in dist/npm**; consumed by
  core's own perf specs via a relative import (`perf-budget.spec.test.ts:24`). `yarn bench` is
  off-CI/informational; the 16 ms assertion (`perf-budget.spec.test.ts:33`, `BUDGET_MS=16`) skips
  under `CI`/`TUI_SKIP_PERF` via `perfBudgetMode` (`frame-bench.mjs:144`).
- **Datagrid is export-only**: `export-view.ts` exists; there is **no** paste and **no** import
  surface in `packages/datagrid/src` (both descoped from RD-13 to a follow-up).
- **Security oracles largely shipped per-RD**: sanitize boundary, CSV/formula escaping, throwing-
  renderer isolation, no-native-deps — all present (see PF entries for `file:line`).
- **Golden-screen / color-depth / NO_COLOR / ASCII-fallback**: **zero** coverage in datagrid
  (~55 tests pin a single `truecolor` depth); core has the full reusable pattern
  (`golden-screen.spec.test.ts`, `a11y-golden.spec.test.ts`, `golden-screen-helpers.ts`).
- **CHANGELOG.md**: absent for datagrid (the only workspace package without one) **and** dangling
  in its `package.json` `files` array.

## Findings

### 🟠 PF-001 — Theme-role enumeration is stale; AC-4 is already satisfied under different names
**Dimension 13 (Stale Assumptions / Phantom References).** RD-14 (FR lines 42-52 + AC-4) enumerates
grid roles `gridCursor, gridDirty, gridFooter, gridError, gridFunnel` (+ conditionally
`gridSelected`/`gridFrozenDivider`). Reality: only **4** grid roles were ever added —
`gridCursor`, `gridDirty`, `gridSelectedRow`, `gridInvalid`. So:
- `gridFooter`, `gridError`, `gridFunnel`, `gridFrozenDivider` are **phantom** — footer/funnel reuse
  existing list roles; the error state became `gridInvalid`; the frozen divider reuses `listDivider`.
- `gridSelected` shipped as **`gridSelectedRow`** (different name).
- `gridInvalid` exists but the RD never names it.
- AC-4's byte-freeze spec exists as `grid-theme.spec.test.ts` (the RD implies a `datagrid-theme`
  filename). **AC-4 is effectively DONE.**

Options: **(A, recommended)** amend the RD's role list to the 4 real names, note the reuse decisions
for footer/funnel/frozen-divider, and mark AC-4 satisfied by `grid-theme.spec.test.ts`; (B) leave
the RD and only record the divergence here. → **Recommend A** (the RD is the closeout spec; a wrong
role list will mislead the plan into "adding" roles that already exist or don't belong).

### 🟠 PF-002 — AC-6's three-surface injection test targets surfaces that don't exist
**Dimension 13 (Scope vs. Reality) + Dimension 4 (Completeness) + Dimension 6 (Feasibility).**
AC-6 (line 151) requires a control byte injected via **cell value + paste + CSV import** each
rendering sanitized. But datagrid has **no paste surface and no import surface** — both were
explicitly deferred from RD-13 to a follow-up. The cell-value surface and CSV-*export* escaping are
tested (`grid.spec.test.ts:78`, `security.spec.test.ts:66/746`); the combined three-surface test is
**infeasible against today's package**.

Options: **(A, recommended)** narrow AC-6 now to the surfaces that exist (cell value + all render/
format/lookup hooks + CSV-export escaping), and move the paste/CSV-import sanitize obligation to
ride with the import follow-up (RD-13's deferred slice / RD-16 neighbourhood); (B) keep AC-6 as
written and mark paste/import "N/A until implemented". → **Recommend A** — an AC that can't be
satisfied by the shipping package blocks the pass tier for no real gain; the obligation is real but
belongs where the surface lands.

### 🟠 PF-003 — AC-1/AC-2 datagrid benches are absent; the "reuse via relative import" crosses a package boundary
**Dimension 13 (Dependency Reality / Convention) + Dimension 6.** AC-1 (200×50 compose+diff ≤16 ms)
and the **bytes-∝-damage** half of AC-2 have **no datagrid test** — both live only in core
(`perf-budget.spec.test.ts:33`, `render-bytes-damage.spec.test.ts:27`). Note the compose+diff/damage
engine *is* core's, not datagrid's. AC-2's other half — **O(visible) live views at 100k rows** —
**is** proven in datagrid (`grid.impl.test.ts:218`, ST-19). The RD's stated mechanism ("reuse core's
`frame-bench.mjs` via an in-repo relative import") is mechanically possible but drags in core's
**source** (bypasses `exports`/`files`), unlike every other datagrid→core dependency which goes
through the built `@jsvision/core` dist surface.

Options: **(A, recommended)** for AC-1, rely on core's existing 200×50 budget test (the engine under
test is core's) and give datagrid a **representative editable-grid bench** (the RD's own Should-Have,
60×22) reusing `frame-bench.mjs` via the workspace-relative import — same pattern core's own specs
already use, test-tier only so never shipped; for AC-2, add the datagrid bytes-∝-damage assertion (a
single-cell edit re-serializes only changed cells) and keep ST-19 as the O(visible) half;
(B) add a datagrid 200×50 bench that duplicates core's; (C) drop AC-1 for datagrid entirely.
→ **Recommend A** — measures what datagrid actually owns, avoids duplicating core's engine bench,
and treats the relative bench import as an accepted test-only seam.

### 🟠 PF-004 — AC-3 (golden-screen 4 depths + NO_COLOR + ASCII fallback) is the largest genuinely-unbuilt item
**Dimension 4 (Completeness) + Dimension 6 (Feasibility).** Datagrid has **zero** emulator
golden-screen coverage: no `@xterm/headless` import, no 256/16/mono render matrix, no `NO_COLOR`
test, no Unicode→ASCII glyph-fallback test. The nearest thing (`grid-theme.spec.test.ts:48`) only
asserts `encode()` doesn't throw at each depth — not a rendered screen. This is legitimate net-new
work, correctly specified; the RD is not wrong, it's just *unbuilt*. Feasibility is good: core has
the exact reusable pattern (`golden-screen-helpers.ts` `makeTerm`/`feed`/`readCell`;
`a11y-golden.spec.test.ts` is the NO_COLOR + ASCII-fallback oracle to mirror). Open feasibility
question for the plan: whether `@xterm/headless` is available as a datagrid dev-dependency (core has
it; datagrid does not import it today).

Options: **(A, recommended)** keep AC-3 in full, plan it to reuse core's helpers, and verify the
`@xterm/headless` dev-dep is added to datagrid; (B) reduce AC-3 to a representative-screen smoke at
each depth (lighter than a full matrix). → **Recommend A**, noting this is the bulk of RD-14's
remaining effort and the one AC that is real forward work rather than reconciliation.

### 🟡 PF-005 — datagrid CHANGELOG.md is missing *and* dangling in `files`
**Dimension 13 (Convention) + governance FR (lines 57-59).** `packages/datagrid/` has no
`CHANGELOG.md` (the only workspace package lacking one), yet `package.json:44` lists `"CHANGELOG.md"`
in `files` — so `npm pack` would reference a non-existent file. Publish is deferred (Won't-Have), so
low urgency, but it's a concrete governance defect AC-5 implies.
Options: **(A, recommended)** add a stub `CHANGELOG.md` now (fixes the dangling `files` reference at
the same time); (B) remove it from `files` until publish. → **Recommend A**.

### 🟡 PF-006 — RD metadata is stale and the "already-shipped" reality is invisible
**Dimension 12 (Consistency).** `Status: Draft` and `CodeOps Skills Version: 3.4.1` (running 3.9.0);
more importantly, the RD reads as entirely-future when ~half its Must-Haves shipped. A reader/planner
can't tell done from to-do.
Options: **(A, recommended)** add a short "Implementation status" reconciliation (per-AC: done /
partial / to-do with the `file:line` evidence from this report) and refresh the metadata; (B) refresh
metadata only. → **Recommend A** — it turns RD-14 into an accurate closeout checklist.

### 🔵 PF-007 — AC-7 draw-error isolation is proven for a renderer only
**Dimension 4.** `cell-rendering.spec.test.ts:144` proves a throwing **`render`** degrades one cell
while the frame survives. The FR (line 34) names *editor/renderer/formatter/comparator*; throwing
**formatter** and **comparator** single-cell degradation aren't separately proven (editor-side
throws are covered as veto/no-crash, `validation.impl.test.ts:85`, `commit.spec.test.ts:102`).
Optional: add a throwing-formatter and throwing-comparator isolation case, or narrow AC-7's wording
to the renderer path it actually guarantees.

## Decisions (2026-07-18) & resolutions

All findings resolved by the user (accepted every recommendation):

| PF | Decision | Applied |
|----|----------|---------|
| PF-001 | Amend to the 4 real role names; mark AC-4 done | RD FR + Tech-req + AC-4 rewritten; roles `gridCursor`/`gridDirty`/`gridSelectedRow`/`gridInvalid`; spec is `grid-theme.spec.test.ts` |
| PF-002 | Narrow AC-6 to real surfaces; defer paste/import | AC-6 + Security §Input-validation annotated; obligation rides with the import follow-up |
| PF-003 | Datagrid representative bench (60×22) reusing core `frame-bench.mjs`; core keeps the 200×50 | AC-1 rescoped; perf-targets table updated; bytes-∝-damage kept as to-do, ST-19 marked done |
| PF-004 | Keep AC-3 full matrix, reuse core helpers | AC-3 annotated with `golden-screen-helpers.ts` + `a11y-golden` reuse + `@xterm/headless` dev-dep note |
| PF-005 | Add stub CHANGELOG.md | `packages/datagrid/CHANGELOG.md` created (also fixes the dangling `files` entry) |
| PF-006 | Add per-AC implementation-status table + refresh metadata | "Implementation Status" table added; `Status`/skills-version refreshed |
| PF-007 | Tighten AC-7 to the renderer path | AC-7 scoped to renderer; formatter/comparator isolation moved to Should-Have |

## Outcome

✅ **PREFLIGHT PASSED — all 7 findings resolved** (0 critical · 4 major · 2 minor · 1 observation).

RD-14 is now an accurate closeout spec. Its remaining real work: **AC-3 golden-screen/a11y** (net-new,
the bulk), a **datagrid representative 60×22 bench + a bytes-∝-damage assertion** (AC-1/AC-2), and
completing paste/import sanitize when that surface lands (AC-6) — the theme-role, deps/docs, and
callback-isolation ACs are already satisfied. **Next**: `make_plan` for RD-14.

> **Confidence: High.** Every claim is triangulated by three independent read-only recon agents
> against primary `file:line` source — the independent challenge is built into the recon.
> **Hardening**: recon-triangulated; no separate challenger spawned because the findings are factual
> code reconciliations, not judgement calls.
