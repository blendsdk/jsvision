# Requirements: Footer, Aggregation & Master-Detail

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-09](../../requirements/RD-09-footer-aggregation-master-detail.md) — the OWNING requirements doc

## Scope of this plan (delta view)

### In this plan (RD-09 Must-Have, full)

- **Footer band** — an optional reserved bottom band composed like the header/scrollbar bands; holds
  a column-aligned aggregate row and/or a free-form widget row. (RD Must · AR-1/AR-7)
- **Column aggregates** — a per-column `{ fn: 'sum'|'avg'|'min'|'max'|'count', format?, label? }`
  rendered aligned under its column; a reactive `computed` fold over the **displayed/loaded** rows.
  (RD Must · AR-5/AR-6/AR-9)
- **Free-form widget slots** — the footer accepts any `View`s (totals `Text`, `Button`s emitting
  commands); buttons dispatch through the event loop. (RD Must · AR-3)
- **Sticky footer** — the footer stays visible while the body scrolls; aggregate cells stay aligned
  across the frozen/scrolling panel split. (RD Must · AR-7)
- **Aggregate honesty** — a loaded-set total on a not-fully-loaded source is labelled "(loaded)",
  never presented as a grand total. (RD Must · AR-2)
- **Master-detail** — an **editable** reactive link from a child grid to the master's focused record;
  the `masterDetail` helper + `focusedRow()`/`focusedKey()` + `fromReactiveRows`. (RD Must · AR-4/AR-8)
- **N-of-M + selection-count widgets** — the RD-06 filtered "N of M" count and the RD-08 selection
  count rendered as reactive footer widgets. (RD Must AC#6)
- **Showcase** — a kitchen-sink story + a datagrid-showcase cluster. (Kitchen-sink gate · AR-14)

### Deferred / out of this plan (RD Should-Have → Phase B; RD Won't-Have)

- **Server aggregate hook** `source.aggregate(columnId, fn): Promise<value>` — Phase B (RD Should).
  v1 ships the `complete?()` honesty predicate (AR-2), not the server total.
- **Record navigator** `|◄ ◄ n of N ► ►|` + go-to, and the **pager** control — Phase B (RD Should;
  the pager is RD-11's seam).
- **Top toolbar band** — Phase B (RD Should).
- **Drill-in** (double-click a master row → full-screen child + breadcrumb) — Phase B (RD Should).
- **Inline nested / tree-grid rows and pivot** — out of scope (RD Won't · RD AR #5/#11).

## Plan-local decisions

Only decisions NOT already fixed by RD-09 (which owns its Scope Decisions table). Full detail +
grounding in [00-ambiguity-register.md](00-ambiguity-register.md).

| Decision | Chosen | AR |
| -------- | ------ | -- |
| Honesty detection mechanism | optional `source.complete?()` predicate (absent ⇒ complete); test-double windowed source proves AC#4 | AR-2 |
| Widget layout + `Button` dispatch | flow-row of caller `View[]`; `Button({command})`→`ev.emit` | AR-3 |
| Master-detail data contract | **editable** reactive write-through `fromReactiveRows` (not read-only computed, not synced-signal) | AR-4 |
| Aggregate descriptor shape | `{ fn, format?: (v)=>string, label?: string }` — `format` renders the number, `label` is a static prefix | AR-5 |
| Fold edge semantics | skip non-finite; `avg` over numeric contributors; empty `sum`/`count`→0, `avg`/`min`/`max`→blank | AR-6 |
| New grid accessors | `displayedRows()`, `focusedRow()`, `focusedKey()` (`selectedKeys()` already exists) | AR-8 |
| Module decomposition | new `aggregate.ts`/`footer-band.ts`/`master-detail.ts` + `FooterController` (in `grid-footer.ts`); `grid.ts` stays `<1200` | AR-10 |

## Acceptance Criteria (plan-local)

The RD owns its own eight acceptance criteria (RD-09 §Acceptance Criteria, AC#1–#8). These are the
plan-local completion criteria that bind them to this codebase; each maps to ST-cases in
[07-testing-strategy.md](07-testing-strategy.md).

1. [ ] A `{ fn: 'sum' }` aggregate on a numeric column renders a total aligned under that column equal
       to the sum of the **displayed** rows' `value`; editing a cell, inserting, deleting, sorting, or
       filtering updates it reactively. (RD AC#1 · ST-1..ST-6)
2. [ ] `avg`/`min`/`max`/`count` fold per AR-6 (skip non-finite; empty→blank/0). (ST-7..ST-12)
3. [ ] A footer `Button` widget emits its `command` through the event loop when activated. (RD AC#2 · ST-13)
4. [ ] The footer is sticky while the body scrolls; aggregate cells stay aligned to their columns across
       a frozen/scrolling split. (RD AC#3 · ST-14..ST-16)
5. [ ] With `source.complete?()` returning `false`, an aggregate is labelled "(loaded)"; with it absent
       or `true`, it renders a clean total. (RD AC#4 (v1 half) · ST-17..ST-18)
6. [ ] `focusedRow()`/`focusedKey()` track the master cursor reactively; `masterDetail` updates the
       detail rows on master-focus change and disposes the detail scope with the master. (RD AC#5 · ST-19..ST-22)
7. [ ] `fromReactiveRows` insert/delete + cell edits on the detail persist into the caller's owned
       collection; omitting the writers yields a read-only-structural detail. (AR-4 · ST-23..ST-25)
8. [ ] The filtered "N of M" and selection counts render as footer widgets and update reactively. (RD AC#6 · ST-26)
9. [ ] A datagrid kitchen-sink story shows a totals footer + editable master-detail and passes the
       smoke test; the datagrid-showcase cluster replaces the RD-09 placeholder. (RD AC#7 · AR-14)
10. [ ] Security: aggregate `fn` validated against the enum, `columnId` keys validated against the
       columns (unknown ⇒ ignored + devWarn); footer text sanitized via the `ctx.text` boundary. (RD AC#8 · AR-12 · ST-27..ST-28)
11. [ ] `grid.ts` remains a **thin delegator** — all footer logic lands in new modules; Phase 2 first
       reclaims headroom by extracting the self-contained `EditorOverlay`/`PopupCatcher` (→ `overlay.ts`)
       and `devWarn` (→ `dev.ts`). The `< 1200` line-count guard holds after that; if the irreducible
       public-API surface still crosses it, the guard is **re-based with rationale** in the impl test (a
       runaway ceiling, not a spec oracle — AR-10), **never** met by re-inlining logic. Full `yarn verify`
       green; no regression in RD-01…08 suites.
