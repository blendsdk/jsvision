# Data Studio — Feasibility Spike Plan

> **Codename:** "Data Studio" (a placeholder for a Borland-Paradox / MS-Access-style database
> front-end built on jsvision + PostgreSQL). Rename the `data-studio` folder freely — it does not
> commit us to anything. **This is a throwaway feasibility spike, not a build.**

---

## 0. How to use this document (read first, then execute cold)

This plan is written to be executed in a **fresh context** with no memory of the conversation that
produced it. Everything you need is either in this file or cited by `path:line`. Do not go looking
for prior chat history — it is summarised in §3.

**Your mission:** run the probes in §6, build the throwaway prototypes they call for, and fill in
`decision-memo.md` (copy it from `decision-memo-template.md`). The memo is the deliverable. The code
is evidence, not a product — it will be deleted or rewritten once we decide.

**The one question this spike must answer:**

> Can we build a genuinely usable Paradox/MS-Access-class database application — editable
> datasheets, bound forms, TypeScript event handlers, backed by PostgreSQL — on top of jsvision as
> it exists today, and what would it cost? Ship a **grounded go / no-go / go-with-caveats**
> recommendation with a rough effort estimate per subsystem.

**Ground rules while executing:**

- **Time-box, don't gold-plate.** Every probe lists the exact questions to answer and a **STOP
  condition**. The moment you can answer the questions, record the finding and move on. A spike's
  failure mode is polishing a prototype instead of learning. Resist it.
- **Learning > working code.** A prototype that reveals "this fights the framework" is a *success*.
  Record *why* it fights, not a workaround.
- **Do not touch the production packages.** No edits to `packages/core`, `packages/ui`, or
  `packages/examples`. All spike code lives in a throwaway workspace (§5). If a probe shows a change
  to `@jsvision/ui` is *needed*, write the change down in the memo as a required framework addition —
  do **not** make it.
- **Real Postgres, real data.** This is a spike about a database app; a paper analysis is not
  enough. Stand up Postgres (§5) and run against it.
- **Surface unknowns.** If you hit something this plan didn't anticipate, add it to the memo's
  "Unknown unknowns discovered" section. That is one of the most valuable outputs.

---

## 1. What we're cloning (scope of the assessment)

Access/Paradox are late-Turbo-Vision-era desktop databases. They have **six pillars**. The spike
must reach an opinion on all six, but only **prototype the first three** (the spine); the rest are
**assess-on-paper** unless a prototype is cheap.

| # | Pillar | Access/Paradox term | Spike treatment |
|---|--------|--------------------|-----------------|
| 1 | **Datasheet** — an editable, typed table grid | Table view / QBE grid | **Prototype** (Probe 4) |
| 2 | **Bound forms** — controls wired to a current record | Forms / ObjectPAL forms | **Prototype** (Probe 5) |
| 3 | **Data engine** — connect, introspect, CRUD, transactions | Jet / BDE | **Prototype** (Probes 1–3) |
| 4 | **Scripting** — event handlers in the host language | VBA / ObjectPAL | **Thin prototype + assess** (Probe 6) |
| 5 | **Queries** — visual query builder (QBE) | Query design view | **Assess only** (§7) |
| 6 | **Reports** — banded, printable/exportable output | Report designer | **Assess only** (§7) |

The strategic thesis to validate or break: **jsvision already ships ~60% of the shell** (typed grid,
forms controls, dialogs, validators, menu/status, reactivity), and the "VBA problem" is nearly free
because the host language *is* the scripting language. The **two hard, novel subsystems** are the
**RecordSet/binding layer** (the spine) and the **editable-grid layer** (the visible half). The
spike lives or dies on those two.

---

## 2. jsvision inventory — what you're building on (grounded)

Confirmed against the codebase; cite these when reasoning about fit.

