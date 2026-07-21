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

---

## Iteration 2 — RD-05 Sorting (focused, code-grounded re-scan)

> **Artifact**: `requirements/RD-05-sorting.md` · **Date**: 2026-07-14 · **Iteration**: 2 (findings continue at PF-011)
> **Outcome**: ✅ **PASSED WITH NOTES** — 2 major · 5 minor · 2 observation, all with decisions. RD-level
> defects applied to `RD-05-sorting.md`; the implementation-architecture findings are resolved *by decision*
> and carried forward to `make_plan` (their proper home — an RD states *what*, not *how*).
> ✅ **Fresh-session review** — RD-05 was authored 2026-07-12; this re-scan ran 2026-07-14 (a different
> session, after RD-01…RD-04 shipped), so same-session bias is low. Every codebase claim cites a real
> `file:line` verified this scan, and the load-bearing architecture call was reconciled against an
> **independent challenger agent** that read the code cold and ranked the options A > B > C.

### Why re-scan a passed RD
RD-05's original audit (iteration 1, above) ran before *any* `@jsvision/datagrid` code existed. RD-01…RD-04
are now shipped, so this scan reality-checks the sorting RD against actual seams — and found real drift plus
several favorable pre-built seams.

### Codebase Context Summary
- **Value-aware sort already works on the reused path.** `toEngineColumn` synthesizes `compare: (a,b) =>
  defaultCompare(c.value(a), c.value(b))` (`packages/datagrid/src/column.ts:151`); `defaultCompare`
  (`column.ts:164`) orders numbers numerically, `Date`s chronologically, strings by `localeCompare`, and
  **nulls last** — so AC-1 ("9 above 1000") and much of "type-aware default + nulls-last" are already built.
- **Push-down seam pre-exists.** `GridDataSource.setSort?(keys: SortKey[])` and `SortKey {columnId, dir}` are
  already declared + barrel-exported (`data-source.ts:15,51`; `index.ts:34`), forward-declared in RD-01.
- **Header is single-column.** The promoted `GridHeader` draws one `▲`/`▼` for one `SortState = {col,dir}|null`
  (a column *index*), reserving a single cell, **no priority digit** (`packages/ui/src/table/grid-rows.ts:412,426,443`);
  `draw()`/`onEvent()` are monolithic single-key with no `super` seam. `columnAt` hit-test is module-private
  and unexported (`grid-rows.ts:45`).
- **Grid deliberately disables sort.** `EditableDataGrid` wraps the header in `ReadonlyGridHeader` that swallows
  `onEvent` (`grid.ts:37`), hard-wires `signal<SortState>(null)` (`grid.ts:132`), and `display` is
  `materialize(source)` in source order (`grid.ts:126`) — it never calls `sortRows`, so the engine sort path
  (`sortRows`/`SortState`/`toEngineColumn.compare`) is **already dead code for the datagrid**.

### Consolidated architecture (the load-bearing output for make_plan)
The findings collapse to one decision: **the datagrid owns its sort model end-to-end.** A container-owned
`Signal<SortKey[]>` is the single source of truth; a **from-scratch** sort header (drawn like the shipped
`EditableGridRows.draw` self-contained override, `editable-grid-rows.ts:279` — *not* a `GridHeader` subclass,
which buys ~1 line and inherits a dead single-key `SortState` field) renders arrows + priority digits from it;
**all** sorting (single-column = a one-element `SortKey[]`) routes through the datagrid's own `sortRowsMulti`.
The ui engine's `SortState`/`sortRows`/`toEngineColumn.compare` path stays untouched and unused by the datagrid
(the ui `DataGrid` still uses it). Reuse `apportionColumns`/`alignCell`/`stringWidth` + the shared
`autoWidths`/`indent` signals for geometry, so header and body agree by construction. Ranked A (own header) >
B (subclass) > C (extend ui) — B/C both still hand-write the multi-key draw/onEvent *and* wrestle the
index↔id mismatch, so they cost more for no reuse dividend.

### Findings

**🟠 PF-011 — Multi-sort header/API model unspecified; RD mis-stated the exposed header's capability.**
*Architecture Mismatch (13.3), Completeness (4), Feasibility (6).* RD claimed the exposed `GridHeader` renders
a priority digit; it renders a single index-based arrow (`grid-rows.ts:426`). The multi-id `SortKey[]` model and
the single-index `SortState` never meet in code. **Resolution:** RD reworded to state the *goal* (arrow +
priority digit) and flag the exposed header's single-arrow limit; the mechanism (own-the-header) is a plan
decision → carried to make_plan.

