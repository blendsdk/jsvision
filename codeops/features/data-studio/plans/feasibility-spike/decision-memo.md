# Data Studio — Feasibility Decision Memo

> The spike's deliverable. Backed by runnable evidence in `packages/spike-data-studio/` (each probe is
> a `tsx` script; captured output in `packages/spike-data-studio/evidence/*.txt`). The code is
> throwaway — delete it once the decision is acted on.

**Executed by:** Claude (Opus 4.8) · 2026-07-09
**Environment:** PostgreSQL 16.14 via `docker postgres:16` on port 5433, `pg` 8.22.0 (pure JS, **no
native build**), Node v22.14.0. Framework built once (`yarn build`); the spike imports `@jsvision/ui`
/`@jsvision/core` by name (built `dist`). Workspace is inert to `yarn verify` (no build/test/typecheck
scripts — turbo lists the tasks as `<NONEXISTENT>` and runs nothing).

---

## TL;DR — recommendation

**Verdict:** ☐ GO  ☒ **GO-WITH-CAVEATS**  ☐ NO-GO

**Single strongest reason:** Both make-or-break integration risks resolved favourably against real
Postgres — the in-cell **editor overlay** mounts and routes cleanly in the existing view/compose/overlay
model (Probe 4, 🟢), and **server-side windowed paging** feeds the *unmodified* `DataGrid` through a
`Proxy` dense-array (Probe 3b, 🟡) — so the two novel subsystems (RecordSet spine + editable grid) are
buildable on jsvision essentially as-is. The caveats are additive framework work with clear designs, not
architectural blockers.

**If GO, the recommended first slice:** A read-only PG table browser (introspect → windowed `DataGrid`),
then the editable grid + `RecordSet` over a single-PK table — i.e. productise the exact vertical thread
the spike ran (Probes 1→3→4→5), plus the small framework additions listed below. Ship trusted TS event
handlers from day one (near-free); defer reports/QBE/designer/sandbox.

**Confidence:** **High** — every layer was exercised end-to-end against a live database with a
deliberate edge-case schema (composite/no PK, enum, generated col, FK, CHECK, jsonb/array/uuid, a
read-only view, and a 100k-row table), not analysed on paper. The residual unknowns are scoped and
listed.

---

## Verdict scorecard

| Probe | Subsystem | Verdict | Effort (S/M/L/XL) | Evidence |
|-------|-----------|---------|-------------------|----------|
| 0 | Setup / `pg` connect | 🟢 | — | `evidence/` (smoke), `src/00-smoke.ts` |
| 1 | Introspection & type mapping | 🟢 | S | `evidence/probe1-introspect.txt`, `src/introspect.ts` |
| 2 | CRUD / txn / concurrency | 🟢 | S | `evidence/probe2-crud.txt`, `src/crud.ts` |
| 3 | **RecordSet spine + paging** | 🟢 spine / 🟡 paging | M | `evidence/probe3a-recordset.txt`, `probe3b-paging.txt`, `src/record-set.ts` |
| 4 | **Editable grid + editor overlay** | 🟢 | M | `evidence/probe4-editable-grid.txt`, `src/editable-grid.ts` |
| 5 | Bound form (shared spine) | 🟢 | M | `evidence/probe5-bound-form.txt`, `src/05-bound-form.ts` |
| 6 | Scripting / event model | 🟢 (trusted) | S | `evidence/probe6-scripting.txt` |
| 7 | Scale & perf | 🟢 | S | `evidence/probe7-scale.txt`, `src/windowed-source.ts` |

Legend: 🟢 works / low risk · 🟡 works with caveats or open work · 🔴 blocked / fights the framework.

---

## Probe findings (detail)

### Probe 0 — Setup
- **Finding:** `pg` connects, `SELECT 1` returns, seed applied (incl. 100k rows), `import { DataGrid }
  from '@jsvision/ui'` resolves by name. `pg` 8.22 is pure JS — no native build, so a Data Studio **app**
  package may depend on it without tripping the `check:deps` guard (which only inspects published
  packages). The workspace is inert to turbo/verify.
