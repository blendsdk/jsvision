# Plan: widget-flex-adoption

> **Implements**: layout-dsl-adoption/GH-109 + layout-dsl-adoption/GH-116 · verification layout-dsl-adoption/RD-02
> **GitHub**: [#109](https://github.com/blendsdk/jsvision/issues/109) + [#116](https://github.com/blendsdk/jsvision/issues/116) · epic [#108](https://github.com/blendsdk/jsvision/issues/108)
> **Status**: 📋 Plan Created
> **Created**: 2026-07-19
> **CodeOps Skills Version**: 3.10.0

## Objective

Adopt the layout DSL across the `@jsvision/ui` widget composition (`DataGrid`, `TabView`,
`createApplication`) and the whole of `@jsvision/datagrid` — **60 call sites across 13 files** —
replacing hand-assigned `.layout = {…}` descriptors with `col`/`row`/`grow`/`fixed`/`at`/`cover`.

Unlike its sibling plans, this work is **behavior-preserving**. RD-01's deliberate-divergence licence
does **not** apply (AR-5): every pixel must land where it lands today, and every geometry oracle must
stay green **and unedited**.

## Why the two issues are planned together

They are structurally independent — `packages/datagrid/src` imports neither `DataGrid` nor `TabView`
nor anything from ui's `table/`/`tabs/` subpaths (verified, no such import exists). #109 is small
(12 conversions in 3 files) and is the cleanest possible surface: pure `direction`/`size` descriptors
with no absolute geometry. Running it first validates the conversion idiom before #116's 48 sites
touch the most oracle-dense package in the repo.

## The finding that shapes this plan

`grow()` and `fixed()` **merge** (`view.layout = { ...view.layout, size }`) and return the *same
view* — they are taggers, not wrappers, so they add **zero nesting depth**. Two consequences run
through every document here:

1. **Most of the oracle exposure is defused.** Tag-site conversions cannot move geometry or break a
   `children[index]` locator. Only container conversions can, and only if nesting depth changes.
2. **But the merge is a silent behavior change on caller-supplied views**, where today's code
   clobbers wholesale. No existing test passes a pre-set layout, so nothing would catch it — the
   same shape of silent break that killed T-AO1. AR-1 resolves this per site by an
   externally-observable rule; ST-W3/ST-W4 pin the preserved contract so a future reader cannot
   "helpfully" convert those two sites.

## Prerequisite

None. #122 (tree-order Tab traversal) already landed on `feat/dsl-adoptation`, and this plan adds no
new nesting to any focusable container. Work proceeds on `feat/widget-flex-adoption`, cut from
`feat/dsl-adoptation`.

## Documents

| Doc | Contents |
|-----|----------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | ✅ Gate passed — 10 resolved items, 0 deferred |
| [01-requirements.md](01-requirements.md) | Scope, in/out, acceptance criteria |
| [02-current-state.md](02-current-state.md) | Full 60-site inventory + oracle exposure map |
| [03-01-ui-widgets.md](03-01-ui-widgets.md) | #109 — `data-grid.ts`, `tab-view.ts`, `application.ts` |
| [03-02-datagrid-widgets.md](03-02-datagrid-widgets.md) | #116 — `grid-panels.ts` + 9 further modules |
| [07-testing-strategy.md](07-testing-strategy.md) | ST-W1…ST-W6 witnesses + the zero-edit oracle contract |
| [99-execution-plan.md](99-execution-plan.md) | 5 phases · 30 tasks |

## Out of scope

- JSDoc `@example` blocks containing `.layout =` — owned by **#112** (AR-10).
- `application.ts:335`/`:435` — the T-AO1 hidden-host overlay, closed won't-do (RD-01 FR-4).
- `application.ts:347`/`:353` — the `{...spread, size}` pattern owned by **#117**.
- `filter-popup.ts:272` — `this.layout` self-config, the #113 S6 deferral (AR-7).
