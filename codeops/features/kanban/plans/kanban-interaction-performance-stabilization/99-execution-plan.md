# Execution Plan: Kanban Interaction and Performance Stabilization

> **Implements**: kanban/T-03
> **Type**: Task (lightweight) · **Feature**: kanban
> **Status**: Executing
> **Created**: 2026-08-12
> **Last Updated**: 2026-08-12 17:00 CEST
> **Progress**: 8/46 tasks (17%)
> **CodeOps Artifact Schema**: 1

## Objective

Restore trustworthy, immediate Kanban interaction before any regular roadmap work resumes. The board
must preserve non-overlapping variable-height geometry through focus, wheel scrolling, resize, and drag;
mouse feedback must update in the same input cycle; steady rendering and drag must remain bounded to the
visible working set; and the standalone GitHub Projects application must demonstrate those guarantees with
reactive themes, locally movable cards, and a polished information hierarchy.

This plan implements already-approved RD-03, RD-04, RD-07, and RD-14 behavior, including AR-44's
superseding user-approved title-only drag ghost. It does not introduce a second performance contract: it
applies AR-38's controlled median render/drag target of at most 16 ms for an 80×24 board after warmup,
records p95 against the 33 ms diagnostic target, and keeps deterministic complexity, semantic-damage,
composition, source-read, and terminal-output bounds normative in ordinary tests.

**Roadmap gate:** T-03 is release-blocking. Do not start the next regular Kanban roadmap plan until every
automated gate passes and the user accepts the native-terminal interaction review in Phase 6.

## Confirmed failure evidence

| Area | Reproduced symptom | Planning consequence |
|---|---|---|
| Variable-height scroll | One wheel step can produce overlapping or inverted resident card rectangles in several columns | Repair shared viewport projection before tuning the demo |
| Focus repaint | Clicking a card damages unrelated lower-card fragments and appears to reflow the board | Freeze stable unrelated geometry and bounded damage as specification behavior |
| Pointer drag | Programmatic dispatch can accept a move while overlapping hit regions make real mouse targeting unreliable | Require mounted pointer traces and native-terminal acceptance, not controller-only tests |
| Theme switching | The app theme changes, but the board has no reactive Kanban-theme input | Make the component palette follow every app theme selection |
| Showcase styling | Eight GitHub status colors currently collapse to four roles and assignees are loaded but not presented | Add a deliberate accessible status palette and richer bounded card hierarchy after correctness is restored |

## Scope boundaries

### In scope

- Sparse variable-height measurement, vertical projection, anchor restoration, clipping, hit maps, damage,
  and drag reprojection in `@jsvision/kanban`.
- Wheel, focus, resize, pointer capture, ghost, insertion-gap, release, and local move behavior exercised
  through a mounted board and supported native/browser host seams.
- Deterministic resident-work, descriptor, damage, and source-read assertions plus controlled local timing
  evidence and Kanban registration in the repository performance runner.
- The standalone GitHub Projects Kanban application's reactive board theme, accessible status treatment,
  bounded card contents, local-only movement, responsive layout, and focused application tests.
- Required public documentation/generated plugin synchronization if the corrected behavior changes a
  public guarantee or any source path mapped by the plugin-impact manifest.

### Out of scope

- GitHub authentication, private projects, write-back, persistence, synchronization, or production
  security infrastructure.
- New card editors, filters, saved views, configuration dialogs, or other unfinished roadmap features.
- Reproducing every GitHub web color literally or adding an unbounded/custom token registry. AR-45 adds only
  four generic neutral card accent roles with deterministic legacy fallback; exact status text and non-color
  cues remain authoritative.
- Universal FPS claims or shared-CI wall-clock enforcement.
- Visual polish that hides, tolerates, or works around invalid component geometry in the application.

## Acceptance contract

1. **Geometry integrity:** for every visible cell, card rectangles are finite, ordered by logical card
   order, separated by the configured gap, and never overlap. Clipped residents and their hit regions
   agree exactly; no painted card fragment may be inert because its hit target was discarded.
2. **Stable identity:** focus-only and selection-only changes do not move unrelated cards. Wheel and
   resize sequences preserve the documented visible identity/anchor and never reset a corrected sparse
   height projection to estimates during a same-frame restoration pass.