- **Evidence:** `src/00-smoke.ts`.

### Probe 1 — Introspection & type mapping
- **Fully describable?** Yes — one `introspect(schema, table)` over `pg_catalog` returns columns (real
  PG type via `format_type`, nullability, defaults, generated/identity), primary key (incl. **composite**
  `order_item(order_id, line_no)` and **no-PK** `tag`), foreign keys, CHECK constraints, enum value sets,
  and `pg_relation_is_updatable` (the view `customer_summary` correctly reports **updatable=false**).
- **Type → editor table** (distinct types across the seed; 8 trivial / 4 needs-work / 0 blocking):

  | PG type (in seed) | Proposed editor | Verdict |
  |-------------------|-----------------|---------|
  | text | Input | trivial |
  | integer / serial | Input (+ int range) | trivial |
  | numeric(12,2) | Input (+ decimal filter) | trivial |
  | boolean | CheckGroup | trivial |
  | date | DatePicker | trivial |
  | enum (customer_tier) | dropdown (values from `pg_enum`) | trivial |
  | bigint | Input | trivial |
  | timestamptz | DatePicker (date half) + time field | needs-work (no time-of-day widget) |
  | uuid | Input (guarded; usually system-gen) | needs-work |
  | integer[] | raw-text (`{1,2}`) | needs-work |
  | jsonb | raw-text / multiline | needs-work |
  | generated (`available`) | read-only | read-only (correctly detected) |

- **What the catalog can't tell us:** FK **display labels** (needs a per-FK lookup query), human field
  captions/help, business rules beyond CHECK, and the *meaning* of jsonb/array contents.
- **Gotcha discovered:** `array_agg(attname)`/`enumlabel` return type `name[]` (OID 1003/1009-adjacent),
  which node-postgres does **not** parse — it hands back the raw `"{id}"` string. Every catalog array
  must be cast `::text` in the query. (Cost the spike two iterations; worth a note in any introspection
  code.)

### Probe 2 — CRUD / transactions / concurrency
- **CRUD (parameterized):** offset + keyset `SELECT`, `INSERT … RETURNING`, `UPDATE … WHERE <pk>`,
  `DELETE … WHERE <pk>` — all bound params, zero string interpolation of data.
- **Transactions:** a multi-row edit inside `BEGIN…` reverts fully on a thrown error (verified balance +
  credit_limit both unchanged after rollback).
- **Concurrency strategy chosen:** **`xmin` system column** — cheap (no schema change, free per-row
  version token), robust for same-row conflict detection. `UPDATE … WHERE pk AND xmin=$expected`; 0 rows
  ⇒ conflict. Demonstrated: stale-xmin write → **CONFLICT DETECTED (0 rows)**; re-read fresh xmin → write
  succeeds. Caveat (documented): `xmin` wraps on FREEZE — fine for interactive optimistic UI, not for a
  durable version log; an `updated_at`/version column is the alternative if that matters.
- **Composite-PK (`order_item`):** editable — the key is just a multi-column `WHERE`. Verified.
- **No-PK (`tag`):** **read-only decision.** A full-row match is ambiguous with duplicate rows; `ctid`
  identifies a physical row but changes on UPDATE/VACUUM. UX: read-only, or require the user to add a PK.
- **Constraint errors → structured & user-presentable:** yes — mapped via SQLSTATE to `{kind, column?,
  constraint?, message}`: CHECK `23514` → *"Value violates rule …"*, NOT NULL `23502` → *"…is required"*,
  FK `23503` → *"Referenced record does not exist"*, bad input `22P02` → *"Invalid value: …"*. Ready to
  route to a `Dialog`/field.

