# Testing Strategy — Filter Entry Point

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)
> **Verify**: `yarn verify`

Specification-first: these ST-* cases are written and run **red** before implementation, then green.
Each expectation derives from a requirement (FR-*) / register decision (AR-*), never from imagined
implementation behavior. Files: additions to `sort-header.spec.test.ts` (funnel states + hit-test),
new `filter-entry-point.spec.test.ts` (keyboard opener + filterability at the container level), and
impl tests alongside.

## Funnel states (SortHeader) — replaces ST-19

| ST | Given | Expect | Trace |
| -- | ----- | ------ | ----- |
| ST-1 | A filterable, **unfiltered** column | its header renders `▽` in the **`listDivider`** (muted) colour | FR-1, AR-6 |
| ST-2 | A filterable column with an **active** filter | its header renders `▽` in the **`tableHeader`** (normal) colour | FR-1, AR-6 |
| ST-3 | Clearing a column's filter | the `▽` **remains** (muted); it is not removed | FR-1, AR-6 |
| ST-4 | A `filterable: false` column | **no** `▽` is rendered; its funnel cell is not hit-testable | FR-4, AR-8 |

> ST-1…ST-4 supersede the old `ST-19 (filter)` ("nothing filtered → no funnel"), which is deleted as
> part of the RD-06 revision (AR-2). The re-spec is the documented spec-immutability exception.
>
> **Numbering (preflight PF-008):** this plan's `ST-1…ST-13` are a **separate scheme** from the RD-05
> sorting cases already in `sort-header.spec.test.ts` (`ST-13…ST-20`). Prefix this plan's cases in the
> test titles (e.g. `ST-EP-1`) or fence them under a clear header comment so the two schemes don't blur.
> `ST-20 (filter)` (funnel-cell click routing on a *filtered* column) is **retained** — it coexists with
> the new ST-5/ST-6 (which cover the *unfiltered* funnel click); only `ST-19 (filter)` is replaced.

## Funnel hit-test (SortHeader)

| ST | Given | Expect | Trace |
| -- | ----- | ------ | ----- |
| ST-5 | A click on an **unfiltered** filterable column's funnel cell | `onFunnelClick` fires with that `columnId`; `onSort` does **not** fire | FR-2 |
| ST-6 | A click on a filterable column's funnel cell (filtered or not) at content-space `x = funnel cell` | routes to the funnel, not the title/sort zone | FR-2 |
| ST-7 | A too-narrow filterable column (no room for funnel + arrow) that is **sorted** | the **sort arrow** is painted; the funnel is dropped (drop-first precedence) | FR-5, AR-7 |

## Keyboard opener (container / body)

| ST | Given | Expect | Trace |
| -- | ----- | ------ | ----- |
| ST-8 | `Alt+Down` on the **non-editing** body with a filterable column focused | the condition popup opens for the focused column (`onOpenFilter`/`openFilterPopup` fires with that `columnId`); `ev.handled === true` | FR-3, AR-5 |
| ST-9 | `Alt+Down` while a **cell editor is open** | the popup does **not** open; the editor consumes the key | FR-3, AR-9 |
| ST-10 | `Alt+Down` with a `filterable: false` column focused | **no** popup opens (no-op) | FR-4, AR-8 |
| ST-11 | The popup opened on an **unfiltered** column | it presents the type's default operator with **empty** operands (no current filter) | FR-2, AR-10 |
| ST-12 | (frozen grid) `Alt+Down` with a column focused in a **right** panel | the popup opens anchored under that panel's header | FR-3, AR-11 |

## Filterability propagation

| ST | Given | Expect | Trace |
| -- | ----- | ------ | ----- |
| ST-13 | A `filterable: false` column | the quick-filter row renders **no** `Input` under it, and column geometry/alignment is unchanged | FR-4 |

## Impl tests (edges)

- Muted↔emphasized flip repaints when `setFilter`/`clearFilter` toggles a column (reactive binding).
- Every filterable column's title clips one cell earlier than before (reserve applied); a
  non-filterable column's title width is unchanged.
- `Alt+Down` with no focused column on an empty grid is a no-op (no throw).
- Anchor parity: the keyboard-opened popup lands at the same header cell a funnel click would
  (`funnelAnchor(columnId)` reused by both paths).
- **Plain `Down` still row-navigates (preflight PF-001).** A `Down` with no `alt` on the non-editing
  body moves the row cursor via the base (`focusedCol` unchanged, no popup) — the guard that the new
  Alt+Down handler didn't swallow ordinary row navigation.
- **Alt+Down survives a body rebuild (preflight PF-002).** After a layout change that rebuilds the
  panels (hide/show or reorder a column), `Alt+Down` still opens the popup anchored under the correct
  (freshly-built) header — proves `grid.ts` refreshed its retained `parts.headers` in `rebuildBody`.

## Showcase / smoke

- The three `datagrid-showcase` filtering stories render and their entry point is reachable; hints
  match behavior (showcase smoke + walkthrough).
- The `filtering` kitchen-sink story passes `kitchen-sink.smoke.spec.test.ts`.

## Behavioral verification (the `verify` skill)

Beyond tests, drive the real showcase: open **Filtering → Text conditions**, confirm a muted `▽` is
present on the Product column with no quick-filter typed, click it → popup opens; focus a cell, press
`Alt+Down` → popup opens; set a filter → `▽` emphasizes; clear it → `▽` mutes but stays.

## Security

No new input-trust boundary: the entry points only *open* the existing popup; operand parsing,
predicate evaluation, and `distinct` truncation are unchanged (RD-06). `security.spec.test.ts` should
remain green unchanged — confirm it does (no regression), no new cases required.