3. **Immediate pointer feedback:** after the drag threshold, every normalized pointer-move updates one
   compact framed title row positioned from the exact pointer-relative grab offset, plus a bounded selected
   count when multiple, with no blank trailing row. The eligible insertion gap and ghost appear before that
   individual `EventLoop.dispatch()` returns. The mounted emitted/serialized frame and detached overlay
   evidence agree without an explicit flush, data load, operation settlement, promise, timer, or later event.
   Tests distinguish the raw origin (`normalized pointer - captured grab offset`) from the viewport-clipped
   visible rectangle at every edge.
4. **Truthful targets:** a card move target is a gap before or after a card, the leading/trailing stack
   edge, or an empty lane. It is never visually centered inside a card. Hysteresis may retain the prior
   slot by at most the approved one-cell band.
5. **Bounded repaint evidence:** focus changes produce semantic damage only for the old/new focus visuals
   and contained shadows. Scrolling and target changes produce bounded visible-region damage, with an
   explicitly classified fallback. These rectangles are evidence rather than a claim of region-clipped
   Core/UI composition: ordinary tests separately bound Kanban leaf composition to visible descriptors plus
   overscan and bound final changed cells, runs, and serialized bytes.
6. **Performance:** ordinary tests prove work proportional to visible descriptors plus finite overscan.
   A deliberate serial local benchmark discards 20 warmup iterations, records 200 timed samples, and
   measures both Kanban projection/draw and the normalized-event → synchronous EventLoop paint →
   `RenderRoot` compose/diff → in-memory host diff path through a fake sink, excluding terminal I/O.
   Median render and drag samples target at most 16 ms; p95 is reported against 33 ms with CPU, runtime,
   fixture, source mode, visible-count, terminal-harness, iteration, and date metadata.
7. **Showcase:** all supplied app themes visibly affect the Kanban; cards remain readable and locally
   movable; GitHub's eight status colors map deliberately into four application-neutral card accent families
   introduced by AR-45, while exact status remains available through bounded text/glyph/attribute cues in
   truecolor, 256, 16, mono, and `NO_COLOR`. Accent surfaces remain stable across focus/selection, whose
   border/title/attribute cues stay visible. Labels, assignees, repository, item reference, and type appear
   when available within bounded presentation budgets.
8. **Responsive host behavior:** the deterministic injected 84-card project fixture remains operable at
   80×24 and after narrower, wider, shorter, taller, maximize, and restore transitions without overlap,
   stale hit regions, or lost fresh-drag capability. A resize during drag cancels synchronously; scrolling
   during drag preserves the gesture.
9. **Manual release gate:** the user verifies in a real terminal that click, wheel, grab, ghost tracking,
   target changes, drop, resize, and theme switching feel immediate and visually stable.

## Expected modification set

- `packages/kanban/src/board/{kanban-viewport,viewport-source,viewport-projector,viewport-metrics,viewport-damage,viewport-drag,viewport-input,viewport-render,viewport-scale-inspection}.ts`
- `packages/kanban/src/layout/{sparse-height-index,vertical-projector,swimlane-geometry}.ts`
- `packages/kanban/src/card/{theme,theme-resolver,adapter,style-resolver}.ts` for AR-45's additive neutral
  accent roles, deterministic legacy fallback, and focus/selection composition
- `packages/kanban/src/testing.ts` and
  `packages/kanban/src/testing/{semantic-host-board,drag-harness,windowed-fixture}.ts` as required by
  additive testing-only operation-delta, range, frame-diff, and host evidence; existing exported snapshot
  and host-result shapes remain backward compatible
- Focused specification/implementation/performance/host tests under `packages/kanban/test/`
- `packages/kanban/test/perf-kanban-bench.spec.test.ts`
- `scripts/check-performance.mjs`
- `packages/examples/github-project-kanban/**`
- `packages/examples/test/github-project-kanban*.spec.test.ts`
- `packages/examples/test/perf-gate.spec.test.ts`
- Mapped canonical skill references and generated plugin outputs reported by `yarn plugin:update`
- This execution plan and `codeops/features/kanban/00-roadmap.md`

The current working tree already contains user-directed Kanban fixes and the uncommitted GitHub showcase.
Before executing Task 1.1.1, focused verification must cover that exact tree and a user-authorized dedicated
baseline checkpoint commit must leave it clean. Record the checkpoint ref and `git status --short` result in
this plan. If verification fails, fix only the pre-existing user-directed work and repeat the gate; do not
begin T-03 specification work on an unverified or uncommitted baseline.