### Probe 3 — RecordSet spine (MOST IMPORTANT)
- **Recommended `RecordSet` contract** (revised from the plan strawman — the edit buffer **is** a set of
  per-field signals, which is what makes reactivity idiomatic):
  ```ts
  interface RecordSet<Row> {
    // data window (grid binds here; a dense array — see paging)
    rows(): Signal<Row[]>            // current window; new identity on page/commit → grid repaints
    totalCount(): number
    // cursor
    current(): Row | undefined
    position(): Signal<number>       // the row cursor; a grid's `focused` binds to THIS
    moveTo(i) / next / prev / first / last
    isCurrent(row): boolean          // for buffer-aware grid cell accessors (live sync)
    // edit buffer (per current row) — the reactive core
    field(name): Signal<string>      // TWO-WAY; bind any control here. Cursor move re-syncs in a batch.
    cellText(row, name): string      // buffer for the current row, else committed (grid accessors)
    dirty(): boolean; dirtyFields(): string[]
    // lifecycle
    commit(): Promise<CommitResult>  // beforeSave hooks → xmin optimistic UPDATE (INSERT for new rows)
    rollback(): void
    onBeforeSave(fn): Unsub          // veto / mutate (Probe 6)
    on('current'|'commit'|'conflict', fn): Unsub
    // (deferred to build: insertRow/deleteRow, ensureRange for the windowed source, refresh)
  }
  ```
  Notes vs the strawman: `ensureRange` moved *into the windowed data source* behind `rows()` (see
  paging); the edit buffer is deliberately **string-typed** (pg returns numeric/decimal as JS strings
  anyway, and controls edit strings) with typed adapters (bool/date) layered on top; coercion to
  NULL/typed values happens at `commit()`.
- **Reactivity fit:** **idiomatic, zero re-wire.** Two `Input`s bound to `field('name')`/`field('balance')`
  in a *persistent* mounted tree repaint correctly as the cursor moves (`moveTo` overwrites the buffers in
  one `batch`). Edit→`commit()` (xmin) persisted and cleared dirty; `rollback()` restored the buffer.
  Evidence: `probe3a-recordset.txt`. **One subtlety (unknown-unknown):** jsvision `draw()` is *not*
  auto-tracked — reading a signal in `draw()` does not subscribe. So a *grid* that must live-reflect an
  uncommitted edit needs an **explicit** bind/effect linking it to the edit buffer (Probe 5 does this);
  plain controls already bind their value.
- **PAGING VERDICT (make-or-break): 🟡 windowed-source works against the UNMODIFIED grid, under two
  constraints.** The grid indexes `display()[topItem+i]` only across its visible window and reads
  `display().length` for the scroll range. A `Proxy` reporting `length = totalCount` and materialising
  only touched pages satisfies it: scrolling to **row 50 000** touched **20 indices** and materialised
  **3 of 500 pages (0.6%)**, showing the correct rows. **But** two things force a full scan (measured):
  an **`auto`-width column** → `measureAutoWidths` iterates every row (100 020 accesses); a **client-side
  sort** → `sortRows` does `[...rows]` (100 000 accesses). ⇒ Use **fixed/`fr` widths** and **server-side
  sort**. A clean productisation adds a small **windowed data-source seam** to `@jsvision/ui` (an
  `{ get(i), length }` interface + server-sort hook) to remove the constraints. Evidence:
  `probe3b-paging.txt`.

### Probe 4 — Editable grid (MAKE-OR-BREAK)
- **Cell cursor:** an **additive subclass** of the shipped `GridRows` — `EditableGridRows` adds a
  `focusedCol` signal, ←/→ + Tab/Shift-Tab cell navigation, and a cursor/dirty-dot overpaint; the
  inherited row-focus model, virtual scroll, and column geometry are reused wholesale and **do not fight**
  the added column cursor. (Row nav still moves the inherited `focused`/RecordSet position; ↑/↓ fall
  through to `super`.)
- **Editor-overlay verdict:** 🟢 **works cleanly.** An in-cell `Input` (`CellEditor`) mounts at the
  focused cell's computed **absolute rect** on the app overlay group; `loop.focusView(editor)` routes
  focus (`getFocused() === editor` ✓), synthetic keystrokes land in the editor, **Enter commits
  transactionally** (RecordSet `commit()` → xmin UPDATE, DB read confirms persistence), **Escape reverts**.
  This is exactly what the shipped `openAnchoredPopup` does, minus the frame/anchor-grow — so a
  cell-exact editor is a small variant of an existing primitive. Evidence: `probe4-editable-grid.txt`.
