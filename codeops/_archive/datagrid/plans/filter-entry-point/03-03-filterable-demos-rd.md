# 03-03 — Filterable Flag, Demos & RD-06 Revision

> **Document**: 03-03-filterable-demos-rd.md
> **Parent**: [Index](00-index.md)
> **Implements**: FR-4, FR-6, FR-7 · **Refs**: AR-2, AR-3, AR-4, AR-8

## `GridColumn.filterable` (`column.ts`)

- Add `readonly filterable?: boolean;` to `GridColumn` (near `filterType`, `column.ts:98`), default
  **`true`** (a column is filterable unless it opts out). Public API → full JSDoc with an `@example`
  showing a `filterable: false` actions/icon column (project doc standard).
- It is the single gate consulted by three consumers:
  1. **The funnel** — `SortHeader` receives a `filterable[]` array ([03-01](03-01-funnel.md)); a
     `false` column shows no funnel and its funnel cell is not hit-testable.
  2. **The quick-filter row** — `QuickFilterRow` omits the `Input` for a non-filterable column (it
     currently builds one per column with no skip, `02 §filterability`). Keep the column geometry
     intact — the slot is blank, the divider/alignment unchanged — so a `filterable: false` column
     simply has no input under it. **Impl hazard (preflight PF-005):** `QuickFilterRow` needs a new
     `filterable?: boolean[]` config field (derived from its own `columnIds`, i.e. the `fullVisible`
     slice), and the internal `inputs` array **must stay index-parallel to `columns`** — `reposition()`
     (`quick-filter-row.ts:124`) and the filter wiring (`this.columnIds[c]`, `:103`) both index by
     column position, so a skipped input must be a **nullable slot** (`Input | null`), never a shorter
     filtered array, or every column past the first non-filterable one misaligns.
  3. **The `Alt+Down` opener** — the container no-ops when `col.filterable === false`
     ([03-02](03-02-keyboard-opener.md)).
- Derivation happens once where columns are resolved (the container builds `filterable[]` parallel to
  `columnIds`), so every consumer reads a consistent snapshot.

## The three showcase stories (`packages/examples/datagrid-showcase/stories/filtering/`)

Per AR-4 the stories keep their quick-filter row **and** gain the new entry point. Concretely
(`filter-demo.ts` builder + the three story files):

- `condition-text.story.ts` ("Text conditions"), `condition-num-date.story.ts` ("Number & date
  conditions"), `value-list.story.ts` ("Value list"): add `quickFilter: true` (so both surfaces are
  live) and **reword each hint** to the true interaction, e.g. *"Every column shows a ▽ — click it (or
  focus a cell and press Alt+Down) to open conditions; or type in the quick-filter row."*
- The `filtering` **kitchen-sink** story (`packages/datagrid/test/kitchen-sink/stories/
  filtering.story.ts`) hint is likewise reworded to mention the always-visible ▽ + `Alt+Down`.
- No new stories are required (no new component) — but every touched story must still pass its smoke
  test (kitchen-sink gate), and the three showcase demos must pass the showcase smoke/walkthrough.

## RD-06 revision (`requirements/RD-06-filtering.md`) — FR-7

Apply the exact edits tabulated in [00-ambiguity-register §C](00-ambiguity-register.md): revise **all
five** spots that encode the old "funnel only on filtered columns" rule — §Feature Overview (line ~15),
§Condition filters (~27), §Funnel indicator (~34), Technical §Funnel + count (~83), and acceptance #4
(~139) — and add the non-filterable AC. (Preflight PF-003 added the Feature-Overview and Technical
§Funnel + count rows: without them the revised RD-06 would contradict itself.) **The five §/AC funnel
edits move into Phase 2 (preflight PF-006)** so the requirement changes *with* the ST-19 re-spec that
depends on it; the demo/hint rewording stays in Phase 4.

- The RD lives under `codeops/` (a process doc, not shipped source) so it is exempt from the shipped-
  code doc ban — RD/AR references are fine there, banned only in `packages/*/src`.
- After the edit, `ST-19` is re-spec'd to match ([07 §funnel states](07-testing-strategy.md)); the
  two must agree.

## `check:docs` / doc-standard note

The JSDoc guard (`check-jsdoc.mjs`) runs in `yarn verify` and is known to under-scan some files
(see the project's memory on the scanner gap). Verify the banned-reference cleanliness of every
touched `src` file with a plain `grep` for `RD-`/`AR-`/`plans/` in addition to `check:docs`, so no
plan ID leaks into shipped code.