**Execution baseline:** the preflighted artifact hash matched
`0ebdbf6e21dd0c229f03b70ce01c4be57c4602dcac6ab017aab05f1b632f1093`. Focused Kanban and
examples tests, package typechecks, plugin synchronization/check, and `yarn verify:local` passed before
checkpoint `0bd32c9d2`; `git status --short` was empty. The checkpoint was pushed to
`origin/feat/kanban` before T-03 specification work began.

## Execution rules

- Follow specification tests → expected red → implementation → green → implementation/performance tests.
- Update this document immediately after each completed task; only `[x]` counts toward Progress.
- A geometry, interaction, or performance assertion derived from the acceptance contract is an immutable
  oracle. Do not weaken it to fit the implementation without explicit user approval.
- Treat any overlap, inverted ordering, stale interactive fragment, delayed ghost, or full logical-data
  scan as a blocking defect, not a showcase limitation.
- Preserve exactly one sparse height authority. Source acquisition consumes revision-bound declarative
  logical ranges from that authority; it must not maintain a second height model.
- Allow exactly two total projections per frame: the initial projection and at most one measurement
  correction. A failure beyond that ceiling follows the compatibility/fallback contract in Task 2.1.3.
- Do not begin Phase 5 visual polish until Phases 1–4 pass. This prevents demo code from masking a shared
  component defect.

## Phase 1: Freeze the real regression

> **Phase baseline tree**: 266f18a0c3e7b40f6333ffb57b28183c0b560970
> **Scope mode**: strict
> **Expected modification set**: the Phase 1 fixture/specification, testing-only diagnostic bridge, this
> execution plan, and the Kanban feature roadmap paths named by Tasks 1.1.1–1.2.3. Existing production
> behavior may be read for diagnosis but is not modified in this phase.

### Step 1.1: Specification fixtures

- [x] 1.1.1 Create one deterministic injected 84-card, five-column GitHub-shaped fixture containing named
      short/tall/dense cases, multiple labels, assignees, summaries, empty columns, every GitHub status,
      bounded hostile control/bidi text, wide/combining glyphs, and longest supported-locale strings. Keep
      focused parser/sanitizer cases separate, and never use live network data as an automated oracle. ✅
      (completed: 2026-08-12 16:40)
- [x] 1.1.2 Add a mounted viewport specification that performs click, repeated wheel down/up, horizontal
      scroll, narrow/wide resize, and restore sequences against the real fixture. ✅ (completed:
      2026-08-12 16:43)
- [x] 1.1.3 Add geometry assertions for monotonic card order, configured gaps, non-overlap, finite clipped
      rectangles, one card per logical identity, and exact paint/hit-region parity. ✅ (completed:
      2026-08-12 16:45)
- [x] 1.1.4 Add a focus-damage specification proving unrelated resident card geometry and lower fragments
      remain unchanged after a click. ✅ (completed: 2026-08-12 16:47)
- [x] 1.1.5 Add a mounted per-event EventLoop drag trace proving that each pointer dispatch returns only
      after one compact framed title row positioned from the exact pointer-relative grab offset, a bounded
      selected-count cue when multiple, no blank trailing row, and a gap-only target appear in both the
      emitted/serialized frame and detached overlay evidence, with no explicit flush, promise, timer, load,
      settlement, or later event. Assert the raw origin as `normalized pointer - captured grab offset`
      separately from the viewport-clipped visible rectangle at all four edges. Prove continued drag after
      scrolling, synchronous cancellation on resize, one valid release/local publication reconciliation,
      and an immediately successful fresh drag after cancellation. ✅ (completed: 2026-08-12 16:51)
- [x] 1.1.6 Run the focused specifications and record the expected red failures without changing their
      geometry or interaction expectations. ✅ (completed: 2026-08-12 16:53)

**Red-phase evidence:** the calibrated mounted sequence passed, while five contract assertions failed as
expected: mixed-height card order/gaps overlap, focus uses whole-viewport damage, and all three drag cases
lack the planned additive detached ghost/gap geometry evidence. Log:
`/tmp/jsvision-t03-red-1.1.6-Bsma.log`.

### Step 1.2: Diagnostic isolation

- [x] 1.2.1 Extend the existing testing-only weak-map scale/snapshot bridge to identify every projection
      pass that uses measured versus estimated heights without changing production inspection or exposing
      card payloads. ✅ (completed: 2026-08-12 16:57)