- **Commit/advance, dirty markers, new-row, delete-row, NULL-vs-empty:** commit-on-Enter + revert-on-Esc
  and a dirty-cell dot are shown. New-row (`*`), delete-row, and Tab-advance-to-next-cell are
  straightforward extensions of the same machinery (not all exercised — scoped to the build). NULL-vs-empty
  is handled at commit (empty string on a nullable column → NULL).
- **Size + internals needed:** the edit layer is ~2 small files (`editable-grid.ts` ≈ 190 lines +
  orchestration). It needs `GridRows` (`draw`, `onEvent`, `geometry`, `topItem`, `focused`, `columns`,
  `display`) and the pure `columns.ts` helpers (`apportionColumns`, `alignCell`). **Caveat / framework
  gap:** `@jsvision/ui`'s `exports` map only publishes `.`, so the spike reached these via a **relative
  path into `dist/`**. To ship without a fork, the framework must **export** `GridRows` + the columns
  helpers, *or* ship the editable/windowed grid inside `@jsvision/ui`.

### Probe 5 — Bound form (shared-spine proof)
- **Shared spine:** 🟢 **proven both directions.** One `RecordSet` feeds an `EditableGridRows` *and* a
  bound form (`Input` name, `Input` balance, `CheckGroup` is_active). Cursor move updates both; a **form**
  edit ("Alan Turing Jr") appears **live in the grid cell**; a **grid-path** edit (balance 4242.00)
  appears live in the form; a bool toggle reflects in both. Evidence: `probe5-bound-form.txt`.
- **Realisation detail (important):** live grid↔form sync of *uncommitted* edits requires (a) the grid's
  current-row cell accessor to read the **edit buffer** (`cellText`), and (b) an explicit effect linking
  the grid to the buffer signals (because `draw()` isn't auto-tracked). Both are small, documented
  patterns — but they are the difference between "share a RecordSet" and "stay live in sync."
- **Save gated by validation:** 🟢 the same `Input.valid()` sweep `Dialog.valid()` runs — an empty
  required `name` **blocks** save (`name.invalid=true`, first offender identified for refocus); restoring
  it passes the gate. Typed bool binds via a small `Signal<boolean[]>` adapter over the string buffer (the
  honest cost of binding typed controls).

### Probe 6 — Scripting
- **Trusted TS `BeforeSave`:** 🟢 works end-to-end. A handler **vetoes** a rule violation (balance >
  credit_limit — a rule the DB does not enforce) with a user-presentable message and **no DB write
  occurs**; it also **mutates** the pending record (whitespace-normalises the name) before it persists.
  `OnCurrent`/`AfterUpdate` lifecycle events fire. This is the "VBA problem" solved for free: the host
  language *is* the scripting language, handlers are plain functions over a curated `ctx.get/set/veto`.
- **Untrusted-sandbox options + recommendation:** `node:vm` = weak (same heap, escapable, no CPU/mem
  bound) — insufficient alone. `isolated-vm` = strong (separate V8 isolate, real limits) but a **native
  addon** — allowed *only* in the app package (not a published one). Restricted **DSL** = safest +
  dependency-free but real language work, best for calculated-field/validation expressions.
  **Recommendation: ship trusted TS handlers now; DEFER the untrusted sandbox;** if/when needed, reach
  for `isolated-vm` in the app package with a capability-limited API (`@jsvision/core` already ships
  `redactEvent`/`sanitize` for the boundary), or a DSL for the narrow expression case.

### Probe 7 — Scale & perf
- **100k rows with windowed paging:** 🟢 **usable.** Compose+diff/frame while scrolling 200 deep
  positions on a 60×22 grid: **median 0.74 ms · p95 1.36 ms · max 5.11 ms** — far under the 16 ms budget
  (windowed render is O(viewport), not O(rows)). Page fetch round-trip: median 17 ms / p95 31 ms (async —
  never blocks a frame). Single-row edit commit: median 3.3 ms. Evidence: `probe7-scale.txt`.
- **Within the 16 ms budget?** Yes, by ~10–20×.
- **Caveat:** no eviction → 191/500 pages accumulated over 200 random jumps. A production window needs an
  **LRU cap** so long scrolling doesn't retain every touched page.

---

## Assess-on-paper (pillars we did not prototype)

- **Reports (export):** Feasible. A banded model → **CSV/HTML export is nearly free** — the introspected
  column metadata + formatting already exist; the datasheet's row source feeds an exporter directly.
  A terminal can't "print," so export covers ~90%. PDF needs a pure-JS lib (e.g. `pdfkit`, pure JS but
  with font assets) *in the app package*; **start CSV/HTML-only**, add PDF later. Effort: **S** (CSV/HTML),
  M (PDF/banded designer).
