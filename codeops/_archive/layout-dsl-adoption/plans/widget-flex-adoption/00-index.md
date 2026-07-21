# Plan: widget-flex-adoption

> **Implements**: layout-dsl-adoption/GH-109 + layout-dsl-adoption/GH-116 · verification layout-dsl-adoption/RD-02 (named subset — AR-5)
> **GitHub**: [#109](https://github.com/blendsdk/jsvision/issues/109) + [#116](https://github.com/blendsdk/jsvision/issues/116) · epic [#108](https://github.com/blendsdk/jsvision/issues/108)
> **Status**: 🔬 Plan Preflighted (2026-07-19 — 27 findings, all resolved)
> **Created**: 2026-07-19 · **Revised**: 2026-07-19 after preflight
> **CodeOps Skills Version**: 3.10.0

## Objective

Adopt the layout DSL across `@jsvision/ui`'s widget composition (`DataGrid`, `TabView`,
`createApplication`) and `@jsvision/datagrid` — **48 conversions across 10 files**, plus **3 sites
deliberately preserved and pinned** — replacing hand-assigned `.layout = {…}` descriptors with
`col`/`row`/`grow`/`fixed`/`cover`.

Unlike its sibling plans this work is **behavior-preserving**. RD-01's deliberate-divergence licence
does **not** apply: every pixel must land where it lands today, and every geometry oracle must stay
green **and unedited**.

## Why the two issues are planned together

#109 touches only `table/data-grid.ts`, `tabs/tab-view.ts` and `app/application.ts`; nothing in
`packages/datagrid/src` imports any of the three. (Datagrid *does* import `GridRows` from ui's
`table/grid-rows.ts` — untouched here — which is why the build-order rule in NFR-4 still matters.)
#109 is small and is the cleanest possible surface, so running it first validates the conversion
idiom before datagrid's 36 sites touch the most oracle-dense package in the repo.

## The finding that shapes this plan

`grow()`/`fixed()`/`at()`/`cover()` **merge** (`view.layout = { ...view.layout, … }`) and return the
*same view* — taggers, not wrappers, so they add **zero nesting depth**. Two consequences:

1. **Most oracle exposure is defused.** Tag conversions cannot move geometry or break a
   `children[index]` locator.
2. **But the merge silently changes semantics** wherever the replaced code clobbered wholesale, and
   **the tagger only writes the props it owns** — a `direction` in the original literal is dropped.
   Preflight found three sites where that bites (PF-001/002/003) and one public receiver the rule
   was never applied to (PF-007). Both classes are now resolved.

## The `application.ts` trade

AR-2 admitted `application.ts` on the basis of two convertible sites; AR-1's later per-site rule
reclassified one of them as a preserved public receiver, leaving **one** conversion. That one
conversion still carries three of Phase 1's witnesses and exposure to four overlay-locator test
files, two of them immutable oracles. The trade is recorded here rather than buried in the register:
the witnesses have standalone value (they close a real coverage gap on the app shell's conditional
child assembly), which is why the site was kept.

## Prerequisite

None outstanding. **PR #123 merged** 2026-07-19, so `develop` carries #122's tree-order traversal and
#115. This plan adds no new nesting to any focusable container. Work proceeds on
`feat/widget-flex-adoption`, cut from `feat/dsl-adoptation`.

## Documents

| Doc | Contents |
|-----|----------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | ✅ Gate passed — 12 resolved items, 0 deferred |
| [00-preflight-report.md](00-preflight-report.md) | 🔬 27 findings (1 🔴 · 10 🟠 · 16 🟡), all resolved |
| [01-requirements.md](01-requirements.md) | Scope, in/out, acceptance criteria |
| [02-current-state.md](02-current-state.md) | Verified site inventory + oracle exposure map |
| [03-01-ui-widgets.md](03-01-ui-widgets.md) | #109 — `data-grid.ts`, `tab-view.ts`, `application.ts` |
| [03-02-datagrid-widgets.md](03-02-datagrid-widgets.md) | #116 — `grid-panels.ts` + 7 further modules |
| [07-testing-strategy.md](07-testing-strategy.md) | ST-W1…ST-W7 witnesses + the zero-edit oracle contract |
| [99-execution-plan.md](99-execution-plan.md) | 5 phases · 35 tasks |

## Out of scope

Every residual `.layout =` site is enumerated with its category in
[01-requirements.md §Residue allowlist](01-requirements.md#residue-allowlist) — that list, not a
count, is the close-out oracle (AC-8).

Headline exclusions: JSDoc `@example` blocks (#112, AR-10) · `application.ts:335`/`:435` (T-AO1
hidden host) · `application.ts:347`/`:353` (#117) · `filter-popup.ts:272` (reactive self-resize) ·
`quick-filter-row.ts:155` + `personalize-dialog.ts:391` (dropped per AR-7) · eight `grid-panels.ts`
sites (four branch-accumulating containers, four `segLayout` branches — AR-3).
