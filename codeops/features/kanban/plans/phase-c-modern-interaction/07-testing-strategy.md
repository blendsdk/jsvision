# Testing Strategy: Kanban Phase C Modern Interaction

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Behavioral coverage goals

| Concern | Required evidence |
|---|---|
| Core gesture/placement/eligibility/operation logic | Every applicable ST oracle plus focused implementation, hostile-boundary, concurrency, and bounded-scale cases |
| UI capture and projection/controllers | Every loss/cancellation source, exact transition ordering, compatibility regressions, damage, and lifecycle cleanup |
| Rendering, host glue, docs/example wiring | Deterministic cell frames, direct/browser/native host traces, CI contract, locale/plugin/package closure, and real showcase behavior |

Specification tests are authored before each implementation phase and remain immutable oracles. Test names
state `should [expected behavior] when [condition]`. Real objects are preferred; only clocks, application
dispatchers, source windows, and host transports use deterministic seams (AR-C18).

### Oracle ownership by implementation phase

| Phase | Oracles that must be green at phase closure |
|---:|---|
| 1 | ST-C-CAP-01..04 |
| 2 | ST-C-REQ-01..12 |
| 3 | ST-C-REQ-13, ST-C-OP-01..12 |
| 4 | ST-C-CAP-05..09, ST-C-DRAG-02/03/05..12/14 |
| 5 | ST-C-DRAG-01/04/16, ST-C-INT-01..03 |
| 6 | ST-C-DRAG-13/15, ST-C-INT-05..07 |
| 7 | ST-C-INT-04/08..10 |

An oracle has one owning phase. Security and packed-consumer suites may provide supporting assertions, but
they do not create a second phase owner. Later-phase red specifications are not included in an earlier
phase’s green checkpoint.

## 🚨 Specification Test Cases

### UI capture and pointer threshold

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-C-CAP-01 | Acquire capture A, then acquire B in the same tick | A loses once with `replaced`; B remains active; A’s late `release()` cannot clear B | SPEC-C-CAPTURE; 03-01 §UI capture lease; AR-C03 |
| ST-C-CAP-02 | Active lease followed by modal open/close, captured target or ancestor subtree unmount with no later input, host loss, direct stop, and direct dispose | Each applicable fixture synchronously invalidates before user/scope teardown, calls once with the exact reason, and repeated capture/release retains no target/callback/cleanup registration | RD07-AC12; 03-01 §Loss sources; AR-C03 |
| ST-C-CAP-03 | Loss callback throws and reentrantly acquires a replacement | Failure is isolated; replacement capture remains valid; loop routing and paint continue | 03-01 §Internal transition/Error Handling; AR-C03/C20 |
| ST-C-CAP-04 | Existing Slider/ScrollBar/Desktop/Input drag fixtures use `setCapture/releaseCapture/hasCapture` | Existing semantic outcomes remain unchanged and no source migration is required | 03-01 §Compatibility; AR-C03 |
| ST-C-CAP-05 | Primary down and zero Manhattan movement followed by up | Existing click selection/activation behavior completes and zero move requests are created | RD07-AC01; 03-01 §Press compatibility |
| ST-C-CAP-06 | Default threshold one; pointer crosses from `(5,5)` to `(6,5)` | Exactly one captured drag begins for the initiating generation; click completion becomes unavailable | RD07-AC01; 03-01 §Threshold crossing |
| ST-C-CAP-07 | Threshold configured to 2; paths with distance 1 then 2 | Distance 1 remains pressed; distance 2 begins once using `abs(dx)+abs(dy)` | RD07 pointer state machine; 03-01 §Threshold crossing |
| ST-C-CAP-08 | Capture loss queues an old-generation pointer-up in the same frame | Cleanup completes once and queued up emits zero dispatcher calls and no overlay | RD07-AC12; SPEC-C-CAPTURE; AR-C03/C13 |
| ST-C-CAP-09 | Dispatch decoded `focus: false`, then a queued pointer-up; separately invoke explicit transport loss | Each path synchronously reports `host-lost` before ordinary routing, cancels once, and the queued up emits zero requests | RD07-AC12; 03-01 §Loss sources; AR-C03/C13 |