- **Visual query builder (QBE):** Hard. The cheap 80% is a **SQL `Input` + a read-only result
  `DataGrid`** (reuse introspect + the windowed grid) — small. The visual join designer is a **late
  luxury** (a canvas — `Surface`/`SurfaceView` exist to host one). Effort: S (SQL box), L–XL (visual).
- **Relationships editor:** FKs come **free** from introspection (Probe 1 resolved them). The work is the
  visual canvas (again `Surface`-hostable). Effort: M–L (visual only).
- **Form designer vs. code-defined forms — recommended v1:** **Code-defined forms** (define the form in
  TypeScript). The spike's bound form is code-defined and worked cleanly; for a dev-facing tool this is
  the honest v1 and it dogfoods the framework. WYSIWYG designer is a later feature. Effort: M
  (code-defined), XL (WYSIWYG).
- **Packaging:** proposed split **`@jsvision/data`** (RecordSet + pg adapter — *may* depend on `pg`) + a
  **`data-studio`** app (menu/status/desktop shell). Respects the `check:deps` boundary — the guard only
  inspects published packages, and `pg` is pure-JS regardless (confirmed in Probe 0). `@jsvision/data`
  could stay private until it releases, exactly like `@jsvision/ui`.

---

## Framework additions `@jsvision/ui` would need

(Proven-missing by the spike — do NOT implement in the spike; list for the real build.)

1. **Export `GridRows` + the pure `columns.ts` helpers** (`apportionColumns`/`alignCell`/`sortRows`), or
   ship an editable/windowed `DataGrid` variant inside `@jsvision/ui`. The `exports` map currently
   publishes only `.`, so the spike relative-path-bypassed `dist/`. (Probe 4)
2. **A windowed data-source seam for the grid** — an `{ get(i), length }` (accessor + count) interface the
   body reads, plus a server-sort hook, so paging works without the *fixed-widths + server-sort*
   constraints and `auto`/client-sort don't force a full scan. (Probe 3b)
3. **A decimal/numeric `Input` validator** — the shipped `range` validator is integer-only (it strips a
   `.`). Also a small **`required`** validator would be reused everywhere. (Probes 4/5)
4. **(nice-to-have) A cell-exact editor-overlay helper** — generalise `openAnchoredPopup` for a no-frame,
   cell-aligned mount (the spike hand-mounted onto the overlay); and document/ship the grid current-row ⇄
   edit-buffer binding for live form↔grid sync (works today via an explicit effect). (Probes 4/5)

---

## Features to defer (with rationale)

1. **Untrusted-script sandbox** — only matters if end-users author scripts; trusted TS handlers cover the
   dev-facing v1 for free. Reach for `isolated-vm`/DSL later. (Probe 6)
2. **Reports *designer* + PDF** — CSV/HTML export is the cheap 90%; banded/PDF is later.
3. **Visual QBE + relationships canvas** — a SQL box + result grid is the 80%; the visual designers are
   luxuries.
4. **WYSIWYG form designer** — code-defined forms are the honest v1.
5. **Type long-tail rich editors** (jsonb structured editor, array editor, time-of-day) — raw-text /
   read-only fallbacks are acceptable for v1 (8/12 seed types are already trivial).
