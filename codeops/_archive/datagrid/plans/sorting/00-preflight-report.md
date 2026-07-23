# Preflight Report: Sorting (datagrid/RD-05)

> **Status**: ✅ PASSED — all 5 findings resolved (fixes applied to the plan docs) — 0 critical, 0 major, 3 minor, 2 observation
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/datagrid/plans/sorting/`
> **Codebase Grounded**: 18 source/test files examined across `@jsvision/core`, `@jsvision/ui`, `@jsvision/datagrid`; ~30 file:line references verified
> **Last Updated**: 2026-07-15

⚠️ **SAME-SESSION / SAME-DAY REVIEW** — this plan was authored 2026-07-15 (today) by the same model
family. Same-agent bias risk is elevated. Mitigating factors: the load-bearing decision (AR #1, own
the header) was independently challenger-hardened during the RD-05 iteration-2 preflight; every code
claim in this scan was re-verified against the actual source (two of the reviewer's own initial
suspicions — one-arg `bind`, and a suspected `redactEvent` break — were disproven by grounding).

### Codebase Context Summary

**Tech Stack:** TypeScript (ESM-only, NodeNext, strict), yarn 1.x + Turborepo monorepo, vitest, zero runtime deps. Node ≥ 22.
**Architecture:** `@jsvision/core` (published, zero-dep foundation: input decoder, render, safety) → `@jsvision/ui` (Turbo Vision-style widget framework: reactive `signal`/`derived`, `View`/`Group` spine, `GridRows`/`GridHeader` table engine) → `@jsvision/datagrid` (private; typed column model + editable container over the ui engine). Sorting is deliberately suppressed today.
**Key Files Examined:**
- core: `input/events.ts`, `input/mouse.ts`, `input/decoder.ts`, `safety/redact.ts`
- ui: `table/grid-rows.ts`, `table/columns.ts`, `view/view.ts`, `view/types.ts`, `view/draw-context.ts`, `editor/editor-mouse.ts`
- datagrid src: `grid.ts`, `column.ts`, `data-source.ts`, `index.ts`, `editable-grid-rows.ts`
- datagrid test: `grid.spec.test.ts`, `column.spec.test.ts`, `kitchen-sink/stories/index.ts`

**Reference Verification:** ~30 references mapped to code — essentially all verified. Notes: `GridHeader` toggle logic is at `grid-rows.ts:451-459` (plan says 452-460, off by one); `SortState`/`GridHeaderConfig`/`columnAt`/glyphs/`apportionColumns`/`alignCell`/`measureAutoWidths`/`this.derived`/`this.bind`/`this.onMount`/`focusable` all verified as claimed; `type:'mouse'` literal count is ~113 (plan says ~109 — a hedged approximation, immaterial).

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | 0 | — |
| 3 | Logical Contradictions | 0 | — |
| 4 | Completeness Gaps | 1 (PF-001) | 🟡 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 2 (PF-003, PF-004) | 🟡 |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 0 | — |
| 10 | Scope Creep | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | shared (PF-001, PF-002) | 🟡 |
| 13 | Codebase Alignment | 2 (PF-002, PF-005) | 🟡 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 0 | — |
| MINOR | 3 | ✅ all resolved (fixes applied) |
| OBSERVATION | 2 | ✅ all resolved (folded into the plan docs) |

---

### PF-001: `display` and `source` are constructor-locals but the sort API methods reference `this.display()` / `this.source` 🟡 MINOR

**Dimension:** Completeness Gaps / Consistency
**Location:** `03-02-header-and-wiring.md` §Container wiring (the `const display = this.derived(...)` snippet) and §"The sort API" (`applySort`/`sortBy`/`addSort`); `99-execution-plan.md` tasks 3.2.2 / 3.2.4.
**Codebase Evidence:** `packages/datagrid/src/grid.ts:121` (`const { source } = opts;` — local) and `grid.ts:126` (`const display = this.derived(...)` — local const, **not** an instance field).
**The Problem:** `applySort` (03-02:141) reads `const before = this.display()` and `this.source.rowKey(...)`, and `sortBy`/`addSort` read `this.sortKeys()`/`columnMap`. Of these, only `focused`/`selected`/`sortKeys` are class fields today; `display` and `source` are constructor-locals. For the methods to compile, both must be promoted to instance fields (`this.display`, `this.source`). The wiring snippet still shows `const display = …` while a sibling method calls `this.display()` — an internal inconsistency an executor (possibly a cheaper subagent) must reconcile. Caught immediately at typecheck, but the plan reads as precise elsewhere, so the snippets should match.

**Recommendation:** Only one viable resolution — make the plan's snippets consistent: show `display` and `source` as instance fields (`private readonly source`; `private readonly display = this.derived(...)`, or assigned in the constructor), and add a half-line to task 3.2.2/3.2.4 ("promote `display` and `source` to instance fields so `applySort`/`sortBy` can read them"). Considered and dropped: leaving it as-is (relies on the executor silently reconciling — acceptable but below the plan's own precision bar).

**User Decision:** Resolved — accepted recommendation; fix applied. `03-02` wiring snippet now promotes `source`/`columnMap`/`display` to instance fields (and the `sortBy`/`addSort` guards use `this.columnMap`); `99` task 3.2.2 calls out the promotion.

---

### PF-002: `SortHeader.draw` snippets call `alignCell(...)` with 3 args; it requires a 4th `measure` argument 🟡 MINOR

**Dimension:** Codebase Alignment (Convention/Signature) / Consistency
**Location:** `03-02-header-and-wiring.md` §"`draw()`" — `alignCell(title, max(0, w-reserve), 'left')` and `alignCell(title, w, 'left')`.
**Codebase Evidence:** `packages/ui/src/table/columns.ts:179` — `export function alignCell(text: string, width: number, align: ColumnAlign, measure: (s: string) => number): string` (the `measure` arg is **required**, no default). The cited precedent uses the full form: `packages/ui/src/table/grid-rows.ts:428` (`alignCell(col.title, w - 1, 'left', stringWidth)`) and `packages/datagrid/src/editable-grid-rows.ts:364` (`alignCell(col.accessor(row), w, col.align ?? 'left', stringWidth)`).
**The Problem:** As written, the draw snippets won't compile — the `measure` function (`stringWidth`) is missing. Intent is clear (the plan lists `stringWidth` among the reused geometry helpers in `00-index.md:22` and `02-current-state.md`), so this is snippet imprecision, not a design gap — but a literal-following executor would produce a non-compiling first draft.

**Recommendation:** Only one viable resolution — add the `stringWidth` measure argument to the `alignCell(...)` calls in the draw snippet (matching `grid-rows.ts:428`), and ensure `sort-header.ts`'s import list includes `alignCell, stringWidth, apportionColumns` from `@jsvision/ui`. Low stakes; a one-token fix.

**User Decision:** Resolved — accepted recommendation; fix applied. Both `alignCell(...)` calls in `03-02 §draw()` now pass `stringWidth`, and a new **Imports** note names the required 4th `measure` arg + the `@jsvision/ui` symbols `sort-header.ts` pulls in.

---

### PF-003: Plan-local AC-1 "verified by absence" of `sortRows`/`SortState` needs an explicit scope caveat 🟡 MINOR

**Dimension:** Testability / Consistency
**Location:** `01-requirements.md` §Acceptance Criteria, item 1 ("verified by absence (no `sortRows`/`SortState` import in the datagrid sort path)").
**Codebase Evidence:** `packages/datagrid/test/column.spec.test.ts:11` (`import { sortRows } from '@jsvision/ui';`) and `:48`/`:54` (calls `sortRows(..., { col: 0, dir: 'asc' })` — i.e. uses `SortState`) to test the **untouched** `toEngineColumn` adapter.
**The Problem:** The plan (correctly) leaves `toEngineColumn`/`defaultCompare` in place, and its existing spec test legitimately imports `sortRows`/`SortState`. A naive package-wide grep to "verify by absence" would false-positive on this test file and appear to fail AC-1. The intent — that the **new sort path** (`grid.ts`/`sort.ts`/`sort-header.ts`) never imports the ui engine's sort — is correct; the verification method just needs scoping.

**Recommendation:** Only one viable fix — reword AC-1 to scope the absence check to the new sort **source** files (`grid.ts`, `sort.ts`, `sort-header.ts`), explicitly excluding the pre-existing `column.spec.test.ts` adapter test (which is expected to keep importing `sortRows`). No code change; a precision edit to the acceptance criterion so the executor runs the right check.

**User Decision:** Resolved — accepted recommendation; fix applied. `01 §Acceptance Criteria` item 1 now scopes the absence grep to `grid.ts`/`sort.ts`/`sort-header.ts` and names `column.spec.test.ts` as the expected legitimate `sortRows`/`SortState` importer.

---

### PF-004: No datagrid precedent for synthetic mouse-event tests; the container's header is private 🔵 OBSERVATION

**Dimension:** Test Impact / Testability
**Location:** `07-testing-strategy.md` ST-13/ST-14/ST-15/ST-17 (container-level header clicks) and §Implementation Tests (`sort-header.impl.test.ts`: indent/H-scroll hit-test, divider click).
**Codebase Evidence:** The entire datagrid test suite dispatches only **key** events through the loop (`grid.spec.test.ts:107` `key(...)`, `:174` `loop.dispatch(key('f2'))`) and reads the buffer via `createRenderRoot` (`grid.spec.test.ts:48`) — a repo-wide grep found **no** `type:'mouse'`/mouse-`kind:'down'` construction in `packages/datagrid/test`. `EditableDataGrid` exposes only `rows` and `overlay` publicly (`grid.ts:98-101`) — the `SortHeader` instance is private.
**The Problem:** Not a defect — a note so the executor picks the test seam deliberately. Container-level click cases (ST-13/14/15/17) must dispatch a mouse-down through the loop (`loop.dispatch({ type:'mouse', kind:'down', x, y, button:0, ctrl:… })` — the header sits at `y=0`, and mouse routing is hit-test-based, independent of focus). Standalone header cases use the **barrel-exported** `SortHeader` (task 3.2.5) with a synthetic `DispatchEvent` carrying `ev.local`. Both are feasible (the technique is well-used in `@jsvision/ui`, 78 mouse sites) but new to the datagrid suite.

**Recommendation:** Optional — add a one-line note to `07`/task 3.1.1 naming the two seams (loop mouse-dispatch for container-level; barrel-exported `SortHeader` + synthetic `DispatchEvent` for unit-level), so ST-13/14/17 don't stall on "how do I click a private header".

**User Decision:** Resolved — folded in. `07` now carries a **Test-seam note** naming both seams (barrel-exported `SortHeader` + synthetic `DispatchEvent` for unit-level; `loop.dispatch` mouse-down at `y=0` for container-level); `99` task 3.1.1 points to it.

---

### PF-005: Phase 1 doesn't mention `redactEvent`, which reconstructs `MouseEvent` field-by-field (drops the new modifiers) 🔵 OBSERVATION

**Dimension:** Codebase Alignment (Impact) — non-functional
**Location:** `03-02-header-and-wiring.md` §"Phase 1 — core `MouseEvent` modifiers"; `00-ambiguity-register.md` AR #16.
**Codebase Evidence:** `packages/core/src/engine/safety/redact.ts:23` (`RedactedEvent` mouse variant `{ type:'mouse'; kind; button; x; y }` — no modifiers) and `:63` (`return { type:'mouse', kind: event.kind, button: event.button, x: event.x, y: event.y }`).
**The Problem:** **Not a functional break.** `redactEvent` is a log-only helper ("so you never accidentally write a user's keystrokes … into a log", `redact.ts:1-9`); it is **not** on the dispatch path, so the datagrid header still receives the raw `MouseEvent` with the new `ctrl` after Phase 1. It also already drops the wheel event's modifiers (`redact.ts:65`), so omitting mouse modifiers is self-consistent. The only note: after adding modifiers to `MouseEvent`, `redactEvent` won't surface them in a debug log (whereas `KeyEvent` modifiers are logged). Optional parity, not a requirement.

**Recommendation:** Optional — if debug-log parity with `KeyEvent` is wanted, extend `RedactedEvent`'s mouse variant and `redact.ts:63` to carry `ctrl`/`alt`/`shift` (and, for symmetry, the wheel branch too). Otherwise, note in Phase 1 that `redact.ts` was reviewed and intentionally left unchanged, so a future reader knows it wasn't an oversight.

**User Decision:** Resolved — folded in (documented, not changed). `03-02 §Phase 1` now records that `redact.ts` was reviewed and intentionally left unchanged (log-only, off the dispatch path); `99` task 1.2.2 references it.

---

## Verdict

**No CRITICAL or MAJOR findings.** The plan is not blocked. This is a strong, well-grounded plan: a
16-item Zero-Ambiguity Gate, RD-05 preflight iteration 2 + challenger hardening behind the load-bearing
AR #1, correct file:line grounding throughout, sound reactive design (pull-based `derived`;
`applySort`'s before/after `this.display()` re-read is valid because the client-path `display` depends
on `sortKeys`), and a clean migration (no source/test imports `SortKey` by name — the move to `sort.ts`
breaks nothing). The three MINOR findings are snippet/precision fixes; the two OBSERVATIONs are optional.

**Pass tier:** **✅ PASSED** — all 5 findings resolved by applying the fixes to the plan docs (`03-02`,
`01`, `07`, `99`) on 2026-07-15. No CRITICAL/MAJOR were raised, so no hardening challenger was required
(the challenger budget is reserved for CRITICAL/MAJOR). The plan is cleared for execution. Roadmap: the
`sorting` plan row advances to `Plan Preflighted` (🔬).
