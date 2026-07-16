# Requirements — Filter Entry Point

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-06](../../requirements/RD-06-filtering.md)
> **Tracks**: GitHub issue #92

This plan is a scoped delta over **RD-06 (filtering)**. RD-06's filter model, condition popup,
value-list, quick-filter row, "N of M" readout, and push-down are all shipped and unchanged. The one
gap this plan closes: the condition popup / value-list have **no user-facing way to open** on a
column that is not already filtered. RD-06 both requires that gap (§Funnel + AC#4) and needs it closed
(§Condition filters says the funnel *opens* the popup) — an internal contradiction this plan resolves
by revising RD-06 (AR-2; the exact edits are in [00-ambiguity-register §C](00-ambiguity-register.md)).

## Functional requirements (this plan)

- **FR-1 — Always-visible funnel.** Every **filterable** column's header shows a `▽` funnel at all
  times: the muted `listDivider` tone when the column has no active filter, the normal `tableHeader`
  tone when it does. Clearing a filter mutes the funnel (does not remove it). *(AR-1, AR-3, AR-6)*
- **FR-2 — Funnel opens the popup regardless of state.** A click on any filterable column's funnel
  cell opens its condition popup, whether or not the column is currently filtered. On an unfiltered
  column the popup shows the type's default operator with empty operands. *(AR-1, AR-10)*
- **FR-3 — Keyboard opener.** From the non-editing grid body, `Alt+Down` opens the condition popup
  for the currently focused column (when it is filterable), forwarding the live dispatch envelope so
  the popup's operator selector and nested date editors focus correctly. *(AR-1, AR-5, AR-9)*
- **FR-4 — Filterability flag.** `GridColumn` gains an optional `filterable?: boolean` (default
  `true`). When `false`, the column shows no funnel, its quick-filter input is omitted, and `Alt+Down`
  is a no-op on it. *(AR-3, AR-8)*
- **FR-5 — Narrow-column precedence.** A filterable column reserves one cell for the funnel (its title
  clips one cell earlier). When too narrow to hold both, the funnel is dropped **before** the sort
  arrow; the `Alt+Down` opener still works when the glyph is dropped. *(AR-7)*
- **FR-6 — Showcase honesty.** The three broken stories (Text conditions, Number & date conditions,
  Value list) become reachable: they keep the quick-filter row and gain the new entry point, with
  hints reworded to match the final interaction; the `filtering` kitchen-sink story hint likewise.
  *(AR-4)*
- **FR-7 — RD-06 revision.** RD-06 §Funnel indicator, §Condition filters, and acceptance criterion #4
  are revised (plus a new AC for non-filterable columns), and `ST-19` is re-spec'd to match. *(AR-2;
  edits in [00-ambiguity-register §C](00-ambiguity-register.md))*

## In scope

- `SortHeader` funnel draw states + reserve + `funnelColumnAt` hit-test (filterability-gated).
- `Alt+Down` handling on `EditableGridRows` + the `onOpenFilter` container wiring in `grid.ts`.
- `GridColumn.filterable` and its effect on the funnel, the quick-filter row, and the opener.
- The three showcase stories + the filtering kitchen-sink story hint.
- The RD-06 text/AC revision and the `ST-19` re-spec.

## Out of scope

- The condition popup UI, the value-list, the filter model / predicates, and push-down (RD-06 —
  shipped, untouched).
- Making the `SortHeader` itself keyboard-focusable / a header cursor — the opener acts on the body's
  focused column (Excel model). *(Not needed for AR-1; a header cursor would be a separate RD.)*
- The quick-filter input width bug (#93 — fixed separately).
- Any new filter operators, saved filter sets (RD-13), or global quick-search (RD-06 Phase B).

## Success criteria (definition of done)

- On a plain `EditableDataGrid` with no quick-filter row, a user can open the condition popup / value-
  list on any filterable column via **both** the funnel click **and** `Alt+Down` — verified by spec
  tests and by driving the real showcase (per the `verify` skill).
- A `filterable: false` column shows no funnel and ignores `Alt+Down`.
- The three showcase stories and the filtering kitchen-sink story are reachable and their hints match
  behavior; all smoke tests pass.
- RD-06 and `ST-19` reflect the new behavior; `yarn verify` is green.