**🟠 PF-012 — `EditableDataGrid` actively suppresses sort; RD blind to the unwind + a reactive footgun.**
*Impact Blindness (13.4), Ordering (11), Completeness (4).* `ReadonlyGridHeader` + `signal<SortState>(null)` +
class JSDoc (`grid.ts:11,37,132`) must be unwound. **Correctness constraint for the plan:** `source.setSort(keys)`
must fire from a **separate reactive effect** guarded by `if (source.setSort)`, *not* inside the pure `display`
computed (client path stays `display = derived(sortRowsMulti(materialize(source), keys(), map))`). → carried to
make_plan.

**🟡 PF-013 — `SortKey` already declared + exported; RD re-declared it.** *Redundancy (13.5), Consistency (12).*
`data-source.ts:15` + `index.ts:34`. **Resolution:** RD reworded to *finalize* the forward-declared interface,
not declare a second. ✅ Applied to RD.

**🟡 PF-014 — Reuse `defaultCompare`; watch the collator inconsistency.** *Consistency (12), Codebase Alignment (13).*
RD re-specifies a type-aware default that `defaultCompare` already provides; a case-insensitive `Intl.Collator`
default would diverge from `defaultCompare`'s `localeCompare`. Moot under the consolidated architecture (a single
`sortRowsMulti` comparator, one code path). → carried to make_plan (pick one comparator; reuse `defaultCompare`,
parameterize `nulls`).

**🟡 PF-015 — (Corrected from first pass.) Thread `compare`/`nulls` through `sortRowsMulti` only — NOT `toEngineColumn`.**
*Completeness (4).* An earlier recommendation to thread `GridColumn.compare` through `toEngineColumn.compare` was
wrong: that comparator is dead-for-sort on the datagrid path (`column.ts:151`, never read). **Resolution:** single-
sort is a one-element `SortKey[]` through `sortRowsMulti`; `compare`/`nulls` thread there; note `toEngineColumn.compare`
is unused-for-sort. → carried to make_plan.

**🟡 PF-016 — Cursor re-anchor across a re-sort unspecified.** *Edge Cases (9).* `focused`/`selected` are display-
*index* signals (`grid.ts:105`); a re-sort moves the cursor to a different record. **Resolution (recommended):**
re-anchor by **row-key** (enterprise-correct; `rowKey` already on hand). → carried to make_plan.

**🔵 PF-017 — Name the new files + barrel/`@example` obligation** (`sort.ts`, the sort header) so `check:docs` is
planned in — matching how `format.ts`/`cell-draw.ts` were placed. → carried to make_plan.

**🔵 PF-018 — `Depends On: RD-04` is weak.** *Dependency Reality (13.7).* Sorting consumes the value accessor
(RD-01), not `fmt` (RD-04). **Resolution:** RD Integration Points clarified — RD-01 is the functional dependency,
RD-04 is demo-only. `Depends On` header left as-is (RD-04 is Done, so the listing is harmless — no roadmap churn).
✅ Applied to RD.

**🟡 PF-019 — v1 repeat-click behavior undefined between Must (asc/desc) and Should (tri-state none).**
*Ambiguity (1).* Shipped ui toggles asc↔desc (`grid-rows.ts:454`); tri-state (Should) inserts "none".
**Resolution:** RD's Must bullet now states the v1 two-state toggle and scopes "none" to the Should tri-state.
✅ Applied to RD.

### Decisions log — Iteration 2

| Finding | Severity | Decision | Home |
|---|---|---|---|
| PF-011 | MAJOR | ✅ RD mis-statement corrected; mechanism → plan | RD + make_plan |
| PF-012 | MAJOR | ✅ Unwind + `setSort`-as-effect constraint recorded | make_plan |
| PF-013 | MINOR | ✅ Applied — finalize the forward-declared `SortKey` | RD |
| PF-014 | MINOR | ✅ Moot under consolidated arch; reuse `defaultCompare` | make_plan |
| PF-015 | MINOR | ✅ Corrected — thread via `sortRowsMulti`, not `toEngineColumn` | make_plan |
| PF-016 | MINOR | ✅ Re-anchor cursor by row-key | make_plan |
| PF-017 | OBS | ✅ File/barrel/`@example` planned in | make_plan |
| PF-018 | OBS | ✅ Applied — RD-01 is the functional dep; RD-04 demo-only | RD |
| PF-019 | MINOR | ✅ Applied — v1 two-state toggle stated | RD |