### Requests, placement, and eligibility

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-C-REQ-01 | Construct every card/column/swimlane/saved-view standard proposal, its coordinator envelope, and new/legacy extension paths | Each exact bounded value validates/freezes; standard lifecycle fields are coordinator-owned; legacy caller ID/signal remains unchanged; unknown discriminator or extra key rejects | RD08-AC01; 03-02 §Standard proposals; AR-C10 |
| ST-C-REQ-02 | Card move for ordered IDs `[4,2,7]` with sources, target, between anchors, operation/revisions | Dispatcher receives one request preserving order and every required semantic/revision field | RD08-AC02; 03-02 §Semantic move proposal |
| ST-C-REQ-03 | Same semantic anchors rendered at different scroll/filter visual indices | Captured proposal is identical and contains no authoritative numeric target index/rank | RD08-AC03; 03-02 §Semantic move proposal |
| ST-C-REQ-04 | Complete cursor start/end vs unknown window edge with and without current token | Complete edges dispatch; tokened window edge dispatches; unknown/tokenless edge is unavailable and emits zero calls | RD08-AC04; RD07-AC10; 03-02 §Semantic move proposal |
| ST-C-REQ-05 | Sorted view attempts within-cell reorder and cross-column move | Within-cell is blocked with reason; policy-allowed cross-column move can dispatch | RD08-AC05; 03-02 §Synchronous eligibility |
| ST-C-REQ-06 | Filtered visible neighbors are non-adjacent, first without resolver/token then with current token | First is blocked/unavailable; second produces one semantic request | RD08-AC06; 03-02 §Semantic move proposal |
| ST-C-REQ-07 | Four-card atomic request and application returns a partial accepted-ID shape | Result is rejected as malformed; all authoritative cards/projection settle together with no partial commit | RD08-AC07; 03-02 §Standard request union; 03-03 §Dispatcher settlement |
| ST-C-REQ-08 | Eligibility matrix covers missing structure, stale revision, disabled capability, sorted/filter policy, transition, WIP, DoD, no-op | First terminal stage returns the specified allowed/warning/blocked/unavailable code and never bypasses later application authorization | RD08 eligibility; 03-02 §Synchronous eligibility; AR-C06 |
| ST-C-REQ-09 | Preview allowed, but dispatcher returns authorization rejection | Rejection feedback is visible and capability is never treated as security authority | RD08-AC15; 03-02 §Synchronous eligibility |
| ST-C-REQ-10 | Classify allowed/warning and every destructive standard proposal | Pure policy marks confirmation-required kinds exactly; no confirmer or dispatcher is invoked in eligibility | RD08 should-have confirmation; 03-02 §Confirmation classification |
| ST-C-REQ-11 | Duplicate active/retained operation ID and stale placement token | Both reject before application dispatch and leave incumbent state unchanged | RD08-AC13; 03-02 §Operation ID factory/Error Handling |
| ST-C-REQ-12 | Hostile request values contain accessors/proxies/thenables, controls, excessive depth/size, raw card/token data | Boundary rejects/sanitizes without invoking unsafe getters/thenables or leaking rejected values | RD08 Security; 03-02/03-03 Error Handling; AR-C20 |
| ST-C-REQ-13 | Submit representative editor draft, board-configuration draft, saved-view, context-menu, pointer, keyboard, and programmatic proposals | Every fixture reaches the same coordinator/dispatcher seam exactly once and no fixture mutates source records; deferred UI is not constructed | RD08-AC01; 01 §Scope; 03-06 §Public facade |