**Already strong (reuse, don't rebuild):**

- **Typed grid** — `DataGrid<T>` (`packages/ui/src/table/`): typed columns, `auto`/`fr`/fixed width
  apportionment, sort-by-header (`▲`/`▼`), zebra, sticky header, horizontal + virtual vertical
  scroll. This is the hardest display widget and it's done.
- **Reactive core** — `packages/ui/src/reactive/` — `signal`/`computed`/`effect`/`batch`/`For`/`Show`
  (fine-grained, Solid-style, glitch-free). This is what makes bound controls cheap.
- **Form controls** — `packages/ui/src/controls/`: `Input` (single-line editor over a two-way
  `Signal<string>`) + a `filter`/`range`/`lookup` **validator** model (`controls/validators/`) —
  this is literally Access field validation; `CheckGroup`, `RadioGroup`, `Label`-linked controls.
- **Dropdowns / pickers** — `DatePicker`+`Calendar` (`src/date/`), `ColorPicker` (`src/color/`),
  `ListBox`/`ListView` (`src/list/`), all using a generalized anchored-popup facility
  (`src/dropdown/popup.ts`, `openAnchoredPopup`).
- **Modals + gating** — `Dialog` (`src/dialog/dialog.ts`) with a `valid()` child-sweep close-gate
  (refuses OK while a field is invalid, refocuses the first offender). This is the "can't save a bad
  record" primitive.
- **App shell** — `MenuBar`/`StatusLine`/`Desktop`/`Window` (`src/{app,desktop,window,menu,status}/`)
  + an absolute full-viewport **overlay** owned by `createApplication` (for popups/transient UI).
- **Scrolling viewport** — `Scroller` (`src/scroll/`) for a diff/detail/log pane.
- **Render/paint** — `RenderRoot` compose + damage-diff over core `ScreenBuffer`; every write goes
  through `sanitize`. Capability-aware color downsampling (truecolor→256→16→mono).

**The critical gaps — confirmed by reading the code:**

1. **The grid is display-only / one-way.** A column is `accessor: (row: T) => string`
   (`packages/ui/src/table/columns.ts:23`) — row in, string out. There is **no setter** and the grid
   never writes back.
2. **The grid cursor is a whole row, not a cell.** Focus is `focused: Signal<number>`, a display
   *index* (`packages/ui/src/table/grid-rows.ts:63`). There is no "current column" / current-cell
   concept.
3. **There is no edit mode.** `handleKey` maps arrows/PgUp/Home/End to navigation and Enter/Space to
   *activate* (emit a command / `onSelect`) — `packages/ui/src/table/grid-rows.ts:255-324`. No editor
   overlay, no commit/cancel, no dirty tracking, no insert/delete-row.
4. **The grid holds all rows in memory.** `display: () => T[]` (`grid-rows.ts:55`) is a computed over
   an in-memory array; virtual scroll windows the *render*, not the *data*. Server-side paging over a
   live DB table is a genuine open question (Probe 3/7).
5. **There is no data layer at all.** No connection, introspection, CRUD, RecordSet, or binding.
   PostgreSQL is entirely new (Probes 1–3).

**Zero-native-dep note:** the `check:deps` guard (`scripts/check-no-native-deps.mjs`) enforces no
native runtime deps **on the published packages only** (`@jsvision/core`, and `@jsvision/ui` when it
releases). A Data Studio **app** package may depend on `pg` (the node-postgres driver is **pure JS**,
no native build) without violating anything. Confirm `pg` installs clean in Probe 1.

---

## 3. Prior findings carried in from the originating conversation

So you don't re-derive them:

- The read of the grid code above (§2, gaps 1–4) was done live; the `path:line` refs are current.
- Consensus reached: the **RecordSet/binding layer is the deeper of the two hard subsystems** (it's
  shared by grids *and* forms, and it's where transactions/dirty/concurrency correctness live); the
  **editable grid is the more visible one**. Build the spike so a single RecordSet feeds both a grid
  and a form — that shared-spine property is the main architectural bet to validate (Probe 5).
- The "VBA-in-TS" layer is expected to be **cheap for trusted (dev-authored) handlers** (it's just
  functions with a curated API) and **the sandbox for untrusted end-user scripts is the only real
  cost** — assess that cost, don't build the sandbox (Probe 6).
- Recommended sequencing if we go: (1) read-only PG browser, (2) editable grid + RecordSet, (3) bound
  forms + events, (4) reports/relationships, (5) visual designer/QBE. The spike front-loads the risk
  in (2)+(3).

---

## 4. The tracer bullet (build this thread first, end to end)

Before the detailed probes, get **one thin vertical slice working through every layer** — it will
teach you more about fit than any single probe, and it de-risks integration (which is where TUI
frameworks usually bite):

> Connect to real Postgres → introspect `app.customer` → load its rows into a grid → move a **cell**
> cursor → press Enter on a cell → edit the value in an in-cell `Input` with a validator → commit the
> change inside a **transaction** → see it persist → then bind the **same** current record to a
> 3-field form and prove editing in one reflects in the other.

If that thread runs, the clone is almost certainly feasible and the probes just fill in cost/edges.
If it *can't* be made to run cleanly, that itself is close to a no-go and you'll know exactly which
layer broke. **Do the tracer bullet, then circle back and deepen each probe.**

---

## 5. Setup (Probe 0)

**Questions:** Is a real Postgres reachable? Does `pg` install & connect clean (pure-JS, no native
build)? Is the throwaway workspace inert w.r.t. turbo/vitest/verify?

**Steps:**

1. **Postgres.** Prefer an existing local instance. Otherwise stand one up (do not ask, just do the
   first that works):
   - `docker run --rm -d --name data-studio-spike -e POSTGRES_PASSWORD=spike -p 5433:5432 postgres:16`
     (port 5433 to avoid clobbering a local 5432).
   - Fallback: any reachable Postgres the environment already has.
   - If **no** Postgres can be created (no docker, no network), record that as a blocker in the memo
     and run Probes 1–3 against the SQL in `seed-schema.sql` as a *design* exercise, flagging every
     finding as **unverified**.
2. **Seed.** Apply `seed-schema.sql` (in this folder). It creates schema `app` with a deliberate
   edge-case matrix: serial PK, composite PK, **no-PK** table, FKs, an enum type, `numeric`, `bool`,
   `date`, `timestamptz`, `jsonb`, `uuid`, an `int[]` array, a generated column, a `CHECK`
   constraint, a `NOT NULL`, defaults, and a read-only **view**. This is your torture test for type
   mapping and CRUD.
3. **Spike workspace.** Create `packages/spike-data-studio/` (it matches the `packages/*` yarn
   workspace glob, so `@jsvision/ui` / `@jsvision/core` resolve **by name** — the way `examples`
   does; see the memory note that cross-package imports use built dist, so run `yarn build` once
   first). Make it inert: `package.json` with `"private": true` and **no** `build`/`test`/`typecheck`
   scripts (so `turbo run …` and `yarn verify` skip it), a `pg` dependency, and `tsx` run scripts.
   Import `@jsvision/ui` / `@jsvision/core` **by name**. A `src/` of throwaway probe scripts, each
   runnable via `tsx`.
4. Put connection config in an env var (`DATABASE_URL`), never hardcode credentials.

**STOP when:** `pg` connects and `SELECT 1` returns, the seed applied, and one `tsx` script in the
workspace can `import { DataGrid } from '@jsvision/ui'` without a resolution error. Record the
`pg`/Node versions and whether any native build occurred (expect none).

---

## 6. Probes (the core of the spike)

Each probe: **Questions** it must answer · **Build** (throwaway) · **STOP condition**. Fill the
matching memo section as you finish each. Run them roughly in order (each builds on the last), but
the tracer bullet (§4) may have you touch several at shallow depth first.

### Probe 1 — Schema introspection & type mapping

**Questions:**
- Can we fully describe a table from the catalog: columns, PG types, nullability, defaults, primary
  key, foreign keys, enum values, check constraints, generated/identity columns, and is-updatable
  (view vs table)?
- Which PG types map **trivially** to an editor (text/int/numeric/bool/date/timestamp/enum) and which
  are **hard** (jsonb, uuid, arrays, ranges, custom composite types)? What's the fallback for hard
  types (read-only text? raw JSON edit?)?

**Build:** an `introspect(table)` → `TableMeta` function using `information_schema` +
`pg_catalog`/`pg_type`. Produce a `TableMeta` for **every** object in `app` (incl. the view and the
no-PK table). Map each column to a proposed editor kind.

**STOP when:** you have a `TableMeta` dump for all seed objects and a **type→editor table** with a
verdict (trivial / needs-work / read-only-fallback) for each PG type present. Note anything the
catalog can't tell you.

### Probe 2 — CRUD, transactions, concurrency, error surfacing

**Questions:**
- Parameterized `SELECT` (paged), `INSERT … RETURNING`, `UPDATE … WHERE pk`, `DELETE`. All
  parameterized (no string interpolation — security is non-negotiable from line one).
- Transaction begin/commit/rollback around a multi-row edit.
- **Optimistic concurrency:** detect a conflicting concurrent update. Strategy? (`xmin` system column
  vs. a `WHERE` clause matching all original values vs. an `updated_at` version). Which is robust and
  cheap?
- **Edge PKs:** how do UPDATE/DELETE work for the **composite-PK** table and the **no-PK** table
  (`app.tag`)? Is a no-PK table editable at all, and if not what's the UX (read-only)?
- Do constraint violations (the `CHECK qty>0`, the `NOT NULL`, a FK violation) come back as
  **structured, user-presentable** errors we can show in a `Dialog`/validator, or opaque strings?

**Build:** a `crud.ts` exercising all of the above against `app.customer`, `app.order_item`
(composite PK), and `app.tag` (no PK). Simulate a concurrent update (two connections) and prove the
conflict is detected.

**STOP when:** you can round-trip an edit in a transaction, you've demonstrated conflict detection,
you've classified the no-PK / composite-PK behavior, and you have a sample of a mapped constraint
error. Record the chosen concurrency strategy + its cost.

### Probe 3 — The RecordSet contract (the spine)

**This is the most important probe.** Everything hangs off it.

**Questions:**
- What is the **minimal `RecordSet` contract**? Propose it precisely (see the strawman below).
- Does it compose with the **reactive core**? Specifically: when the cursor moves to a new record, do
  the bound field signals update such that a bound control repaints — without a manual re-wire? Prove
  it. (This tests whether "current record" as reactive state is idiomatic in this signal model or
  whether it fights `For`/keyed reconciliation.)
- **Paging fit (the big one):** the grid holds `T[]` in memory (`grid-rows.ts:55`). For a 100k-row
  table we need a **windowed/server-paged** data source. Can a RecordSet present a *windowed* view to
  the grid (fetch a page on scroll, keep a sliding window) while the grid still thinks it's iterating
  an array — or does the grid's virtual-scroll model assume the whole array and force us to either
  (a) load everything, (b) fork the grid, or (c) add a windowed-data seam to `@jsvision/ui`? Decide
  which, with evidence.

**Strawman contract to validate or revise:**
```
interface RecordSet<Row> {
  // data window
  rows(): Row[]                         // the current in-memory window (grid binds here)
  totalCount(): number | undefined      // may be unknown until counted
  ensureRange(start, end): Promise<void> // page in a window (server paging)
  // cursor
  current(): Row | undefined
  position(): number
  moveTo(i): void; next(): void; prev(): void; first(): void; last(): void
  // edit buffer (per current row)
  get(field): unknown; set(field, value): void
  isDirty(): boolean; dirtyFields(): string[]
  // lifecycle
  commit(): Promise<void>               // flush edit buffer in a txn (INSERT/UPDATE)
  rollback(): void
  insertRow(seed?): void; deleteRow(): Promise<void>
  refresh(): Promise<void>
  // events (Probe 6 hooks in here)
  on(event, handler): Unsubscribe
}
```
**Build:** implement a minimal `RecordSet` over `app.customer` with an **in-memory window** first,
then attempt the **windowed/server-paged** variant. Bind `current()` fields to signals and prove a
cursor move repaints a bound `Input`.

**STOP when:** you can (a) move the cursor and see bound state update reactively, (b) edit→commit a
record through the buffer in a transaction, and (c) give a **definitive verdict on the paging
question** (which of a/b/c above, and how much work). Revise the contract strawman into a
"recommended contract" in the memo.

### Probe 4 — The editable datasheet (grid edit layer)

**Questions:**
- How invasive is adding a **cell cursor** (`focusedCol` alongside `focused`) and Tab/Shift-Tab/arrow
  **cell** navigation to `GridRows`? Can it be an **additive subclass/layer**, or does the row-focus
  model (`grid-rows.ts:63`, `255-324`) actively fight it?
- **In-cell editor overlay** — the pivotal rendering question: can we mount a transient `Input`
  (or `DatePicker`/dropdown for typed cells) at a computed **cell rect**, on top of the grid, within
  jsvision's current view/compose/overlay model — e.g. via the app-shell overlay
  (`createApplication`'s absolute overlay) or a child added to the grid's own group at an absolute
  rect? Does focus/dispatch route to it correctly? Does it clip/paint right over the grid cells?
- Commit/cancel/advance semantics (Enter/Tab commit + move to next cell/row, Esc revert), dirty-cell
  and dirty-row markers, the Access `*` **new-row** affordance, delete-row, and **NULL vs empty**
  distinction.

**Build:** a throwaway `EditableGrid` (extend/wrap `GridRows`, or a sibling that reuses
`columns.ts`'s `apportionColumns`/`alignCell`/`sortRows` — do **not** modify `packages/ui`). Wire it
to the Probe 3 RecordSet over `app.customer`. Get in-cell editing of a text field and a numeric field
(with a `range` validator) committing to the DB.

**STOP when:** you can edit a cell in the grid and see it persist, and you can state clearly: is the
edit layer an **additive layer** on the existing grid, or does it require **forking/changing**
`@jsvision/ui`'s grid? Quantify (roughly) the code + which internals it needs. Record the
editor-overlay integration verdict — this is a top-3 risk.

### Probe 5 — The bound form (shared-spine proof)

**Questions:**
- Bind ~4 controls (`Input` text, `Input` numeric+`range`, `CheckGroup`/bool, `DatePicker`) to the
  **same RecordSet** current record used by the grid in Probe 4.
- Navigation (next/prev record) + a dirty indicator + Save/Cancel through a `Dialog` `valid()` gate.
- **The bet:** edit a field in the grid → the form reflects it (and vice-versa), because both read
  the one RecordSet. Prove or break this.

**Build:** a throwaway split view — Probe 4's grid on top, a bound form below, one RecordSet feeding
both.

**STOP when:** grid and form demonstrably share one record source and stay in sync, and Save is
gated by validation. If they *can't* cleanly share, record why — that reshapes the architecture.

### Probe 6 — Scripting / event model ("VBA-in-TS")

**Questions:**
- Event model: can the RecordSet/form fire `BeforeInsert`/`AfterUpdate`/`OnCurrent`/`BeforeSave`/
  button `OnClick`, and can a user-supplied TS handler **veto** (e.g. `ctx.veto('msg')`) or **mutate**
  the record before save? (Trusted, in-process — expected trivial.)
- **Sandbox cost (assess, don't build):** if end-users author handlers, what isolates them?
  `node:vm` (weak isolation, same heap) vs. `isolated-vm` (strong, **native dep** — conflicts with
  our no-native ethos, but only in an app package) vs. a restricted DSL. What capability-limited API
  do handlers get (parameterized queries only, no fs/net, redaction boundary — note `@jsvision/core`
  already has `redactEvent`/`sanitize` DNA)? Give a cost + a recommendation.

**Build (thin):** wire `BeforeSave` into the Probe 3 `commit()` so a trusted handler can veto a save
(reuse the `Dialog.valid()` idea for the message). Do **not** build a sandbox — write up its cost.

**STOP when:** a trusted TS `BeforeSave` handler can block a bad save end-to-end, and you've written
a paragraph each on the trusted model (cheap ✓) and the untrusted-sandbox options with a
recommendation.

### Probe 7 — Scale & performance smoke

**Questions:**
- With server paging (Probe 3), does scrolling a **100k-row** table stay responsive? Edit latency?
- Does the editable grid stay within jsvision's frame budget (there's a 16 ms compose+diff ceiling
  bench, `packages/core/bench/` / `yarn bench`)? Rough numbers, not a benchmark suite.

**Build:** load the big seed table (`seed-schema.sql` includes a generator for `app.big`), scroll and
edit, eyeball latency; capture a couple of timings.

**STOP when:** you can say "usable / marginal / not usable" for a large table with paging, with a
timing or two behind it.

---

## 7. Assess-on-paper (no prototype unless trivial)

Write a short, honest paragraph on each in the memo — feasibility + rough effort + what jsvision
gives you for free:

- **Reports** — banded report model → **export** to text/CSV/PDF (a terminal can't "print"; export
  covers ~90%). What library/approach for PDF? Or start CSV/HTML-only?
- **Visual query builder (QBE)** — the join designer. Hard. Note that a SQL `Input` + result grid is
  the cheap 80% and the visual designer is a late luxury.
- **Relationships editor** — FKs come free from introspection (Probe 1); a visual canvas is the work.
- **Form designer (WYSIWYG)** — vs. **code-defined forms** (define the form in TS). Recommend which
  to ship first and why (code-defined is likely the honest v1 for a dev-facing tool).
- **Packaging** — proposed package split: e.g. `@jsvision/data` (RecordSet + pg adapter, may depend
  on `pg`) + a `data-studio` app. Confirm this respects the `check:deps` boundary (guard hits
  published packages only).

---

## 8. Risk register — watch for these (rank in the memo)

Known candidate top risks; confirm/re-rank with evidence from the probes:

1. **Editor-overlay integration** (Probe 4) — mounting a transient typed editor at a cell rect within
   the view/compose/overlay model. If this fights the framework, the datasheet is expensive.
2. **Server-paging vs. the in-memory grid** (Probe 3/7) — if the grid can't take a windowed source
   without a framework change, large tables force a fork or a `@jsvision/ui` addition.
3. **RecordSet ⇄ reactivity fit** (Probe 3/5) — "current record swaps, all bound fields change" must
   be idiomatic, not a fight with keyed `For`.
4. **Concurrency correctness** (Probe 2) — no-PK / composite-PK editing and conflict detection.
5. **Untrusted-script sandbox** (Probe 6) — only matters if end-users write scripts; may push us to a
   native dep or a DSL. Scope it as optional.
6. **Type-mapping long tail** (Probe 1) — jsonb/array/uuid/custom types; how much read-only fallback
   is acceptable for v1.

---

## 9. Deliverable & exit criteria

**Deliverable:** `decision-memo.md` (copy `decision-memo-template.md`, fill every section), plus the
throwaway `packages/spike-data-studio/` code as evidence (referenced from the memo).

**The spike is DONE when the memo contains:**
- A per-probe finding with a **green / yellow / red** verdict and a pointer to the evidence
  (script/output).
- A **definitive answer to the paging question** and the **editor-overlay question** (the two
  make-or-break integration risks).
- A **recommended `RecordSet` contract** (revised from the §6 strawman).
- A **rough effort estimate per subsystem** (T-shirt S/M/L/XL is fine) and a list of **framework
  additions `@jsvision/ui` would need** (things the spike proved are missing).
- An explicit **features-to-defer** list (reports designer, visual QBE, sandbox) with rationale.
- A one-line **GO / NO-GO / GO-WITH-CAVEATS** recommendation with its single strongest reason, and
  the recommended first slice if GO.
- An **"unknown unknowns discovered"** section.

**After the spike (not part of it):** if GO, formalize with the CodeOps flow —
`make_requirements` for the Data Studio product, then `make_plan`. This spike's memo becomes the
primary input. Delete or archive `packages/spike-data-studio/`.

---

## 10. Guardrails recap (pin these)

- Throwaway code only; **do not modify** `packages/core|ui|examples`. Needed framework changes get
  *written down*, not made.
- Parameterized SQL only. Never log credentials/PII. Env-var connection config.
- Every probe has a STOP condition — honor it. Learning is the product.
- Keep the memo honest: a red verdict that saves us a doomed build is the best possible outcome.