- [x] 1.2.2 Prove whether focus damage inflation originates in height convergence, identity restoration,
      overlay composition, damage calculation, or more than one stage; record the result in this plan. ✅
      (completed: 2026-08-12 17:00)
- [ ] 1.2.3 Prove whether real drag unreliability remains after geometry is valid or is fully explained by
      corrupted hit maps; keep any independent input defect in Phase 3 scope.

**Focus-damage isolation:** both pointer-down and pointer-up produce whole-viewport semantic damage while
every card rectangle—including the focused card—remains byte-for-byte stable and no drag/operation overlay
exists. The inflation therefore originates in `calculateKanbanSceneDamage`: a visual/interaction revision
with no geometry `changedRegions` falls through to the whole-viewport safety branch. Height convergence,
identity restoration, and overlay composition are not additional causes for this focused-click trace.

## Phase 2: Stabilize variable-height projection

### Step 2.1: Sparse geometry correction

- [ ] 2.1.1 Preserve the current measured height projection through every same-frame reproject, including
      source/layout identity restoration and drag reprojection.
- [ ] 2.1.2 Replace both the fixed two-row descriptor estimate and fixed-stride source-window acquisition
      with revision-bound declarative logical/per-cell ranges derived from the viewport's one sparse height
      authority and resolved presentation/density. Define a conservative bootstrap range before exact
      measurements exist; retain exact measurements by card identity and revision.
- [ ] 2.1.3 Converge within exactly two total projections: one initial pass plus at most one measurement
      correction. If that ceiling fails, reuse the previous completed frame only when a complete
      compatibility fingerprint matches bounds, source/query/layout, presentation, theme/capabilities,
      interaction, and geometry revisions. Otherwise atomically cancel capture, clear affected card/hit/drop/
      drag evidence, publish a current-bounds noninteractive non-overlapping fallback, damage and observe it
      once, and retry only after a new external invalidation or revision—never through a self-invalidating loop.
- [ ] 2.1.4 Keep sparse index storage, source-range resolution, and correction work bounded by resident
      descriptors plus configured overscan; never enumerate an unknown or 100,000-card logical cell.
- [ ] 2.1.5 Preserve vertical card identity and relative row across wheel, resize, source publication, and
      measured-height correction without allowing a stale anchor to reorder the stack.
- [ ] 2.1.6 Align clipping, content extent, hit maps, drop maps, and drag source/target geometry to the one
      final authoritative height projection selected for the frame.
- [ ] 2.1.7 Run Phase 1 geometry specifications until green, then add implementation cases for bootstrap and
      measured source ranges at non-zero offsets, estimate transitions, newly resident tall cards, partially
      visible edges, compatible/incompatible fallback generations, revision invalidation, and repeated
      down/up scroll cycles.

## Phase 3: Make mouse interaction and repaint immediate

### Step 3.1: Pointer and overlay behavior

- [ ] 3.1.1 Route every normalized captured pointer move through one current geometry generation and
      update one compact framed title row from the exact pointer-relative grab offset, plus a bounded selected
      count when multiple, with no blank trailing row.
- [ ] 3.1.2 Recompute the active semantic slot only from valid gaps/edges and preserve one-cell hysteresis
      without allowing a marker to settle inside a card body.
- [ ] 3.1.3 Ensure click, drag start, each captured pointer move, target change, autoscroll tick, cancel, and
      release publish their complete visible result before the owning dispatch/tick returns, with no explicit
      flush or asynchronous data dependency.
- [ ] 3.1.4 Make focus/selection semantic damage minimal and make scroll/drag damage include every old/new
      affected region exactly once, leaving no stale cells or unrelated bottom fragments. Separately assert
      visible-set-bounded Kanban leaf composition and final changed-cell/run/byte output; do not claim the
      semantic rectangles are consumed as Core/UI region-clipping inputs.
- [ ] 3.1.5 Verify capture loss, outside release, resize cancellation, source change, Escape, modal entry,
      disposal, and immediate next drag remain deterministic after the geometry repair.

### Step 3.2: Host evidence

- [ ] 3.2.1 Extend the existing semantic-host board and drag transport harnesses with real Unix PTY and
      browser/xterm traces for click, wheel, grab, individually observed pointer moves, gap transition, drop,
      and post-drop redraw using the mixed-height fixture.
- [ ] 3.2.2 Keep platform-scoped ConPTY-equivalent evidence aligned with the same semantic outcomes; report
      an unavailable host honestly rather than substituting a pipe test.
- [ ] 3.2.3 Run focused pointer, rendering, damage, capture, and host suites and correct all regressions.