### Operation lifecycle and concurrency

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-C-OP-01 | Valid pointer/keyboard/programmatic proposal enters coordinator | One operation progresses proposed→pending and one pending projection appears before asynchronous settlement | RD08-AC08; SPEC-C-HANDOFF/PARITY; 03-03 §Lifecycle model |
| ST-C-OP-02 | Dispatcher accepts without expectation; matching-looking source data publishes, then an exact correlated application notice arrives | State remains accepted/pending through uncorrelated publication and commits only on the exact notice; no universal matcher is inferred | RD08-AC09; 03-03 §Publication |
| ST-C-OP-03 | Accepted result supplies an expectation, followed by matching publication, explicit rejection, or contradictory publication | Matching commits/clears; rejection restores source; contradiction wins and reports superseded/conflict | RD08-AC10; 03-03 §Pending projection and publication |
| ST-C-OP-04 | Relevant moved card/target/anchor/policy changes before release; unrelated card publishes | Relevant change cancels drag with zero request; unrelated publication preserves it | RD08-AC11; RD07 release; 03-03 §Conflict rules |
| ST-C-OP-05 | Dispose/abort operation, then resolve dispatcher and prefetch promises | No late state, frame, observation, event, lock, or retained callback mutation occurs | RD08-AC12; 03-03 §Conflict/Error Handling |
| ST-C-OP-06 | Two unrelated operations and one overlapping operation | Unrelated operations run concurrently within limit; overlap is rejected before callback; no global lock | RD08 concurrency; 03-03 §Conflict rules; AR-C13 |
| ST-C-OP-07 | Pending-operation limit reached, then one more request arrives | New request rejects before ID retention/dispatch; no live operation is evicted | RD08 concurrency; 03-03 §Error Handling |
| ST-C-OP-08 | Accepted result carries undo token/inverse; invoke undo after current revisions change | Fresh operation ID/current revisions reach dispatcher; rejection leaves current data intact | RD08-AC14; 03-03 §Undo/redo seam |
| ST-C-OP-09 | Observe all lifecycle states with card body, placement/undo tokens, custom payload, raw error present in inputs | Observations contain only operation/entity IDs, kind/state, safe duration/error code/counts; sensitive values are absent | RD08-AC16; 03-03 §Observations; AR-C20 |
| ST-C-OP-10 | Application dispatcher throws, rejects, returns modified/cross-realm Promise/thenable, mismatched ID, malformed result | Each becomes safe rejection with no unhandled error or thenable invocation | RD08 request envelope/security; 03-03 §Dispatcher settlement |
| ST-C-OP-11 | Exact frozen confirmer context plus true/false, throw/reject, hostile promise/thenable/value, reentrant request/cancel/dispose, and stale settlement | Context exposes only bounded metadata plus live signal; only exact affirmative current settlement dispatches once after revalidation; every other path is safely terminal | RD08 confirmation; 03-03 §Application callback boundary |
| ST-C-OP-12 | Accepted result supplies exact token/builder undo variants; inverse output is hostile/oversized/reentrant/late; retained descriptor limit is exceeded then disposed | Shapes are mutually exclusive/exact; only whole committed descriptors are invocable; output re-enters full validation; FIFO evicts oldest without invocation/leak and disposal clears all | RD08 undo/security; 03-03 §Application callback boundary |

### Drag targets, reflow, and autoscroll

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-C-DRAG-01 | Start a card drag in a populated comfortable board | Frame has one bounded ghost, one source placeholder, at most one gap, and zero stale old cells after movement | RD07-AC02; 03-04 State machine; 03-05 Card composition |
| ST-C-DRAG-02 | Pointer overlaps full-width gutter and card half | Gutter wins and resolves exact between anchors; card-half fallback wins only outside gutter | RD07-AC03; 03-04 §Target kinds |
| ST-C-DRAG-03 | Pointer moves one cell inside current hysteresis band then crosses semantic boundary | First retains target; boundary crossing changes once without oscillation | RD07-AC04; 03-04 §Hysteresis |
| ST-C-DRAG-04 | Compact drag moves among several slots then cancels | Only active gap expands to one row, prior gap disappears, and cancellation removes all expansion | RD07-AC05; 03-04/03-05 compact composition |
| ST-C-DRAG-05 | Pointer is on swimlane header and then separate first gap below it | Header yields no card slot; first gap yields leading placement when eligible | RD07-AC06; 03-04 §Target kinds |
| ST-C-DRAG-06 | Empty complete writable cell vs empty unknown/blocked cell | Complete cell exposes large logical-start target; unknown/blocked cell is unavailable/blocked with zero release request | RD07-AC07; 03-04 §Target kinds |
| ST-C-DRAG-07 | Fake clock holds pointer in slow/fast zones and at corner/extents | Steps are 1/2 cells per 50 ms, both axes may move once per tick, extents clamp, leave/cancel/loss stops | RD07-AC08; 03-04 §Autoscroll |
| ST-C-DRAG-08 | Autoscroll reveals a different placement then pointer-up occurs without extra movement | Target is recomputed from new offsets and release dispatches newly visible placement only | RD07-AC09; 03-04 §Autoscroll |
| ST-C-DRAG-09 | Hover unknown window edge across repeated ticks, then publish current token/anchor | At most one bounded prefetch is active; target remains unavailable until current evidence, then becomes valid | RD07-AC10; 03-04 §Prefetch |
| ST-C-DRAG-10 | Pointer-up on valid, invalid, outside, stale, and unchanged-disallowed targets | Valid emits exactly one request; every other case emits zero and restores authoritative layout/focus | RD07-AC11; SPEC-C-HANDOFF |
| ST-C-DRAG-11 | Capture loss, Esc, modal, relevant source revision, disposal, and resize during drag | Each cancels synchronously, clears ghost/gap/timers/prefetch/hover/capture, and settles damage-free | RD07-AC12; 03-01/03-04 cancellation |
| ST-C-DRAG-12 | Drag unselected card; drag one card in a four-card selection | First proposal has one card; second has ordered four-card atomic block and bounded count ghost | RD07-AC13; 03-04 §Dragged set |
| ST-C-DRAG-13 | Drag/release columns and explicit swimlanes, including capability-blocked derived lane | Eligible structures use equivalent capture/ghost/placeholder/marker/autoscroll/one-request semantics; blocked lane emits zero | RD07-AC14; 03-04 §Structural drag |
| ST-C-DRAG-14 | Visible collapsed swimlane hover for 499/500 ms, leave, release, and hidden lane | Expands only at 500 ms, restores on all exits, never changes application state, hidden lane never reveals | RD07 should-have; 03-04 §Collapsed swimlanes |
| ST-C-DRAG-15 | Pointer, keyboard, and programmatic origin move same fixture | Semantic proposal/eligibility/dispatcher/pending/publication outcome is identical except origin metadata | RD07 overview; RD08-AC01; SPEC-C-PARITY |
| ST-C-DRAG-16 | ANSI/control title plus wide glyph boundary in ghost | Controls are neutralized, no half-wide glyph is emitted, viewport clip is respected, observation has no text payload | RD07-AC16; 03-05 §Theme/Error Handling; AR-C20 |

