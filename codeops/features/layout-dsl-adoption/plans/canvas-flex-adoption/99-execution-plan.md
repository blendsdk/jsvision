# Execution Plan — canvas-flex-adoption

> **Implements**: layout-dsl-adoption/GH-110 + GH-111 · **GitHub**: [#110](https://github.com/blendsdk/jsvision/issues/110) + [#111](https://github.com/blendsdk/jsvision/issues/111)
> **CodeOps Skills Version**: 3.10.0
> **Progress**: 14/32 tasks (44%) — Phase 2 done (theme-designer, 7/7 conversions)
> **Last Updated**: 2026-07-20 (Phase 1 complete — revised after preflight, [report](00-preflight-report.md))
> **Branch**: `feat/canvas-flex-adoption` (cut from `feat/dsl-adoptation`)
> **Verify**: `TUI_SKIP_PERF=1 yarn verify && yarn workspace @jsvision/examples test:e2e` (AR-11, AR-17 — `yarn verify` alone runs only the `unit` project, which excludes the e2e files seven witnesses live in)
> **Routing**: standard → Sonnet-eligible throughout (demos, fixtures and panels; no engine work)

**Scope**: 32 conversions (25 examples + 7 theme-designer) across 9 files, plus 3 preserved sites.
**13 of 35 sites carry a property beyond `size`; 9 of those convert** (3 are preserved, 1 is dropped as
vestigial per AR-7) — the dominant risk, addressed by FR-3 and ST-C1…C10.

## Phase 1 — Green-first witnesses (standard)

Written against **unmodified** source; all pass immediately, which is the point. **Every witness
observes the real artifact** — none may assert a tree it built itself (07 §seam rule, AR-13). Each
carries an exact child count and at least one **literal** rect (NFR-3); relation-only assertions are
banned, including between two solved values that could both collapse.

- [x] 1.1 Extract `chrome-bars-demo`'s window build into a new sibling `chrome-bars-demo/tree.ts` that `main.ts` imports — a **pure move, no reordering**. Not an export from `main.ts`: it calls `process.exit()` at module scope, so importing it would kill the vitest worker (AR-16). `editor-demo` needs no source change — it already prints a frame
- [x] 1.2 A new `test/spawn-demo.ts` helper for the frame witnesses (a **new** module, not an edit to an existing case — AC-6); then ST-C1/C2/C3 — `event-demo` frame snapshots appended to `event-demo.e2e.test.ts`: the root's `padding:1` inset, the button row's **2-cell gap** as exact row strings, and the **dialog column** (covers `:119`, which no other witness can see)
- [x] 1.3 ST-C4/C5/C6 — `controls-demo` and `router-demo` frame snapshots (the `padding`/`gap` insets, the DetailScreen's `gap:1` as blank rows)
- [x] 1.4 ST-C7 — `editor-demo` frame snapshot (the indicator strip as the **last** row); ST-C8 — `demo-composition.impl.test.ts` over `chrome-bars-demo/tree.ts`, literal rects, flushing before reading `bounds`
- [x] 1.5 ST-C9 — drive the exported `drillDownStory.build(ctx)`. List leg: the list child's literal rect, the screen's solved `direction` (a lone `fr` child fills identically under `row` and `col`) and `screen.background`. **Detail leg needs navigation**: mount via `createEventLoop`, focus the `ListView`, dispatch `enter`, re-solve — `DetailScreen` is not exported, so reconstructing one would violate the seam rule
- [x] 1.6 ST-C10a/b/c — `panel-composition.impl.test.ts` through `createDesignerApp({ caps, viewport, requireTty:false })` at 90×30: each panel's stacking and the workspace's three literal pane rects (AR-14 — the app seam is mandatory, not a convenience)
- [x] 1.7 Verify all ten green — **including the e2e project**, which `yarn verify` does not run; confirm no existing test **case** was edited; commit as the pre-conversion baseline. (`chrome-bars-demo` is the one green-first exception: its seam edits the file first, so ST-C8 is green-first relative to the post-extraction state — 07 §zero-edit contract)

## Phase 2 — theme-designer (standard) — 03-02

Panels first: `app.ts` may only drop its `direction:'col'` after the builders own it (03-02 §ordering).

- [x] 2.1 `roles-panel.ts` — tail → `col({ background:'dialog' }, fixed(title,1), grow(list))`; **rewrite the now-false comment** about the app setting the direction
- [x] 2.2 `preview-panel.ts` — tail → `col(fixed(title,1), grow(scroller))`
- [x] 2.3 Verify — ST-C10a/b still green. **A no-op checkpoint by design**: until 2.4 the direction is applied twice, so this cannot yet prove the builders took ownership — 2.6 is where that is proven
- [x] 2.4 `app.ts` — `workspace` → `row(fixed(rail.view,28), grow(preview), fixed(inspector,32))`; drop all three `direction:'col'` halves (inspector's is vestigial, AR-7)
- [x] 2.5 **Add** the explaining comment at `sizeWorkspace` and leave the assignment (AR-4)
- [x] 2.6 Verify — ST-C10a/b/c all green (C10c is what proves the workspace row survived dropping the three `direction` halves); `walkthrough.e2e` + `inspector-panel.spec` green and unedited
- [x] 2.7 Full verify; commit

## Phase 3 — example demos (standard) — 03-01

- [ ] 3.1 `editor-demo/main.ts` — `col(grow(ed), fixed(ind,1))`
- [ ] 3.2 `event-demo/main.ts` — the three-level root; fold the `for (const b of …)` loop into inline `grow()`; carry **`gap:2`** and **`padding:1`** on the builders; leave both `.background =` lines separate (AR-15)
- [ ] 3.3 `event-demo` — rename `printFrame`'s `for (const row of rows)` → `line` (AR-5), since this file now imports the `row` builder
- [ ] 3.4 Verify — ST-C1/C2/C3 + ST-C7 green; `editor-demo.e2e` + `event-demo.e2e` existing cases green and unedited
- [ ] 3.5 `controls-demo/main.ts` — keep the data-driven loop, move the descriptor onto `col({ padding:1, gap:0 })`; leave `form.background` a separate assignment (AR-15); rename `printFrame`'s loop variable (AR-5)
- [ ] 3.6 `router-demo/main.ts` — the `list` closure → `col({ padding:1, gap:0 }, …)`, `screen.background` left separate (AR-15); `DetailScreen`'s 3 children tagged; **add** the explaining comment at `:59` and leave the assignment (AR-6); rename `printFrame`'s loop variable (AR-5)
- [ ] 3.7 Verify — ST-C4/C5/C6 green; `controls-demo.e2e` + `router-demo.e2e` existing cases green and unedited
- [ ] 3.8 `chrome-bars-demo/main.ts` — `win.add(grow(body))`
- [ ] 3.9 `drill-down.story.ts` — the `list` closure + `DetailScreen`'s 3 children; **add** the explaining comment at `:29`; do **not** import the DSL's `at` (AR-8)
- [ ] 3.10 Verify — ST-C8/C9 green; `kitchen-sink.smoke.spec` green and unedited (NFR-5)
- [ ] 3.11 Full verify; commit

## Phase 4 — Hardening & close-out (standard)

- [ ] 4.1 Grep audit — `.layout =` across the 9 files returns **exactly** the 3-statement residue allowlist in 01-requirements (AC-8)
- [ ] 4.2 `git diff --stat` on `**/test/**` — zero edits to any pre-existing test **case** (AC-6). **No locator edit is permitted**: FR-5 forbids nesting changes, so a broken locator is a mis-transcription that halts the phase and is fixed in source, never in the test
- [ ] 4.3 `git diff --stat` — confirm no file under `packages/{core,ui,datagrid,files,forms,web}/src` was touched (AC-9, NFR-6)
- [ ] 4.4 `yarn check:deps`; kitchen-sink smoke green
- [ ] 4.5 **Manual read-through** — run `yarn designer` on a TTY and at least one `demo:*`; confirm the converted files read well as teaching material, which is the point of FR-6 (not automatable, not a gate)
- [ ] 4.6 Reconcile the #110 and #111 issue bodies and the roadmap tracker rows with the executed scope — including that `view-demo`/`layout.story.ts` remain open under #110 (AR-2)
- [ ] 4.7 `yarn lint:fix`, full verify, open the PR (base `feat/dsl-adoptation`)

**Verify**: `TUI_SKIP_PERF=1 yarn verify && yarn workspace @jsvision/examples test:e2e`

## Deviations

_None yet. A broken locator is **not** a deviation — it halts the phase and is fixed in source (task 4.2)._