## Phase 4: Prove the responsiveness budget

### Step 4.1: Deterministic bounds

- [ ] 4.1.1 Preserve the existing exported `KanbanViewportScaleSnapshot` shape. Add a separate additive
      testing-only viewport operation/work-delta snapshot for resident descriptors, height measurements,
      projection passes, hit/drop regions, semantic damage cells, bounded draw work, and drag-target
      recomputations; retain source reads/ranges in `windowed-fixture`; and collect changed cells/runs/bytes
      for the `RenderRoot` and second host diff in a dedicated mounted frame/host fixture over real before/
      after buffers and actual fake-sink serialization. Extend existing exports/result shapes only additively,
      and make no Core/UI production instrumentation or public API change. Define operation deltas from
      monotonic before/after counters, correlate the evidence by fixture operation ID, distinguish composed
      changed cells, serialized runs, and UTF-8 output bytes, and unregister the additional reader on disposal.
- [ ] 4.1.2 Assert steady click, wheel, pointer move, and drag-target changes are proportional to visible
      descriptors plus finite overscan for the 84-card reproduction fixture.
- [ ] 4.1.3 Re-run the existing 5,000 eager-card and 100,000 logical-card fixtures with variable heights and
      prove no visible operation performs a full logical-card scan.
- [ ] 4.1.4 Add an explicit regression guard against accidental per-cell repeated filtering of the full
      visible projection where an indexed resident grouping can be reused.

### Step 4.2: Controlled timing

- [ ] 4.2.1 Add `packages/kanban/test/perf-kanban-bench.spec.test.ts`, a deliberate Kanban performance
      test that builds the deterministic 80×24 mixed-height
      fixture outside timed regions, discards 20 warmups, records 200 samples, consumes output through a
      fake sink, and reports CPU/runtime/date, source mode, visible counts, descriptor mix, capabilities,
      terminal harness, and iteration metadata.
- [ ] 4.2.2 Measure two layers separately: steady invalidation through Kanban projection/draw, and one
      normalized captured pointer sample through synchronous EventLoop dispatch, overlay projection,
      `RenderRoot` compose/diff, and the in-memory host diff. Exclude terminal I/O. Assert each local median
      at or below 16 ms and report each p95 against 33 ms without enforcing machine timing in shared CI.
- [ ] 4.2.3 Register the Kanban benchmark in `scripts/check-performance.mjs`, update
      `packages/examples/test/perf-gate.spec.test.ts` to assert its exact package/path/serial inventory, run
      that contract test, and run
      `yarn workspace @jsvision/kanban test test/perf-kanban-bench.spec.test.ts --maxWorkers=1`. Register the
      exact tuple `['workspace', '@jsvision/kanban', 'test', 'test/perf-kanban-bench.spec.test.ts',
      '--maxWorkers=1']`.

## Phase 5: Restore showcase quality

### Step 5.1: Reactive visual system

- [ ] 5.1.1 Supply the GitHub board with a reactive `KanbanTheme` derived from the current application
      theme so every theme-menu choice updates board surfaces, cards, focus, labels, and drag overlays.
- [ ] 5.1.2 Implement AR-45's four generic `card.accent-1`…`card.accent-4` roles as an additive public theme
      capability. Preserve source compatibility for existing complete `KanbanTheme` literals by making accent
      tokens optional at the caller-input boundary; `createKanbanTheme` supplies all four, while resolution of
      a missing accent deterministically falls back to `card.normal` and records the fallback. Retain
      `contractVersion: 1` and do not require existing callers to add fields. Preserve the accent surface while
      focused/selected states add border/title/attribute/non-color cues. Map GitHub statuses deliberately into
      these families, preserve every exact status through bounded text/glyph/attribute cues, and verify
      truecolor, 256, 16, mono, `NO_COLOR`, Unicode, and ASCII behavior. Never repurpose read-only, WIP,
      operation, warning, or error roles as arbitrary status colors.
- [ ] 5.1.3 Present title, status, type, labels, assignees, repository, and item reference in a clear bounded
      priority order; ellipsize by terminal display cells and degrade optional rows before core identity.
- [ ] 5.1.4 Tune card density, lane width, spacing, and instructions at 80×24 so several cards remain visible
      without making the board feel empty, while keeping focused-card affordances and drag gaps obvious.

### Step 5.2: Application interaction

