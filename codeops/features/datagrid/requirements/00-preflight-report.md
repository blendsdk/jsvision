# Preflight Report — @jsvision/datagrid requirements

> **Artifact**: `codeops/features/datagrid/requirements/` (RD-01…RD-14 + README + 00-ambiguity-register)
> **Date**: 2026-07-12 · **Iteration**: 1 · **CodeOps Skills Version**: 3.4.1
> **Outcome**: ✅ **PASSED** — all 10 findings resolved (0 critical · 3 major · 6 minor · 1 observation). User
> accepted all recommended amendments (2026-07-12); fixes applied to the register + RD-01/02/03/04/05/06/12/14 +
> README. Iteration-2 re-scan clean (it surfaced 2 more RD-06 filler AR citations, folded into PF-003 and fixed).
> _(Was ❌ BLOCKED at iteration 1.)_
> ⚠️ **SAME-SESSION REVIEW** — the same agent authored and is reviewing these RDs. To counter that bias,
> every codebase claim below was re-verified by independent read-only recon agents against primary source
> (`packages/ui/src/table/*`, `packages/core/src/engine/*`, `packages/spike-data-studio/src/*`); citations
> are the real files, not my recollection. A fresh-session re-review is still advisable.

## Codebase Context Summary

- **Grid engine (ui, internal today).** `GridRows<T>`/`GridHeader<T>` (`packages/ui/src/table/grid-rows.ts:76,340`)
  and the pure math `apportionColumns`/`alignCell`/`sortRows`/`measureAutoWidths` (`columns.ts`) are `export`ed
  at source but **NOT on the `@jsvision/ui` barrel** — only `DataGrid` + the `Column`/`ColumnWidth`/`ColumnAlign`/
  `SortState`/`ColumnGeometry` **types** are (`packages/ui/src/index.ts:148-149`). RD-01's "promote the engine"
  is therefore accurate and necessary. None of the to-be-promoted symbols carry an `@example` today (only
  `DataGrid` does) — the `check:docs` cost RD-01 AC-2 names is real.
- **`Column<T>` shape** (`columns.ts:20-35`): `{ title, accessor:(row)=>string, width, align?, compare?, minWidth?, maxWidth? }`.
  The accessor returns a **string**; `sortRows` sorts by that string unless `compare` is supplied. This is the
  crux of PF-002.
- **Subclassing works.** `GridRows` has zero `private` members; all state/geometry a subclass needs is `protected`
  (`display`/`columns`/`indent`/`focused`/`topItem`/`geometry()`). The spike's `EditableGridRows` extends it with
  **no casts** and mounts its editor into a sibling absolute overlay `Group` via `overlay.add(editor)` + `loop.focusView`
  + `overlay.remove` on close (`packages/spike-data-studio/src/editable-grid.ts`, `04-editable-grid.ts:84-117`) — all
  **public** primitives; it does **not** use `openAnchoredPopup`.
- **`GridRowsConfig` already accepts shared `focused`/`selected` signals**, so multiple panels can share one row cursor
  by construction — the grounded resolution for PF-001.
- **Core primitives**: `sanitize` is public (`@jsvision/core` barrel). `openAnchoredPopup` is **ui-internal and
  cross-package unreachable** (ui exposes only `.`). `Input` is subclass-friendly (protected internals, public `valid()`).
  Adding a `Theme` role is compiler-guarded across `defaultTheme` + `rolesFromAliases` + `monochromeTheme`, and
  `parseTheme` rejects persisted theme JSON missing a role (PF-006). `frame-bench.mjs` helpers are exported but not
  shipped in `dist` (in-repo relative reuse only — PF-007).
- **Scaffolding**: clone `packages/files` — fixed-version `@jsvision/*` deps (`"0.2.0"`, not `workspace:*`), the six
  scripts, 8-line tsconfig, 2-project vitest; turbo auto-fans-out (no registration). A `private:true` package is
  excluded from lockstep auto-versioning.
- **`DataGrid` band composition** (`data-grid.ts:151-181`): an inner `col` container of `[fr data | fixed 1-cell]`
  bands (header / body+vbar / hbar). **No footer band today** — RD-09's footer inserts another band (feasible).

---

## MAJOR findings