**Stage:** RD-05 remains 🔎 *RD Preflighted* (a re-scan does not advance the stage). Next: `make_plan sorting`,
where the architecture findings become Zero-Ambiguity Register entries + the technical design, and the header
A/B/C decision is put to the user.

---

## Iteration 3 — RD-15 DataGrid Showcase App

> **Artifact**: `requirements/RD-15-showcase-app.md` · **Date**: 2026-07-15 · **Iteration**: 3 (findings continue at PF-020)
> **Outcome**: ✅ **PASSED WITH NOTES** — 0 critical · 0 major · 3 minor · 1 observation; all resolved via small RD amendments (user-accepted 2026-07-15).
> ⚠️ **SAME-SESSION REVIEW** — the same agent authored RD-15 and this audit in one session. Bias countered by re-verifying every claim against primary source (`packages/datagrid/src/*`, `packages/examples/kitchen-sink/*`, `packages/theme-designer/src/main.ts`) with `file:line` citations, and by running the adversarial-question checklist. A fresh-session re-review remains advisable.

### Codebase Context Summary

RD-15 targets a **new dev-only example app** (`packages/examples/datagrid-showcase/`) that consumes the **shipped** `@jsvision/datagrid` public barrel and reuses the proven `kitchen-sink` showcase machinery. Recon confirmed:

- **Reuse substrate real & sufficient** — `packages/examples/kitchen-sink/shell.ts:184,319` (`createApplication({caps,menuBar,statusLine})` + `run: () => app.run()`), the persistent sidebar `ListBox`, per-category menu, status hints, `Ctrl`+arrow `NavKeys`, and `buildWelcome`; the `Story` contract (`kitchen-sink/story.ts`), already trimmed-copied into `packages/datagrid/test/kitchen-sink/story.ts`. TTY guard: `kitchen-sink/main.ts`.
- **Demo-able surface real** — the datagrid barrel (`packages/datagrid/src/index.ts`) exports every capability the inventory names; `EditableDataGridOptions` carries `zebra?`/`quickFilter?` (`grid.ts:47,52`) and `filteredCount()`/`totalCount()`/`setFilter`/`clearFilter`/`filterModel()` are public (`grid.ts:454–503`); `CellEditorKind` = the exact 9 kinds the inventory demos (`cell-editor.ts:35`).
- **No dependency cycle** — `@jsvision/examples` → `@jsvision/datagrid` → `@jsvision/ui`/`core`; examples does not currently depend on datagrid (adds it). `demo:datagrid` script name is free.
- **Dist-resolved workspace deps** — both `ui` and `datagrid` `exports` point at `./dist` (`package.json`), so the demo (like every existing one) assumes a built workspace; consistent with convention, no new finding.

### Findings

**🟡 PF-020 — Push-down demos contradict "in-memory `fromRows` only"; the demo source is unspecified.** *Logical Contradiction (3), Completeness (4), Codebase Alignment (13).* The inventory's push-down demos — Sorting §5.5 (`setSort`) and Filtering §6.6 (`setFilter`) — require a `GridDataSource` that implements the **optional** `setSort?`/`setFilter?` seams (`data-source.ts:31,33`), but `fromRows` omits them (`data-source.ts:60–63`, so the grid takes the client path — `grid.ts:233,248`) and the RD's Security section states "demos use in-memory `fromRows` sources only." Resolution: reword the constraint to "in-memory sources only (no network)" and note that the two push-down demos use a **small bespoke in-memory `GridDataSource`** (a spy that filters/sorts in memory but exposes `setSort`/`setFilter`) to exercise the push-down path.

**🟡 PF-021 — Smoke test and headless walkthrough overlap; the walkthrough's distinct job is unstated.** *Testability (7), Redundancy (13.5).* Both tiers "mount each demo headlessly and assert paint." theme-designer's headless path is a **bespoke** `runWalkthrough` separate from `app.run()` (`theme-designer/src/main.ts:16,19`), not the interactive shell. Unless sharpened, the walkthrough is a redundant re-mount of the smoke test. Resolution: state the walkthrough's distinct purpose — it drives the **shell** (sidebar-select → canvas swap → dispose-previous), which the per-demo smoke test does not — so it is built as a navigation/lifecycle guard, not a second render check.

