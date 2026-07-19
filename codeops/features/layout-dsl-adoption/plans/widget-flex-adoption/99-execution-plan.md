# Execution Plan — widget-flex-adoption

> **Implements**: layout-dsl-adoption/GH-109 + GH-116 · **GitHub**: [#109](https://github.com/blendsdk/jsvision/issues/109) + [#116](https://github.com/blendsdk/jsvision/issues/116)
> **CodeOps Skills Version**: 3.10.0
> **Progress**: 0/30 tasks (0%)
> **Last Updated**: 2026-07-19
> **Branch**: `feat/widget-flex-adoption` (cut from `feat/dsl-adoptation`)
> **Verify**: `TUI_SKIP_PERF=1 yarn verify` (AR-6)
> **Routing**: standard → Sonnet-eligible, except Phase 3 (complex — 24 sites under two golden oracles)

## Phase 1 — Green-first witnesses (standard)

Written against **unmodified** source; all pass immediately, which is the point (07 §shape).

- [ ] 1.1 ST-W1 — `app-shell.composition.spec.test.ts`: root child order (3 shapes), overlay is a direct child with `position:'absolute'`, chrome row heights
- [ ] 1.2 ST-W2 — app-shell tab order captured by name
- [ ] 1.3 ST-W3 — `tabs.content-layout.spec.test.ts`: a caller-set `content.layout` is **discarded** (the public clobber contract)
- [ ] 1.4 ST-W4 — the same contract for `createApplication({ content })`
- [ ] 1.5 ST-W5 — `aux-composition.spec.test.ts`: `buttonRow`, `grid-lifecycle` shells, `ValueList` solved rects
- [ ] 1.6 ST-W6 — `panel-bands.spec.test.ts`: every `grid-panels` band + per-segment panel rect
- [ ] 1.7 Verify all six green against unmodified source; commit as the pre-conversion baseline

## Phase 2 — #109 ui widgets (standard) — 03-01

- [ ] 2.1 `data-grid.ts` — convert the 9 sites to the nested `grow(col(...))` expression; delete the dead `fr`/`cell` consts
- [ ] 2.2 Verify — `datagrid.spec` 22 golden cases green **and unedited**; if any moved, fix the code (NFR-1)
- [ ] 2.3 `tab-view.ts` — convert `:244`/`:264-266`; leave `:254` with its explaining comment (AR-1)
- [ ] 2.4 `application.ts` — convert `:341-356` to `col(opts.menuBar, body, opts.statusLine, overlay)`; leave `:330` with its comment
- [ ] 2.5 Verify — ST-W1…W4 still green; the four overlay-locator test files green and unedited
- [ ] 2.6 Rebuild `packages/ui` so downstream packages see the change (NFR-4)
- [ ] 2.7 Full verify; `yarn plugin:sync --fix` if any public JSDoc moved; commit

## Phase 3 — #116 `grid-panels.ts` (complex) — 03-02 Group A

- [ ] 3.1 Pass 1 — convert the 18 tag sites (`fixed1`/`fr`/`segLayout`/`prefixLayout`) to `fixed`/`grow`
- [ ] 3.2 Verify — ST-W6 + `golden-screen.spec` + `a11y-golden.spec` green with **zero** diff (AC-4)
- [ ] 3.3 Pass 2 — convert the 5 container sites (`inner`, `bodyRow`, `freezeRowsRow`, `bodyStack`, `host`) to `col`/`row`, preserving the lifecycle-swap branches
- [ ] 3.4 Confirm rebuild idempotency — `buildGridBody` runs twice (`grid.ts:665`, `:744`); re-tagging must be a no-op
- [ ] 3.5 Verify — the two goldens still zero-diff; frozen-panels + filter-popup anchor tests green
- [ ] 3.6 Full verify; commit

## Phase 4 — #116 remaining modules (standard) — 03-02 Groups B/C/D

- [ ] 4.1 Group B — `value-list-popup.ts` (5) + `grid-lifecycle.ts` (5) → taggers
- [ ] 4.2 Group B — `filter-popup.ts` (4, leaving `:272`) + `button-row.ts` (3, incl. `row(...)`)
- [ ] 4.3 Verify — ST-W5 green
- [ ] 4.4 Group C — `grid.ts:508/511/1417` + `editing.ts:230` → `cover()`; **confirm each host is live**, not a hidden host (T-AO1 premise)
- [ ] 4.5 Verify — `editing.spec` / `cell-editor.spec` nested locators green and unedited
- [ ] 4.6 Group D — `quick-filter-row.ts:155`, `personalize-dialog.ts:391`, `overlay.ts:125` → `at()`
- [ ] 4.7 Verify — `quick-filter-row.impl`'s 15 `.layout.rect` reads green and unedited
- [ ] 4.8 Full verify; commit

## Phase 5 — Hardening & close-out (standard)

- [ ] 5.1 Grep audit — every in-scope `.layout =` site converted or one of the six documented exclusions (AC-8)
- [ ] 5.2 `git diff --stat` on `**/test/**` — confirm zero geometry/golden edits; log any locator edit as a deviation (AC-3, NFR-2)
- [ ] 5.3 Kitchen-sink smoke green; existing stories for every touched component unchanged (NFR-5) — no new story required, the components are not new
- [ ] 5.4 `yarn check:deps` + `yarn bench` under the 16 ms ceiling (NFR-3)
- [ ] 5.5 `yarn lint:fix`, full verify, open the PR (base `feat/dsl-adoptation`)

**Verify**: `TUI_SKIP_PERF=1 yarn verify`

## Deviations

_None yet — logged here as execution proceeds (NFR-2 requires each locator edit to be recorded)._
