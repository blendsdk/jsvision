# Requirements — widget-flex-adoption

> **Source**: GitHub [#109](https://github.com/blendsdk/jsvision/issues/109) + [#116](https://github.com/blendsdk/jsvision/issues/116) · verification [RD-02](../../requirements/RD-02-non-functional-and-verification.md), named subset (AR-5)

## Functional requirements

**FR-1 — ui widget composition (#109).** `table/data-grid.ts`, `tabs/tab-view.ts` and
`app/application.ts` compose their internal view trees with the layout DSL at the **12** sites in
[02-current-state.md §1](02-current-state.md).

**FR-2 — datagrid composition (#116).** The **36** in-scope sites across 7 `packages/datagrid/src`
modules ([02-current-state.md §2](02-current-state.md)) use the DSL: flex containers via `col`/`row`,
size tags via `grow`/`fixed`, fill placement via `cover()`. No `at()` conversion remains in scope
(AR-7).

**FR-3 — the public-clobber contract is preserved and pinned.** At `tab-view.ts:254`,
`application.ts:330` and `overlay.ts:125` the wholesale assignment **stays**, because an external
caller can reach those receivers and today's behavior discards any layout they set (AR-1, AR-11).
Each site gains a comment stating why it is deliberately not converted — written in plain language
with no plan or issue identifiers, per CLAUDE.md's documentation directive — and each is pinned by a
spec test (ST-W3, ST-W4, ST-W7).

**FR-4 — no new nesting anywhere.** No conversion may add a Group between a container and any child.
Tab order must be identical, not merely still-working.

## Non-functional requirements

**NFR-1 — geometry is frozen (AR-4).** Every geometry, golden-screen and a11y assertion in every
existing test stays **byte-identical and unedited**. A failing geometry oracle means the conversion
is wrong. (This deliberately **inverts** RD-02's NFR-3 re-derivation protocol, which does not apply
to behavior-preserving work.)

**NFR-2 — locator edits are bounded and logged (AR-4).** No nesting change is expected anywhere in
this plan, so a broken child-index locator is a mis-transcription signal first. Only after that is
ruled out may a locator be re-expressed structurally — never weakened, and logged as a deviation
naming file, old and new locator, and cause. **ST-W1, ST-W5, ST-W6 and ST-W7 are exempt**: they are
the movement detectors and may not be re-expressed at all.

**NFR-3 — zero regression, verify-green per phase.** `TUI_SKIP_PERF=1 yarn verify` green at every
phase boundary (AR-6); `yarn check:deps` green; bench compose+diff median under the 16 ms ceiling
(RD-02 NFR-5, NFR-7).

**NFR-4 — build-order discipline.** `packages/datagrid` and `packages/examples` tests import
`@jsvision/ui` by name, resolving to built `dist`. Rebuild `ui` after any Phase-2 change before
trusting a datagrid result, or a stale-dist failure gets misattributed.

**NFR-5 — kitchen-sink stories stay green.** Every touched component already ships a story; no new
story is owed (no new components). The smoke test must pass unchanged.

**NFR-6 — security oracles pass unedited** (RD-02 NFR-6). `packages/datagrid/test/security.spec.test.ts`
and `packages/ui/test/controls.completions.security.spec.test.ts` must stay green and untouched.

## Acceptance criteria

| # | Criterion | Oracle |
|---|-----------|--------|
| AC-1 | All 12 #109 conversions landed; both preserved ui sites documented + pinned | 02-current-state §1 tables · ST-W3 · ST-W4 |
| AC-2 | All 36 #116 conversions landed | grep audit vs the residue allowlist |
| AC-3 | Zero geometry/golden assertion edited in any existing test | `git diff` on `**/test/**` at close-out |
| AC-4 | `golden-screen.spec` + `a11y-golden.spec` green **and zero-diff** | verify + diff |
| AC-5 | All three preserved sites unchanged and pinned | ST-W3, ST-W4, ST-W7 |
| AC-6 | Tab order through `TabView` and the app shell unchanged | ST-W2 · existing `tabs.spec` ST-7/8/37/38 |
| AC-7 | `TUI_SKIP_PERF=1 yarn verify` green at every phase boundary | verify log |
| AC-8 | The `.layout =` grep over the in-scope files returns **exactly** the residue allowlist below | task 5.1 |
| AC-9 | Security oracles green and untouched (NFR-6) | verify + diff |

## Residue allowlist

After this plan, a `grep -nE "\.layout\s*=[^=]"` across the 12 touched files — `ui/src/table/data-grid.ts`,
`ui/src/tabs/tab-view.ts`, `ui/src/app/application.ts`, and `datagrid/src/{grid-panels,value-list-popup,
grid-lifecycle,filter-popup,button-row,grid,editing,overlay,quick-filter-row,personalize-dialog}.ts` —
must return **exactly** these 22 statements and no others.

**Match on file + statement, not on line number.** The line numbers below are as of pre-conversion
`feat/dsl-adoptation` HEAD and *will shift*: converting `application.ts:341` collapses four `add()`
calls, `tab-view.ts:244` folds into an expression, and `grid-panels.ts:255`/`:674` each collapse two
lines. The executor re-anchors the line numbers when running task 5.1; a site is accounted for by its
file and the statement it is, not by where it sits.

| File:line | Category |
|---|---|
| `ui/src/tabs/tab-view.ts:254` | preserved — public receiver (FR-3) |
| `ui/src/app/application.ts:330` | preserved — public receiver (FR-3) |
| `datagrid/src/overlay.ts:125` | preserved — public receiver (FR-3, AR-11) |
| `ui/src/app/application.ts:335`, `:435` | excluded — T-AO1 hidden host |
| `ui/src/app/application.ts:347`, `:353` | excluded — #117 owns the merge pattern |
| `datagrid/src/filter-popup.ts:272` | excluded — reactive self-resize (AR-7) |
| `datagrid/src/grid-panels.ts:441`, `:445`, `:448`, `:578` | excluded — branch-accumulating containers (AR-3) |
| `datagrid/src/grid-panels.ts:549`, `:553`, `:557`, `:637` | excluded — runtime-branching `segLayout` (AR-3) |
| `datagrid/src/quick-filter-row.ts:155` | dropped — issue #116 out-scope (AR-7) |
| `datagrid/src/personalize-dialog.ts:391` | dropped — issue #116 out-scope (AR-7) |
| `ui/src/table/data-grid.ts:89`, `ui/src/tabs/tab-view.ts:199` | JSDoc `@example` — #112 (AR-10) |
| `datagrid/src/grid.ts:293`, `datagrid/src/button-row.ts:63` | JSDoc — #112 (AR-10) |

Note `application.ts:314` is a `.layout.rect =` line inside a JSDoc `@example`, so it does not appear in this grep;
`editable-grid-rows.ts:208` is a JSDoc example in a file otherwise untouched by this plan.