### Rendering, hosts, compatibility, and delivery

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-C-INT-01 | Render allowed/warning/invalid/unavailable/pending/rejected states in color/Unicode and ASCII/mono | Every state is distinguishable with non-color geometry/glyph/text and all text stays cell-safe | RD07 target states; 03-05 §Theme/I18n |
| ST-C-INT-02 | Move ghost without target change, then change target, cancel, reject, and supersede | Damage is bounded to old/new overlays/affected stack; settled authoritative frame is cell-equal with no trail | RD07-AC02/12; 03-05 §Damage tracking |
| ST-C-INT-03 | Direct surface/window drag across resize, maximize, restore, focused-column, and minimum geometry | Responsive state remains clipped/readable; resize during active drag cancels cleanly; later drag uses new geometry | RD07-AC12; 03-05/03-06 integration |
| ST-C-INT-04 | Replay standard semantic trace through direct loop, browser/xterm, real Unix PTY, and Windows ConPTY on its runner | Threshold/targets/autoscroll/cancellation/final proposal agree; raw byte differences are allowed and pipes are not labeled PTY | RD07-AC15; SPEC-C-HOST-EVIDENCE; AR-C17 |
| ST-C-INT-05 | Import old extension request and old UI capture APIs from packed tarballs, plus new standard request/lease APIs | Old consumers compile/run unchanged; new consumers resolve only public entry points; no testing/runtime dependency leaks | 03-01 §Compatibility; 03-02 union; AR-C03/C10/C17 |
| ST-C-INT-06 | Construct standalone viewport with no board dispatcher and attempt drag | Read/click behavior works; mutation drag is unavailable with safe localized reason and zero dispatcher calls | 03-06 §Board integration; AR-C04/C10 |
| ST-C-INT-07 | Mount setup fails at each coordinator/viewport/controller/input stage; dispose twice | Reverse rollback releases every acquired resource, never enables input early, and late work is inert | 03-06 §Ownership/mount order; AR-C13 |
| ST-C-INT-08 | Inspect main/testing export closure, runtime deps, JSDoc, locales, docs API, plugin snapshot, and kitchen sink | Production entry excludes testing/native modules; every public symbol/message/example is synchronized; showcase advertises only shipped behavior | 03-06 §Testing/Docs; AR-C17–C20 |
| ST-C-INT-09 | Inspect the CI workflow and execute the host runner contract on designated Node 22 OS fixtures | Ubuntu/macOS run real PTY evidence; Windows runs ConPTY evidence; none of the designated jobs can pass by skipping the platform assertion | RD07-AC15; 03-06 §Host verification |
| ST-C-INT-10 | Render and drive the permanent Examples Kanban showcase through warning, blocked, pending, rejected, publication, bulk, autoscroll, resize, and teardown fixtures | The real showcase visibly demonstrates only shipped behavior, remains responsive, and passes its owning Examples spec/typecheck | RD07 delivery evidence; 03-06 §Documentation and kitchen sink |

## Test Categories

### Specification tests