6. **No-PK table editing** — read-only in v1 (no safe row identity).

---

## Risk register (re-ranked with evidence)

| Risk | Likelihood | Impact | Mitigation / open question |
|------|-----------|--------|----------------------------|
| Editor-overlay integration | **Low** (was #1) | High | Proven 🟢 (Probe 4). Mount on the overlay at a cell rect; ship a cell-exact `openAnchoredPopup` variant. |
| Server-paging vs in-memory grid | **Low–Med** (was #2) | High | Works 🟡 unmodified with fixed widths + server sort (Probe 3b). Clean fix = a windowed data-source seam. |
| RecordSet ⇄ reactivity fit | **Low** | Med | Idiomatic (Probe 3a). One rule: `draw()` isn't auto-tracked → grid needs an explicit buffer bind for live sync. |
| Concurrency correctness | **Low** | Med | `xmin` conflict detection proven; composite-PK editable; no-PK → read-only (Probe 2). |
| Untrusted-script sandbox | **Low / optional** | Low | Trusted handlers free; defer sandbox (`isolated-vm` app-package, or DSL) (Probe 6). |
| Type-mapping long tail | **Low–Med** | Med | 8/12 trivial, 4 needs-work, 0 blocking; raw-text/read-only fallbacks acceptable v1 (Probe 1). |
| Window memory growth | **Low** | Med | No eviction retains touched pages; add an LRU window cap (Probe 7). |

---

## Unknown unknowns discovered

- **`draw()` is not reactively auto-tracked.** Reading a signal in `draw()` does *not* subscribe the view;
  live bindings must be explicit `bind`/effect. This shapes the RecordSet↔grid contract (the grid needs an
  explicit link to the edit buffer to live-reflect uncommitted edits). Not obvious from the outside.
- **node-postgres returns `name[]` catalog arrays unparsed** (raw `"{…}"` strings). Every introspection
  query that aggregates catalog identifiers must cast `::text`. A silent footgun.
- **pg returns `numeric`/`decimal` as JS strings**, not numbers. The string-typed edit buffer turns this
  from a nuisance into a convenience, but type coercion must live at the commit boundary.
- **The grid's `display(): T[]` contract is satisfiable by a `Proxy`** — a pleasant surprise (paging with
  no fork) — precisely because virtual scroll indexes only the visible window. The dense-array (length =
  totalCount) assumption is load-bearing; `auto` measure + client sort quietly break it.
- **The `@jsvision/ui` `exports` map blocks all deep imports** — reusing any internal (GridRows, column
  helpers, `openAnchoredPopup`) requires exporting it or shipping the feature inside the package.
- **No-PK tables have no safe row identity** (`ctid` is unstable) — a UX constraint (read-only) to surface
  early, not a late surprise.

---

## Rough effort to a v1 (if GO)

| Subsystem | Effort | Notes |
|-----------|--------|-------|
| `pg` adapter + introspection | **S** | Spike's `introspect.ts` + `crud.ts` are ~80% of it; add per-FK lookup + type coercion table. |
| RecordSet layer | **M** | Buffer/dirty/commit/events proven; add insert/delete-row, typed adapters, the windowed source + LRU cap. |
| Editable grid | **M** | Cell cursor + editor overlay proven; add new-row/delete-row/Tab-advance/NULL-vs-empty; **needs the framework exports (add #1/#2 above)**. |
| Bound forms + code-defined forms | **M** | Shared-spine + validation gate proven; add typed control adapters + a form-layout convention (mostly exists). |
| Event/scripting (trusted) | **S** | Proven near-free. |
| App shell wiring (menu/status/nav) | **S** | `createApplication`/Desktop/Menu/Status all exist. |
| **Total to a usable v1** | **L** (a few focused weeks) | Read-only browser → editable single-PK grid → bound form → trusted events. Reports/QBE/designer/sandbox **deferred**. |

**After the spike (not part of it):** if GO, formalise with `make_requirements` for the Data Studio
product, then `make_plan` — this memo is the primary input. Delete/archive `packages/spike-data-studio/`.
