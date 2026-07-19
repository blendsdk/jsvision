# Execution Plan — widget-flex-adoption

> **Implements**: layout-dsl-adoption/GH-109 + GH-116 · **GitHub**: [#109](https://github.com/blendsdk/jsvision/issues/109) + [#116](https://github.com/blendsdk/jsvision/issues/116)
> **CodeOps Skills Version**: 3.10.0
> **Progress**: 35/35 tasks (100%) — complete
> **Last Updated**: 2026-07-19 (complete — all 5 phases executed and post-phase-reviewed; revised after preflight — [report](00-preflight-report.md))
> **Branch**: `feat/widget-flex-adoption` (cut from `feat/dsl-adoptation`)
> **Verify**: `TUI_SKIP_PERF=1 yarn verify` (AR-6)
> **Routing**: standard → Sonnet-eligible, except tasks 1.7 and Phase 3 (complex)

**Scope**: 48 conversions (12 ui + 36 datagrid) across 10 files, plus 3 preserved sites.

## Phase 1 — Green-first witnesses (standard; 1.7 complex)

Written against **unmodified** source; all pass immediately, which is the point. Every
characterization witness carries the non-vacuity clause (exact counts + non-zero rects) required by
07 §shape.

- [x] 1.1 ST-W1 — `app-shell.composition.spec.test.ts`: root child order across 4 shapes, overlay a direct child with `position:'absolute'`, chrome heights as the literal `1`
- [x] 1.2 ST-W2 — app-shell focus ring as an explicit named list + exact length
- [x] 1.3 ST-W3 — `tabs.content-layout.spec.test.ts`: a caller-set `content.layout` is **discarded**
- [x] 1.4 ST-W4 — the same contract for `createApplication({ content })`
- [x] 1.5 ST-W7 — `overlay-contract.spec.test.ts`: `mountCellOverlay` discards caller `padding`/`direction` while honoring the caller's `rect` w/h (AR-11)
- [x] 1.6 ST-W5 — `aux-composition.impl.test.ts`: `buttonRow`, lifecycle shells (**children's** rects), `ValueList`
- [x] 1.7 ST-W6 — `panel-bands.impl.test.ts`: band-named tree walk over `grid-panels` structure **(complex)**
- [x] 1.8 Verify all seven green against unmodified source; commit as the pre-conversion baseline

## Phase 2 — #109 ui widgets (standard) — 03-01

- [x] 2.1 `data-grid.ts` — convert the 9 sites to the nested `grow(col(...))` expression; delete the dead `fr`/`cell` consts (`:151-152`)
- [x] 2.2 Verify — `datagrid.spec`'s 22 golden cases green **and unedited**; if any moved, fix the code (NFR-1)
- [x] 2.3 `tab-view.ts` — convert `:244`/`:264-266`; **add** the explaining comment at `:254` and leave the assignment (03-01 wording)
- [x] 2.4 `application.ts` — convert `:341` + the `add()` sites to `col(...)`; **relocate** `:347`/`:353` verbatim into standalone guards; **add** the explaining comment at `:330`
- [x] 2.5 Verify — ST-W1…W4 green; the four overlay-locator test files green and unedited
- [x] 2.6 Rebuild `packages/ui` so downstream packages see the change (NFR-4)
- [x] 2.7 Full verify; `yarn plugin:sync --fix` if any public JSDoc moved; commit

## Phase 3 — #116 `grid-panels.ts` — 15 of 23 sites (complex) — 03-02 Group A

- [x] 3.1 Pass 1 — convert the 13 pure size-tag sites (`:208, 517, 522, 527, 536, 540, 544, 566, 567, 591, 619, 625, 658`); note `:619` (inline literal) and `:517/522/527` (`prefixLayout`) are not `fixed1`/`fr`, so a const grep misses them
- [x] 3.2 Verify — ST-W6 + `golden-screen.spec` + `a11y-golden.spec` green with **zero** diff (AC-4)
- [x] 3.3 Pass 2 — `:255` → `fixed(row(), 1)` (preserving `direction:'row'`); `:674` → `grow(col(bodyStack))`
- [x] 3.4 Confirm the 8 out-of-scope sites are untouched (`:441,445,448,578,549,553,557,637`)
- [x] 3.5 Verify — the two goldens still zero-diff; frozen-panels + filter-popup anchor tests green
- [x] 3.6 Full verify; commit

## Phase 4 — #116 remaining modules (standard) — 03-02 Groups B/C/D

- [x] 4.1 Group B — `value-list-popup.ts` (5) + `grid-lifecycle.ts` (5), converting `:76` as `grow(col(...))` to keep `direction:'col'`
- [x] 4.2 Group B — `filter-popup.ts` (4, leaving `:272`) + `button-row.ts` (3, incl. `row(...)`)
- [x] 4.3 Verify — ST-W5 green, especially the lifecycle shells' child rects
- [x] 4.4 Group C — `grid.ts:508/511/1417` + `editing.ts:230` → `cover()` (a literal descriptor rewrite; host liveness is irrelevant)
- [x] 4.5 Verify — `editing.spec` / `cell-editor.spec` nested locators green and unedited
- [x] 4.6 Group D — **add** the explaining comment at `overlay.ts:125` and leave the assignment (AR-11)
- [x] 4.7 Verify — ST-W7 green; `filter-customization.spec` green and unedited
- [x] 4.8 Full verify; commit

## Phase 5 — Hardening & close-out (standard)

- [x] 5.1 Grep audit — `.layout =` across the in-scope files returns **exactly** the 22-site residue allowlist in 01-requirements (AC-8)
- [x] 5.2 `git diff --stat` on `**/test/**` — zero geometry/golden edits; log any locator edit as a deviation (AC-3, NFR-2)
- [x] 5.3 Kitchen-sink smoke green; existing stories unchanged (NFR-5) — no new story owed, the components are not new
- [x] 5.4 `yarn check:deps` · `yarn bench` under the 16 ms ceiling · security oracles green and untouched (AC-9, NFR-6)
- [x] 5.5 Reconcile the #109 and #116 issue bodies and the roadmap tracker rows with the executed scope, before closing either issue
- [x] 5.6 `yarn lint:fix`, full verify, open the PR (base `feat/dsl-adoptation`)

**Verify**: `TUI_SKIP_PERF=1 yarn verify`

## Deviations

**No locator edits so far.** Every existing test passed unedited through Phase 2.

**Post-phase review fixes (Phases 1–2).** The Phase-1 review found the value-list assertions in
`aux-composition.impl.test.ts` were relations between two solved values rather than absolutes — an
identity that would have held even if the list collapsed, on a site Phase 4.1 converts. Fixed to
absolute rects, along with three smaller non-vacuity gaps and one assertion that compared a child
against itself. The Phase-2 review found `col(opts.menuBar, …)` put a caller-supplied view in the
builder's overloaded first slot, where a cross-realm `instanceof` miss would silently reinterpret it
as a props object; now `col({}, …)`. `quitState` was restored to its original position, which the
component spec had said to leave alone.

**Close-out results.** AC-8: the residue grep returns exactly the 22 allowlisted statements.
AC-3/NFR-2: `git diff --stat` on `**/test/**` is 5 added files, 738 insertions, **zero** modifications —
no locator was edited, so NFR-2's allowance was never invoked. AC-4: both full-screen goldens
zero-diff. NFR-5: kitchen-sink smoke 71/71, no story touched. NFR-6: both security oracles green and
untouched. `yarn check:deps` green; `yarn bench` compose+diff median 3.03 ms against the 16 ms ceiling.

**Known-flake note (not a deviation).** One `TUI_SKIP_PERF=1 yarn verify` run failed in
`@jsvision/ui#test` under turbo's parallel load; the same suite passed standalone (311 files / 1784
tests) and the next full verify passed 30/30. `TUI_SKIP_PERF` does not propagate through turbo, so
the perf assertions run regardless — a pre-existing condition, unrelated to this plan.
