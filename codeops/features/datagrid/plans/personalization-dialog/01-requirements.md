# Requirements: Personalization Dialog

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-16](../../requirements/RD-16-personalization-dialog.md) — the OWNING requirements doc

This plan implements RD-16 in full. RD-16 owns the requirements, scope decisions, security
considerations, and the 15 acceptance criteria — this document is a **delta view** only (per
"Reference, don't restate"): what this plan builds, what it defers, and the plan-local decisions the RD
did not already fix. Do not re-derive the RD here.

## Scope of this plan (delta view)

### In this plan — the complete RD-16 Must-Have + Should-Have surface

- **Grid read/write additions** (RD-16 §Technical) — `grid.columns()` reactive accessor, `grid.defaultColumnLayout()`, `grid.clearColumnWidth(id)`, and the corrected `applyVariant`/`resolveVariant` width-restore (delete-then-set). Owning spec: [03-01](03-01-grid-layout-api.md).
- **Caller persistence seam** (RD-16 §Technical) — the `VariantStore` interface + a reference `createMemoryVariantStore()`. Owning spec: [03-02](03-02-variant-store.md).
- **The dialog + open helper** (RD-16 §Must, §Should) — `personalizeGrid(grid, opts)`; staged OK/Cancel; show/hide (last-column guard), move-up/down reorder, per-column freeze, width set/clear, Reset; full variant management (save-as + confirm-overwrite, apply, delete + confirm, set-default); the visible-count echo; keyboard-operable + mouse parity. Owning spec: [03-03](03-03-personalize-dialog.md).
- **Kitchen-sink story + `datagrid-showcase` demo + security oracle** (RD-16 §Must, AC#13/#14). Owning spec: [03-04](03-04-showcase-barrel-security.md).

### Deferred / out of this plan (RD-16 §Won't Have — unchanged)

- Live-preview apply · auto-apply of the default on grid load · drag-to-reorder inside the dialog · column-list search/type-to-filter · sort/filter *editing controls* · CSV import/paste-append · grouping/pivot management. All owned by RD-16 §Won't-Have; this plan adds nothing to them.

## Plan-local decisions

Only decisions **not** already in RD-16 (the RD owns behaviour; these are the *how*). Full detail in
[00-ambiguity-register.md](00-ambiguity-register.md).

| Decision | Chosen | AR |
| -------- | ------ | -- |
| Module split | 3 new modules + thin grid delegators | AR-1 |
| `GridColumnInfo` location / store factory name | `variant.ts` / `createMemoryVariantStore()` | AR-2 |
| Width-restore signal shape | `clearWidths: string[]` in `ResolvedLayout` | AR-3 |
| grid.ts line-guard | thin delegators + re-base three `< 1680` guards | AR-4 |
| Column-list composition | `Scroller` over per-column composite `Group`s | AR-5 |
| Freeze affordance | per-row `none → left → right` cycle | AR-6 |
| Width / name input widgets | `Input(filter('0-9'))` + clamp-on-OK / `Input(maxLength:64)` + `sanitize` | AR-7 |
| Dialog mechanism | sync `Dialog` subclass, typed `result()`, no forms dep | AR-8 |
| Showcase placement | new `'Personalization'` category, one demo | AR-9 |
| Phasing | 4 phases | AR-10 |
| Verify command | `CI=1 yarn verify` | AR-11 |
| RD-13 regression test placement | spec case in `variant.spec.test.ts` | AR-12 |

## Acceptance Criteria

RD-16 owns the 15 acceptance criteria (RD-16 §Acceptance Criteria, AC#1…AC#15) — they are **not** restated
here. Each is discharged by the ST-cases in [07-testing-strategy.md](07-testing-strategy.md); the mapping
lives there. Plan-local completion adds only: every new public export carries an `@example`
(`check:docs`), no banned CodeOps/TV references in shipped source (grep-verified — the `check-jsdoc`
scanner has a known grid.ts gap), and `grid.ts` remains a thin delegator under its re-based line guard.