### PF-001 — Cursor/selection ownership contradiction; RD-07 pinned panels are a hidden foundational dependency
**Dimensions**: Logical Contradiction (3), Dependency (5), Architecture Mismatch (13.3), Ordering (11).
**Evidence**: RD-02 locates the cell cursor on the **row-renderer subclass** — "`EditableGridRows<T>` … adding a
`focusedCol` signal alongside the inherited row `focused`" (RD-02 §Must, AC-3 "focusedCol unchanged, focused = row+1").
RD-07 instead requires **three** `EditableGridRows` panels (left/center/right) and states "The shared model (row cursor,
vertical scroll offset, selection) lives on the **`EditableDataGrid`**; each panel binds to it" (RD-07 §Pinned-panel
layout). These two locations for the cursor are inconsistent. Compounding it: RD-06 (funnel "within each panel's header"),
RD-08 (checkbox/gutter "live in the left-pinned panel (RD-07)"), RD-09 (aggregates "align to the pinned-panel column
geometry"), and RD-10 (mouse mapping "+ the panel split (RD-07)") all build on RD-07's panel model, yet their **Depends On**
headers omit RD-07 and the README dependency graph shows RD-07 as a peer leaf, not a substrate.
**Why it matters**: If RD-01/02 are built assuming a single body (as written), RD-07 forces reworking cursor/selection
ownership and the mouse→cell mapping — the exact "ambiguity here propagates everywhere" RD-01 warns against.
**Grounded resolution (recommended)**: Elevate the three-panel model to a **foundational** decision (RD-02 era, even if
early phases populate only the center panel), and **hoist `focusedCol` + the vertical-scroll offset + selection to
container-owned shared signals injected into each panel's `GridRowsConfig`**. The base engine already shares `focused`/
`selected` this way (`grid-rows.ts` config), so this is additive, not a fight with the engine. Update RD-02 to construct
`focusedCol` as an injected shared signal (not a subclass-internal one), and add the RD-07 dependency edge to RD-06/08/09/10
+ the README graph.
**Alternative** (rejected): keep the cursor on a "primary" panel and mirror to the others — more moving parts, and the
global→(panel,local) column-index mapping still has to live above the panels anyway.

### PF-002 — The `GridColumn<T,V>` → engine `Column<T>` adapter is unstated, and RD-01 AC-3 silently depends on it
**Dimensions**: Completeness (4), Contradiction (3), Testability (7), Codebase Alignment (13).
**Evidence**: RD-01 defines `GridColumn<T,V>` with `value:(row)=>V` / `format` / `parse` and says it "reuses" the engine.
But the engine renders and sorts via `Column<T>.accessor:(row)=>string` and `sortRows` orders by that **string** unless
`compare` is set (`columns.ts:20-35,190`). RD-01 AC-3 asserts "for a numeric column, **`sortRows`** orders by the numeric
`value` … 9 before 1000" — which the promoted `sortRows` does **not** do on a bare string accessor. The only way AC-3 holds
is an adapter that builds `Column.accessor = row => format(value(row))` **and** `Column.compare = (a,b) => cmp(value(a),
value(b))` — the load-bearing reuse seam, which no RD specifies.
**Why it matters**: This adapter is *how* "reuse the ui engine" actually works and *where* value-vs-format correctness lives.
Leaving it implicit, plus an AC that is literally false against the promoted function, undermines the Foundation RD's job.
**Grounded resolution (recommended)**: Add a "Column adaptation" subsection to RD-01 specifying `GridColumn → engine Column`
(accessor from `format∘value` / `String(value)`; `compare` synthesized from `value` + the column's type). Reword RD-01 AC-3
to attribute value-aware ordering to the datagrid's own path (RD-05 `sortRowsMulti` / the compare adapter), not the reused
`sortRows`. While there, confirm each promoted symbol is actually consumed: `alignCell`/`apportionColumns`/`measureAutoWidths`
are load-bearing, but `sortRows` may be **superseded** by RD-05's `sortRowsMulti` (drop it from the promotion list if so).

### PF-003 — The value/format/parse split has no Ambiguity-Register entry; several AR back-references are mis-cited
**Dimensions**: Consistency (12), Zero-Ambiguity gate integrity.
**Evidence**: The register's **AR-23 is "Formatter default locale"**, yet RD-01/RD-04/RD-05 cite "AR #23" for the
**value-vs-display split** — a *different*, and arguably the set's most central, architectural decision, which has **no
dedicated register item**. Other filler citations: RD-05 cites **AR #10** (which is "RD decomposition") for multi-column
sort *and* RD-14 cites AR #10 for perf-gating; RD-04 cites **AR #11** ("terminal-impossible capabilities") for the data-bars
P2 deferral; RD-03 cites **AR #16** ("onCommit sink") for editor-selection and the lookup key-vs-label decision. The gate's
Final-Verification item "every RD decision carries a valid AR back-reference / no AI-assumed defaults" is only superficially met.
**Why it matters**: The register is the gate artifact; a central decision that isn't in it (and is papered over with an
unrelated AR number) is exactly what preflight exists to catch. Low implementation risk, but it is a gate-integrity defect.
**Note**: the *decisions themselves* are sound and user-blessed (the value/format/parse split was proposed and approved in
the 2026-07-12 conversation; AR-12…30 were bulk-accepted). This is a **traceability** fix, not a re-litigation.
**Grounded resolution (recommended)**: Add a register entry for the value/format/parse split (record the conversation
decision), re-point RD-01/04/05 to it, and correct the AR-10/AR-11/AR-16 filler citations to the right item (or add a
register entry where none exists, e.g. lookup-commits-the-key).

---

## MINOR findings

### PF-004 — Overlay helper leans on the ui-internal, cross-package-unreachable `openAnchoredPopup`
RD-01's cell-overlay helper ("a generalization of `@jsvision/ui`'s `openAnchoredPopup`") and RD-03's F4 popup reference
`openAnchoredPopup`, which is **not on the ui barrel** and unreachable by an external package (`popup.ts:208`, ui exports
only `.`). The spike proved a datagrid-owned overlay from **public** primitives (absolute `Group` child + `loop.focusView`
+ add/remove). Lookup/enum editors use the public `ComboBox`, which wraps the popup internally — no direct access needed.
**Resolution**: respecify the overlay helper as datagrid-owned public primitives; drop the `openAnchoredPopup` phrasing (or,
if a shared primitive is genuinely wanted, add `openAnchoredPopup` to RD-01's promotion list — but the self-contained route
is simpler and matches the spike).

### PF-005 — RD-02 keymap extends beyond the proven spike and collides with base `GridRows` bindings
Base `GridRows.handleKey` binds **Home/End = first/last *visible row*** and does **not** inspect Ctrl (so Ctrl+Home/End ==
Home/End); the true row-jump is on **Ctrl+PgUp/PgDn** (`grid-rows.ts:264-275`). RD-02 reassigns Home/End→column-ends and
Ctrl+Home/End→grid-ends, which the subclass must **intercept and return before `super`** — the spike deliberately lets
Home/End fall through (`editable-grid.ts:114`), so this is new, unproven ground.
**Resolution**: note in RD-02/RD-10 that Home/End/Ctrl+Home/End must be intercepted, and that base first/last-row lives on
Ctrl+PgUp/Dn (which RD-02's PgUp/Dn already matches).

### PF-006 — Adding 7 core Theme roles is under-specified as "additive"
Recon confirms adding a `Theme` role forces edits to **three** producers — `defaultTheme`, `rolesFromAliases`,
`monochromeTheme` (compiler-guarded) — needs an **alias derivation per role** so all 13 presets cover it, **bumps the
serialized-theme format** (`parseTheme` rejects persisted JSON missing the role), and ripples into the theme-designer's
role list and any "63 roles" prose. Also, some proposed roles could **reuse existing list roles** (`gridSelected`→`listSelected`,
`gridFrozenDivider`→`listDivider`), reducing the count.
**Resolution**: RD-14 should record these obligations and reconsider which roles are genuinely new vs reused.

### PF-007 — Packaging precision: frame-bench reuse, sync-versions naming, dep protocol
`core/bench/frame-bench.mjs` helpers are exported but not in `dist`/`exports`, so RD-14/RD-11's "reuse the core frame-bench
harness" works **in-repo only** (relative import, like the specs). Also: RD-01's `yarn sync-versions` is `scripts/sync-package-versions.mjs`
(TARGETS = core+ui; needs an entry only if datagrid exports a `VERSION`), a `private:true` package is **excluded from lockstep
auto-versioning**, and `@jsvision/*` deps are pinned exact (`"0.2.0"`), not `"workspace:*"` as RD-01 §Package wiring says.
**Resolution**: minor wording corrections; no design change.

### PF-008 — Async-commit concurrency is unspecified
RD-02/RD-12 apply the edit to the record immediately and allow async `onCommit`/`beforeSave` ("shows dirty until it
resolves"), but never say what happens if the user edits or navigates **while a commit is in flight** (overlapping async
commits, edit-during-pending).
**Resolution**: specify the policy (serialize/queue, or block input on the committing cell) in RD-02 or RD-12.

### PF-009 — Intl inverse-parse is locale-fragile
RD-04 AC-2 requires `parse("€ 10.000,25") === 10000.25`. `Intl` formats but ships **no** parser; the inverse must strip
locale grouping/decimal/currency/percent/sign by hand and is fragile across locales.
**Resolution**: flag that each built-in *editable* formatter must ship a matched, **tested** inverse parser, and that
non-invertible formats mark the column read-only (RD-01's "read-only column may define format without parse" already allows this).

---

## Observation

### PF-010 — README suggested-order is internally inconsistent
README §Suggested Implementation Order (table) lists RD-03 before RD-04; the closing sentence lists RD-04 before RD-03.
Pick one (RD-04 formatting before RD-03 editors is the more defensible order, since editors seed the field from `format(value)`).

---

## Decisions log

User: **"i accept"** (all recommended amendments), 2026-07-12.

| Finding | Severity | Decision | What changed |
|---|---|---|---|
| PF-001 | MAJOR | ✅ Applied | RD-02: cursor/selection/scroll hoisted to container-owned shared signals injected into each panel; body is 1-or-more `EditableGridRows` panels (foundational, not an RD-07 retrofit). RD-07 dep added to RD-06/08/09/10 headers + README graph note. |
| PF-002 | MAJOR | ✅ Applied | RD-01: new §"Column adaptation" (`GridColumn → engine Column`: accessor = `format∘value`, comparator from `value`); AC-3 reworded to credit the datagrid's value-aware sort (RD-05 `sortRowsMulti`), not the reused `sortRows`. |
| PF-003 | MAJOR | ✅ Applied | Register: added AR-31 (value/format/parse split) + AR-32 (lookup commits key); broadened AR-10 to anchor capability/phasing. Re-pointed citations in RD-01/03/04/05/06 + README (AR#23→#31 for the split, AR#16→#32 for lookup-key, AR#11/#16→#10 for phasing). |
| PF-004 | MINOR | ✅ Applied | RD-01/RD-03: overlay helper respecified as datagrid-owned public primitives (absolute `Group` child + `focusView` + add/remove); dropped the "generalization of `openAnchoredPopup`" phrasing (ui-internal/unreachable); lookup uses the public `ComboBox`. |
| PF-005 | MINOR | ✅ Applied | RD-02: Home/End/Ctrl+Home/End + `←`/`→` reassignments intercept before `super` (base binds them to visible-row-ends / h-scroll; base row-jump = Ctrl+PgUp/Dn). |
| PF-006 | MINOR | ✅ Applied | RD-14: theme-role obligations recorded (3 compiler-guarded producers + per-role alias derivation + serialized-format bump + theme-designer ripple); some roles may reuse `listSelected`/`listDivider`. |
| PF-007 | MINOR | ✅ Applied | RD-01: fixed dep version pin (`"0.2.0"`, not `workspace:*`) + lockstep/private wording; RD-14: frame-bench reuse noted as in-repo relative. |
| PF-008 | MINOR | ✅ Applied | RD-02 + RD-12: async-commit concurrency specified (cell locked during in-flight gate; overlapping per-cell commits serialized). |
| PF-009 | MINOR | ✅ Applied | RD-04: each editable formatter must ship a matched, tested inverse (`Intl` has no parser); non-invertible ⇒ read-only. |
| PF-010 | OBS | ✅ Applied | README: suggested-order table aligned to RD-04-before-RD-03 (formatting seeds the editor field). |
