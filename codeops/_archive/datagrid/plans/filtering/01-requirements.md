# Requirements: Filtering

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-06](../../requirements/RD-06-filtering.md) — the OWNING requirements doc

## Scope of this plan (delta view)

### In this plan (all RD-06 Must-Haves — AR #1)

- **Quick-filter row** — an opt-in (`quickFilter`, default off — AR #3), always-visible row beneath
  the header, one inline `Input` per column doing live case-insensitive **contains-match on the
  formatted display** (AR #4).
- **Condition filters** — a header funnel opens an anchored popup offering **type-appropriate
  operators** (text / number / date), the type resolved by runtime inference + optional `filterType?`
  (AR #14).
- **Excel value-list** — the popup's distinct-value checkbox list with type-ahead search + Select All;
  membership is on the **formatted label** (AR #10).
- **Distinct enumeration seam** — grid-computed for in-memory sources (`format∘value`), delegated to
  `source.distinct` when present; the seam is **widened** to carry a truncation flag (AR #5, AR #9).
- **Funnel indicator + "N of M"** — the funnel merges into `SortHeader` (AR #11); the count is exposed
  as reactive API and echoed in the kitchen-sink story (AR #2).
- **Multi-column AND** (AR #8), **push-down** via `setFilter` (AR #7), and the **filter-model API**
  (`setFilter`/`clearFilter`/`filterModel`/`filteredCount`/`totalCount` — AR #13).

### Deferred / out of this plan

- RD-06 Should-Haves — **global quick-search** with highlighting, **top-N** number filters, and
  **relative-date** filters — stay in Phase B (RD-06 §Should Have; unchanged by this plan).
- A visual **footer band** for "N of M" — that is RD-09's footer; this plan exposes only the reactive
  count and demonstrates it in the story (AR #2).
- Saved filter sets (RD-13) and grouping-scoped filters (RD-06 Won't-Have) — unchanged.

## Plan-local decisions

Only decisions NOT already fixed by RD-06 itself. Full options/rationale in the Ambiguity Register.

| Decision | Chosen | AR Ref |
| -------- | ------ | ------ |
| Text / quick-filter match target | Formatted display string | AR #4 |
| Distinct truncation seam | Widen to `Promise<{ values, truncated? }>` | AR #5 |
| Quick-filter row default | Opt-in (`quickFilter`, default off) | AR #3 |
| Model placement | New `filter.ts` (like `sort.ts`) | AR #6 |
| Column filter-type detection | Runtime inference + optional `filterType?` | AR #14 |
| Funnel surface | Extend `SortHeader` + `onFunnelClick` | AR #11 |
| "N of M" home | Reactive API + story echo | AR #2 |

## Acceptance Criteria

The plan is complete when RD-06's nine acceptance criteria (RD-06 §Acceptance Criteria — the owning
list) are all satisfied and the plan-local criteria below hold. Each plan-local criterion cites the
RD acceptance criterion or AR it refines.

1. [ ] The quick-filter row is absent unless `quickFilter: true`; when on, one `Input` per column
       (plan-local refinement of AC-1 under AR #3).
2. [ ] `grid.filteredCount()` / `grid.totalCount()` are reactive and drive the story's "N of M" echo
       (plan-local realization of the RD's footer count under AR #2).
3. [ ] The widened `distinct` seam returns `{ values, truncated? }`; the value-list discloses
       truncation from that flag (refines AC-7 under AR #5).
4. [ ] `column({ …, filterType: 'date' })` type-checks and forces the date operator set; an omitted
       `filterType` infers from a sampled value (refines the condition-filter Must-Have under AR #14).
5. [ ] Full `yarn verify` green (lint + typecheck + build + test + check:docs), and the `filtering`
       kitchen-sink story passes the smoke test (AC-8).