- [ ] 5.2.1 Prove local accepted moves update source order and column immediately, reconcile once, remain
      draggable afterward, and never write to GitHub.
- [ ] 5.2.2 Keep URL loading, refresh, cancellation, error dialogs, theme menu, activity feedback, resize,
      maximize/restore, and local-board disposal responsive while a board is mounted. Enforce these app-local
      ceilings: 100 pages, 100 collection members per page, 10,000 total project items, 256 fields, 256 status
      options, 64 labels and 64 assignees per card, 16 KiB generated URL, 4 MiB per response body, and 32 MiB
      cumulatively per load. Extend the application-local transport with a byte-bounded streamed text/body
      read; validate `Content-Length` when present and enforce actual decoded UTF-8 bytes incrementally when
      it is absent, invalid, under-reported, or chunked, before `JSON.parse`. Cancel the reader and reject with
      `GitHubProjectLoadError` on overflow, and count cumulative bytes across the complete load. Validate each
      page before spreading and totals before append; reject oversized authoritative collections. Bound
      optional metadata only when omission is represented truthfully.
- [ ] 5.2.3 Expand focused application specifications to cover the deterministic injected 84-card fixture,
      oversized/malformed response arrays and pagination, declared and undeclared oversized bodies, false
      and under-reported `Content-Length`, chunked over-limit bodies, exact boundary and multi-byte UTF-8
      values, cumulative cross-request overflow, theme/capability changes, rich/adversarial cards, scroll
      stability, per-event drag/drop, and responsive layouts. Keep live GitHub network access outside
      automated oracles.

## Phase 6: Closure and user acceptance

- [ ] 6.1 Run `yarn workspace @jsvision/kanban typecheck`, focused/new Kanban specification and
      implementation tests, and
      `yarn workspace @jsvision/kanban test test/perf-kanban-bench.spec.test.ts --maxWorkers=1`.
- [ ] 6.2 Run `yarn workspace @jsvision/kanban test` and `yarn workspace @jsvision/kanban test:e2e`.
- [ ] 6.3 Run `yarn workspace @jsvision/kanban check:deps` and
      `yarn workspace @jsvision/kanban check:docs`.
- [ ] 6.4 Run `yarn workspace @jsvision/examples typecheck`, focused deterministic GitHub/Kanban showcase
      tests, and `yarn workspace @jsvision/examples test test/perf-gate.spec.test.ts --maxWorkers=1`.
- [ ] 6.5 Review every mapped plugin-impact reference, run `yarn plugin:update`, inspect generated changes,
      and run `yarn plugin:check`.
- [ ] 6.6 Run exact `yarn perf:check`, then `yarn verify:local`; CI remains authoritative for full
      `yarn verify`. Record an honest skip instead of timing evidence when the environment declares
      `CI` or `TUI_SKIP_PERF`; T-03 still requires one actionable controlled local result before closure.
- [ ] 6.7 Load the live Node.js project only for the native-terminal manual matrix and record the app
      command, project URL and observation time, OS/CPU/runtime, terminal/host/version/capabilities, viewport
      sizes, complete theme inventory, and expected/actual outcome for click, wheel down/up, horizontal
      scroll, grab, per-event ghost tracking, slot changes, invalid/outside cancel, valid drop, second drag,
      resize cancellation/fresh drag, maximize/restore, and every supplied theme.
- [ ] 6.8 Present the corrected app to the user for the mandatory interaction acceptance gate; resume the
      regular roadmap only after explicit approval.

## Verification summary

| Gate | Required evidence |
|---|---|
| Correctness | Mixed-height geometry, semantic damage, dispatch-return pointer, and local-move specifications green |
| Scale | Resident-only source/projection/composition/output counts green at 84, 5,000 eager, and 100,000 logical cards |
| Timing | 20 warmups + 200 samples; projection/draw and event→both in-memory diffs each median ≤16 ms; p95 reported against 33 ms |
| Hosts | Browser/xterm plus real Unix PTY; platform-scoped ConPTY-equivalent outcome |
| Showcase | Responsive theme-rich GitHub app tests and manual native-terminal review |
| Repository | Package gates, examples typecheck/tests, exact runner contract, `yarn perf:check`, plugin update/check, and `yarn verify:local` green |

## Completion rule

T-03 is complete only when all 46 tasks are checked, every automated gate passes, no unresolved geometry
or input-sequencing defect remains, and the user explicitly accepts the real-terminal interaction. A
visually attractive demo alone cannot close this task.