**🟡 PF-022 — Reconciling the NON-NEGOTIABLE kitchen-sink-gate is under-specified.** *Ordering (11), Convention Violations (13.8).* AC #8 depends on editing `codeops/kitchen-sink-gate.md` (which mandates stories in `packages/examples/kitchen-sink/`). Resolution: make the gate-doc reconciliation an explicit plan task, and explicitly record that the general kitchen-sink's existing `data-grid.story.ts` — which demos **ui's read-only `DataGrid`, a different component** — is intentionally retained (so a later reader does not "consolidate" it into the datagrid showcase).

**🔵 PF-023 — Some editing sub-capabilities are internal mechanics better shown through a live grid.** *Feasibility (6).* Overlay lifecycle (`mountCellOverlay`/`absoluteRect`), the two-axis cursor, and the dirty registry are plumbing that a story most naturally demonstrates **through** a live `EditableDataGrid` with a bound-state echo, not as isolated widget harnesses. Non-blocking note for `make_plan`: prefer live-grid demonstrations with visible state over synthetic standalone harnesses for these three.

### Decisions log — Iteration 3

| Finding | Severity | Decision | Applies to |
|---------|----------|----------|-----------|
| PF-020 | MINOR | ✅ Reword Security to "in-memory (no network)" + note a bespoke push-down demo source | RD + make_plan |
| PF-021 | MINOR | ✅ State the walkthrough's distinct shell/navigation purpose | RD + make_plan |
| PF-022 | MINOR | ✅ Gate-doc reconciliation is an explicit task; retain the ui.DataGrid story | RD + make_plan |
| PF-023 | OBS | ✅ Prefer live-grid demonstrations for overlay/cursor/dirty | make_plan |

**Confidence:** High — all four are wording/scoping clarifications on an otherwise sound, code-grounded RD; no CRITICAL/MAJOR, so no independent challenger was spawned (per recommendation-hardening, reserved for high-stakes findings). **Hardening:** in-context adversarial-question checklist run; every code claim carries a `file:line` citation re-verified against primary source.

**Stage:** RD-15 advances to 🔎 *RD Preflighted*. Next: `make_plan datagrid-showcase`, where PF-020…PF-023 become Zero-Ambiguity Register entries + technical-design decisions.

---

# Preflight Scan — RD-16: Column & Variant Personalization Dialog (2026-07-18)