| Test file | ST cases covered | Component |
|---|---|---|
| `packages/ui/test/pointer-capture-lease.spec.test.ts` | ST-C-CAP-01..04 | UI capture lease |
| `packages/kanban/test/pointer-drag.spec.test.ts` | ST-C-CAP-05..09, ST-C-DRAG-02/03/05..12/14 | Card gesture/targets/autoscroll |
| `packages/kanban/test/requests-placement.spec.test.ts` | ST-C-REQ-01..12 | Request proposals/envelopes/placement/eligibility |
| `packages/kanban/test/operation-lifecycle.spec.test.ts` | ST-C-REQ-13, ST-C-OP-01..12 | Producer convergence/coordinator/publication/confirmation/undo |
| `packages/kanban/test/drag-rendering.spec.test.ts` | ST-C-DRAG-01/04/16, ST-C-INT-01..03 | Projection/theme/damage/responsive |
| `packages/kanban/test/phase-c-integration.spec.test.ts` | ST-C-DRAG-13/15, ST-C-INT-05..08 | Structure/facade/package/delivery |
| `packages/kanban/test/e2e/phase-c-hosts.e2e.test.ts` | ST-C-INT-04 plus host-execution portion of ST-C-INT-09 | Direct/browser/PTY/ConPTY semantic parity |
| `packages/kanban/test/host-ci-contract.spec.test.ts` | CI-workflow portion of ST-C-INT-09 | Designated OS/Node host-job contract |
| `packages/examples/test/kanban-showcase.smoke.spec.test.ts` | ST-C-INT-10 | Permanent interactive showcase |

`packages/kanban/test/security/phase-c-boundaries.spec.test.ts` supplies supporting hostile-boundary
assertions for ST-C-REQ-11/12, ST-C-OP-09..12, and ST-C-DRAG-16 without becoming a second phase owner.

### Implementation tests

| Test file | Description | Priority |
|---|---|---|
| `packages/ui/test/pointer-capture-lease.impl.test.ts` | Generation wrap, callback ordering, anonymous compatibility wrappers, unmount detection internals | High |
| `packages/kanban/test/drop-map.impl.test.ts` | Region sorting, clipping, semantic identity comparison, hysteresis boundaries | High |
| `packages/kanban/test/drag-controller.impl.test.ts` | Internal transition invariants, stale events, timer/prefetch ownership | High |
| `packages/kanban/test/operation-coordinator.impl.test.ts` | Subject-key encoding, queue/retention bounds, subscriber isolation, generation internals | High |
| `packages/kanban/test/drag-overlay.impl.test.ts` | Pure composition, region cap, partial residency, structural projection | High |
| `packages/kanban/test/phase-c-lifecycle.impl.test.ts` | Construction rollback, disposal order, weak ownership, no leaks | High |
| `packages/kanban/test/phase-c-scale.impl.test.ts` | Visible/overscan bounded work at 5,000 eager and 100,000 logical cards | Medium |

### Integration and E2E

| Scenario | Components | Expected result |
|---|---|---|
| Card drag to accepted publication | UI loop → viewport → coordinator → eager source publication | One request, pending overlay, committed only after publication |
| Windowed unknown-edge prefetch | cursor placement/prefetch → autoscroll/drop map → coordinator | Unavailable until current token, no guessed logical end |
| Multi-card/structural drag | selection/workflow → shared gesture → atomic dispatcher | One bounded request/projection and all-or-nothing settlement |
| Capture loss and modal | UI lease → drag cancellation → damage | Same-frame cleanup and no queued release |
| Native/browser host trace | decoder/host → UI loop → Kanban semantic trace | Equivalent semantic proposal across supported transports |
| Kitchen sink lifecycle | real example app → dispatcher controls → source publication | Visible warning/reject/pending/commit feedback and responsive interaction |

## Test data

- Eager and windowed boards with complete/unknown edges, sorted/filtered views, zero/one/many swimlanes,
  collapsed/hidden lanes, WIP/DoD/transitions, and stable revisions/tokens.
- Single, four-card, maximum-bounded, duplicate, stale, deleted, and partially resident selections.
- Compact/comfortable/spacious geometry at 12×3, 36×14, 80×24, and 100×30 in surface/window modes.
- English/Dutch/German long text, CJK/combining/wide glyphs, ANSI/control attacks, mono/ASCII capabilities.
- Deterministic exact-Promise dispatcher results for accept/reject/cancel/supersede, late settlement,
  conflict, malformed/hostile values, and fresh undo.

## Verification checklist

- [x] All 60 ST cases are implemented before their owning production phases.
- [x] Every ST case carries a plain-language in-code behavior comment, never a CodeOps ID/path.
- [x] Each spec-test phase is observed red for behavior not yet implemented, with justified pre-existing
  compatibility assertions allowed to pass.
- [x] Implementation makes immutable specification tests green without weakening expectations.
- [x] Implementation/security/integration/E2E tests cover internals and hostile boundaries.
- [x] UI and Kanban package gates, docs/plugin parity, `yarn verify:local`, and host-scoped evidence pass.
- [x] Runtime dependencies remain pure JS; native PTY support is test-only and absent from packed output.