> **Artifact**: `codeops/features/datagrid/requirements/RD-16-personalization-dialog.md`
> **Iterations**: 1 (first scan) → 2 (re-scan after fixes) · **CodeOps Skills Version**: 3.8.0
> **Outcome**: ✅ **PASSED** — all 8 findings resolved at iteration 2 (0 critical · 2 major · 4 minor ·
> 2 observation; user accepted every recommendation 2026-07-18, fixes applied to RD-16 + the register).
> _(Was ❌ BLOCKED at iteration 1 on PF-024/PF-025.)_
> **Findings**: PF-024…PF-031 (numbering continues from RD-15's PF-023; never reused).
> ⚠️ **RECENT-CREATION / SAME-AGENT REVIEW** — RD-16 was created today (2026-07-18) and is still
> untracked in git; the Ambiguity Register was updated the same day. Same-agent bias risk is elevated,
> so every code claim below was verified directly against source, and both MAJOR findings were run past
> one independent adversarial challenger (which confirmed both). A fresh-session re-review is advisable.

## Codebase Context Summary (RD-16)

- **Grid layout/variant API is real and complete for what RD-16 leans on.** Verified on
  `packages/datagrid/src/grid.ts`: `saveVariant`/`applyVariant`/`setFrozen` (`:1148,1173,1132`),
  `setColumnVisible`/`setColumnOrder`/`setColumnWidth` (`:1097,1031,1081`), `columnOrder()` (visible-only,
  `:1020`), `frozen()` (`{left,right}`, resolved partition, `:1111`), `columnWidth(id)` (`:1070`), `sort()`
  (`:879`), `filterModel()` (`:917`). `GridVariant` (`variant.ts:40`) matches the RD's schema. `columnMap`
  is `private` (`:399`); construction order survives only in the private `columnIndex` (`:394,422`).
- **Modal seam matches shipped precedent.** `ModalDialogHost` (`packages/ui/src/dialog/message-box.ts:22`)
  is a real barrel type; `formDialog(host: ModalDialogHost, …)` (`forms/src/form-dialog.ts:194`) confirms the
  RD's "as formDialog uses" claim (`openFile` takes the related `ExecHost`). `confirm()` exists (`:132`) and
  **nested modals are supported** (a modal *stack*, `event/modal.ts:27`) — the RD's nested `confirm()` is feasible.
- **`sanitize` path is established.** `sanitize` lives in `@jsvision/core` (`core/.../safety/sanitize.ts:35`),
  is **already imported** by the datagrid (`export-view.ts:13`), so RD-16's name-sanitize has a real home.
- **"RD-13 Gap 1" is real but mis-located** — defined in the RD-13 *plan* current-state doc
  (`plans/export-import-personalization/02-current-state.md:56`, "No public column-metadata accessor"), not
  the RD-13 requirements doc (→ PF-030).

**Reference verification:** ~30 references mapped — all API/type/dependency references VERIFIED real; the
two MAJORs are behavioral gaps/contradictions, not phantom references.

### Summary by Severity (RD-16 scan)

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 2 | PF-024, PF-025 pending |
| 🟡 MINOR | 4 | PF-026…PF-029 pending |
| 🔵 OBSERVATION | 2 | PF-030, PF-031 |

---

### PF-024: "Reset to defaults" and clearing a width override are not buildable on the proposed surface 🟠 MAJOR

**Dimension:** Codebase Alignment (root) / Completeness / Feasibility
**Location:** RD-16 — Must-Have "Reset to defaults" (lines 53–55); Acceptance Criterion 6 (line 293);
"Set column width" (lines 51–52); Complexity "no new primitives … one reactive accessor and one small
store seam" (lines 204–206).
**Codebase Evidence:** `grid.ts:394,422` (`columnIndex` `private readonly` — the only surviving copy of
construction order); `grid.ts:1081–1087` (`setColumnWidth` only `.set()`s; no clear method exists anywhere);
`grid.ts:1187–1192` + `variant.ts:159` (`applyVariant` seeds `new Map(this.columnWidths())` and only
`.set()`s `widthById` — never deletes).

**The Problem:** RD-16 states the dialog's only new public surface is `grid.columns()` (current state), a
`VariantStore`, and `personalizeGrid()`, committing on OK via `grid.applyVariant(pending)`. Three required
behaviors cannot be produced through that surface:
1. **Construction order is unreachable** by the external helper — `grid.columns()` returns *current* order
   (`columnOrderSig`), which may already differ (header drag / a variant applied on load); the declared
   order survives only in the private `columnIndex`.
2. **No API clears a width override** — `setColumnWidth(id, w: number)` always sets a clamped positive
   width; there is no `clearColumnWidth`/reset, so "width → auto" and Reset's "no width overrides" have no mechanism.
3. **`applyVariant` cannot clear a width override** — it copies current overrides then only sets named ones,
   so a width-less pending column keeps its stale override. Committing a "no width overrides" pending layout
   (Reset, AC#6) leaves overrides in place. **This is also a latent pre-existing bug in shipped RD-13 code.**

**Recommendation:** Option A — budget a grid-owned Reset affordance + correct `applyVariant`'s width
semantics: (i) `grid.resetLayout()` or `grid.defaultLayout(): GridVariant` (grid privately holds
construction order + declared widths); (ii) make `applyVariant`/`resolveVariant` *remove* a named column's
override when the variant carries no width (delete-then-set) — also fixes the RD-13 bug; (iii) add
`clearColumnWidth(id)`. Revise RD-16's "no new primitives" wording (lines 204–206). Rejected alt: "dialog
reconstructs construction order itself" — impossible, the data is private. Option B (drop Reset + width-clear
from v1) regresses the AR-52 user-chosen Must-Have.
`Confidence: High. Hardening: independent challenger CONFIRMED all three sub-points against source + flagged the RD-13 latent bug; recommendation unchanged.`

**User Decision:** Resolved — User accepted the recommendation; fix applied to RD-16 (2026-07-18).

---

### PF-025: Sort/filter handling is self-contradictory (and the Save-as source is ambiguous) 🟠 MAJOR

**Dimension:** Logical Contradictions / Ambiguities
**Location:** RD-16 — §On OK "re-applies the (unchanged) sort/filter" (lines 200–201); Won't-Have "never
edits them" (line 102); Must-Have "Apply a saved variant … replaces the pending layout wholesale (columns,
freeze, sort, filter)" (lines 63–66); AC#8 "sort()/filterModel() reproduce it" (lines 299–301); Must-Have
Save "its sort/filter from the grid's current sort()/filterModel()" (line 61) vs AR-55 "captures the pending
(staged) layout" (line 250).
**Codebase Evidence:** `grid.ts:1194–1195` — `applyVariant` sets both `sortKeys` and `filters` on the live
grid; OK commits pending via `applyVariant` (RD line 200).

**The Problem:** Two internal conflicts on the headline capability (variant management):
- **Contradiction:** §On-OK calls the committed sort/filter "(unchanged)" and Won't-Have says "never edits"
  them — but "Apply a saved variant" replaces pending sort/filter wholesale and AC#8 *requires*
  `grid.sort()`/`filterModel()` to change to reproduce the applied variant. "(unchanged)" and AC#8 cannot
  both hold.
- **Ambiguity:** After applying variant V1 then "Save as V2", V2's sort/filter come from the **live** grid
  (line 61) or the **pending** layout = V1's (AR-55)? Diverges once a variant has been applied.

**Recommendation:** Option A — adopt the model AC#8 already forces: pending **owns** sort/filter from open
onward (seeded once from live); applying a saved variant restages its sort/filter; OK commits them. Reword
all three source spots to agree (Won't-Have → "no sort/filter *editing controls*"; §On-OK → drop
"(unchanged)"; Save-as line 61 → "from the pending layout"). Option B (apply-variant restages columns/freeze
only) contradicts AC#8 and makes variant management lossy — rejected.
`Confidence: High. Hardening: challenger CONFIRMED the contradiction survives the most charitable reading and confirmed the three-spot (seed/Save-as/OK) source ambiguity; recommendation unchanged.`

**User Decision:** Resolved — User accepted the recommendation; fix applied to RD-16 (2026-07-18).

---

### PF-026: Deleting the default variant leaves a dangling `getDefault()` 🟡 MINOR

**Dimension:** Completeness Gaps / Edge Cases
**Location:** RD-16 — `VariantStore` contract (lines 140–151); Must-Have "Delete" / "Mark a default" (lines 67–72).
**The Problem:** The contract never defines what `delete(name)` does when `name` is the current default;
`getDefault()` could then return a name absent from `list()`, breaking the app's load-time
`getDefault()`+`applyVariant` path (AR-50).
**Recommendation:** Specify (single viable) — deleting the current default clears it (`getDefault()` →
`undefined`); the reference in-memory store implements it; add an AC. `Confidence: High.`

**User Decision:** Resolved — User accepted the recommendation; fix applied to RD-16 (2026-07-18).

---

### PF-027: Hiding the last visible column / OK with zero visible columns is undefined 🟡 MINOR

**Dimension:** Edge Cases
**Location:** RD-16 — Must-Have "Show / hide columns" (lines 42–44); Should-Have visible-count echo (line 88).
**The Problem:** The dialog allows toggling every column off; committing zero-visible on OK yields an
unusable grid — neither forbidden nor defined. SAP ALV forbids hiding the last column.
**Recommendation:** Prevent hiding the last visible column (disable its toggle at count == 1) and add an AC.
Considered/dropped: allowing zero visible. `Confidence: High.`

**User Decision:** Resolved — User accepted the recommendation; fix applied to RD-16 (2026-07-18).

---

### PF-028: Over-pinned freeze silently narrows on open+OK; `grid.columns()` reports resolved, not intended, freeze 🟡 MINOR

**Dimension:** Edge Cases / Stale Assumption
**Location:** RD-16 — `grid.columns()` `frozen` "from `frozen()` membership" (lines 113–124); §Pending model
seed (lines 194–196); Must-Have freeze "over-pin guard … one dev warning" (lines 48–50).
**Codebase Evidence:** `grid.ts:1111–1114` `frozen()` returns the *resolved* partition (`partitionSig`, over-pin
folded); `saveVariant` (`:1153`) captures freeze via `this.frozen()`; `maybeWarnOverFreeze` (`:716–723`) warns
**only** when *every* column is frozen (a partial over-pin peel emits no warning).
**The Problem:** Because the pending seed and `grid.columns()` read the resolved freeze, an over-pinned column
reports `frozen:'none'`, and opening+OK (touching nothing) re-commits the narrowed freeze, permanently
dropping the over-pinned intent. Also, "peels the innermost back, with one dev warning" conflates the
partial-peel (no warning) with the all-frozen (warns once) case.
**Recommendation:** Option A — document as a known v1 limitation (modal covers the grid; over-pin is
viewport-dependent; matches shipped `saveVariant`) and correct the "one dev warning" wording. Option B (read
the intended `freezeSpecSig` instead) changes shipped semantics — deferred.
`Confidence: Medium — real but low-frequency (needs an over-pinned grid); documenting is proportionate for v1.`

**User Decision:** Resolved — User accepted the recommendation; fix applied to RD-16 (2026-07-18).

---

### PF-029: Variant-name length rule — "cap 64" (truncate) vs AC "truncated/rejected" 🟡 MINOR

**Dimension:** Consistency / Testability
**Location:** RD-16 — Security "capped at 64 characters" (lines 267–268); AR-56 "cap at 64"; AC#12 "truncated/
rejected at entry" (lines 311–312).
**The Problem:** AR-56/Security say "cap" (truncate); AC#12 says "truncated/rejected" — an untestable
disjunction.
**Recommendation:** Truncate/hard-cap at entry (a `maxLength`, consistent with AR-56); reword AC#12 to
"prevented from exceeding 64 chars at entry". `Confidence: High.`

**User Decision:** Resolved — User accepted the recommendation; fix applied to RD-16 (2026-07-18).

---

### PF-030: "RD-13 Gap-1" cites a gap defined in the RD-13 *plan*, not the RD-13 requirements doc 🔵 OBSERVATION

**Dimension:** Consistency (traceability)
**Location:** RD-16 — Technical Requirements "(the grid's `columnMap` is private — RD-13 Gap-1)" (line 112);
AR-48 "(Resolves RD-13 Gap-1 …)".
**Codebase Evidence:** RD-13 requirements doc contains no "Gap"/"columnMap"/"columns()"; "Gap 1: No public
column-metadata accessor" is defined in `plans/export-import-personalization/02-current-state.md:56`.
**Recommendation:** Optional — reword to "the RD-13 plan's Gap 1" or state the fact plainly.

**User Decision:** Resolved — User accepted the recommendation; fix applied to RD-16 (2026-07-18).

---

### PF-031: Minor descriptive imprecisions in the Technical Requirements prose 🔵 OBSERVATION

**Dimension:** Consistency
**Location:** RD-16 — Technical Requirements composition note (line 114).
**The Problem:** The internal width signal is `columnWidths` (plural); `columnWidth` is the public *method*
and `frozen()` is a *method* over the resolved partition, not a raw signal. Harmless, but names don't match
the code (freeze half overlaps PF-028).
**Recommendation:** Optional — name the actual members (`columnWidths`, `partitionSig`) or soften to
"composes the grid's existing layout signals".

**User Decision:** Resolved — User accepted the recommendation; fix applied to RD-16 (2026-07-18).

---

## Adversarial checklist (same-agent-bias safeguard — RD-16)

- *Authoring assumption I might be confirming:* that OK-via-`applyVariant` is a clean full-replace. It is
  **not** for widths (PF-024) — verified at `grid.ts:1187–1192`.
- *Convention/standard this might violate:* SAP-ALV parity (the stated model) forbids hiding the last column
  (PF-027) and ships an explicit "Default layout" (PF-024 Reset).
- *What a domain expert would flag:* the sort/filter staging model (PF-025) — "does applying a variant change
  the grid's sort on OK?" exposed the contradiction.

## Verdict (RD-16) — iteration 1

**❌ BLOCKED** pending PF-024 and PF-025 (both MAJOR). The RD is otherwise well-grounded: every
RD-07/RD-13/ui API it relies on is real, the staged-modal approach matches shipped precedent, and nested
`confirm()` is feasible. Resolving the two MAJORs is mostly RD wording (PF-025) plus a small, scoped grid-API
addition that also repairs a latent RD-13 bug (PF-024).

---

## Preflight Scan — RD-16 · Iteration 2 (re-scan after fixes, 2026-07-18)

> **Status**: ✅ **PASSED** — all 8 findings verified resolved; 0 new findings; 0 regressions.
> **Previous Iteration**: 8 findings (PF-024…PF-031) — all resolved.
> **This Iteration**: 0 new findings.
> **Carried Forward**: none.

The user chose "apply your recommendations and re-scan." All fixes were applied to
`RD-16-personalization-dialog.md` and `00-ambiguity-register.md`; this iteration re-read the amended RD in
full, verified each fix landed, and swept all 13 dimensions for regressions introduced by the edits.

### Fix verification

| Finding | Fix landed | Where (amended RD-16) |
|---|---|---|
| PF-024 🟠 | Added `grid.defaultColumnLayout()` + `grid.clearColumnWidth()` and a corrected (delete-then-set) `applyVariant` width-restore; Reset seeds from `defaultColumnLayout()`, width field clears via `clearColumnWidth`; Complexity + RD-07 integration updated | §"Reset & width-clear affordances"; Must-Have Reset + Set-width; §Complexity; §Integration RD-07; AC#5/#6 |
| PF-025 🟠 | Single-sourced sort/filter: pending owns them from open (one read of live at seed); apply-a-variant restages; Won't-Have narrowed to "no sort/filter *editing controls*"; "(unchanged)" dropped from On-OK; Save-as sources from pending | Won't-Have; §Pending model; §On OK; Must-Have Save-as; AC#7 |
| PF-026 🟡 | Deleting the default clears the store default; reference impl + `delete` doc + AC updated | `VariantStore.delete`; Must-Have Delete; ref-impl bullet; AC#9 |
| PF-027 🟡 | Last visible column's toggle disabled; zero-visible never committed | Must-Have Show/hide; AC#2 |
| PF-028 🟡 | `grid.columns()` reports the resolved freeze — documented as a v1 limitation; "one dev warning" corrected to the all-frozen case | Must-Have Freeze; §`grid.columns()` note |
| PF-029 🟡 | Name hard-capped/truncated at 64 at entry (removed "rejected" disjunction) | AC#12 (Security section already said "capped") |
| PF-030 🔵 | "RD-13 Gap-1" re-attributed to the RD-13 *plan*'s Gap 1 | §`grid.columns()` intro; register AR-48 |
| PF-031 🔵 | Composition note names the actual members (`columnWidths`, resolved freeze partition) | §`grid.columns()` intro |

### Regression sweep (all 13 dimensions)

- **Contradictions (Dim 3):** The former sort/filter conflict is gone — Won't-Have, §Pending model, §On-OK,
  Save-as (Must-Have) and AC#7/#8 now all state one rule (*pending owns sort/filter from open; applying a
  variant restages them; OK commits them*). The "Save captures" scope-decision row ("Pending layout") agrees.
- **Codebase Alignment (Dim 13):** The three new members are correctly framed as *proposed* additions, not
  claimed-existing (no phantom reference). The supporting claims were re-verified: construction order lives
  in the private `columnIndex` (`grid.ts:394,422`) and declared widths in `engineCols` — so
  `defaultColumnLayout()` is buildable from retained private state; the "latent RD-13 round-trip bug" is real
  (`grid.ts:1187–1192`). `defaultColumnLayout(): readonly GridColumnInfo[]` reuses the existing shape
  consistently (all-visible / `frozen:'none'` / resolved auto width == "no override" baseline).
- **Completeness/Edge (Dim 4/9):** delete-default, last-column, and width-clear edges now have ACs.
- **Consistency (Dim 12):** citation + member-name nits closed; no terminology drift introduced.
- Dimensions 1, 2, 5, 6, 7, 8, 10, 11 — unchanged from iteration 1 (clean); the edits touched none of them.

**No new findings; no regressions.** One pre-existing non-finding left intentionally untouched (not raised
either iteration): AC#1's "byte-for-byte identical" is loose phrasing for a deep-equal on a freshly-derived
array — testable as written, not a defect.

## Verdict (RD-16) — iteration 2

**✅ PASSED.** All 8 findings resolved; the amended RD-16 is internally consistent and code-grounded. The
two MAJOR fixes are doc-complete and carry a small, well-scoped grid-API budget (`defaultColumnLayout()`,
`clearColumnWidth()`, corrected `applyVariant` width-restore) that additionally repairs a latent RD-13 bug —
to be picked up when RD-16 is planned (`make_plan`). **Roadmap:** RD-16 advances to 🔎 *RD Preflighted*.
