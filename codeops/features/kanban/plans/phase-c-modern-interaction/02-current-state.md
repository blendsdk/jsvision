# Current State: Kanban Phase C Modern Interaction

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What exists

Phase A/B publish a responsive DSL-composed `KanbanBoard<TCard>` around one exact-cell viewport, eager
and revisioned windowed source sessions, stable placement anchors/tokens, workflow eligibility helpers,
rich cards, optional swimlanes, variable-height scene geometry, focus/navigation/selection, bounded click
routing, semantic intents, theme/i18n fallbacks, damage tracking, testing instrumentation, and validated
extension-only request dispatch helpers.

The board already has the right ownership direction: records stay in the source, interaction owns only
identity snapshots, and request authority validates data before application code. Phase C extends these
seams rather than introducing mutable cards, per-card views, numeric ranks, or an alternate callback
dispatcher (AR-C04–C06/C10/C12).

### Relevant files

| File | Current purpose | Phase C change |
|---|---|---|
| `packages/ui/src/event/event-loop.ts` | One nullable capture target; modal/unmount/disposal clear it silently | Central generation-bound capture transition, loss reasons/callback, host-loss ingress, compatibility wrappers (AR-C03) |
| `packages/ui/src/{event,view}/types.ts` | Public loop and per-dispatch capture trio | Add documented lease/loss types and acquisition seam without breaking existing calls (AR-C03) |
| `src/interaction/pointer-router.ts` | Pending click down/up; movement cancels and drag is explicitly absent | Preserve click behavior below threshold; hand threshold-crossing reports to drag controller |
| `src/layout/hit-map.ts` | Final clipped cards/headers/actions; insertion/drop targets explicitly absent | Keep action hits distinct and add pure semantic drop-map projection (AR-C07/C08) |
| `src/source/placement.ts`, `source/types.ts` | Validated start/end/between/window-edge/unavailable placement | Reuse as authoritative placement input; add proposal snapshots without numeric authority |
| `src/contract/request.ts` | Extension-only request union and basic result/publication shapes | Add standard card/column/swimlane/saved-view variants, semantic move payloads, undo metadata, lifecycle observations (AR-C10/C14) |
| `src/contract/authority.ts` | Exact validation, safe dispatch, stateless publication reconciliation | Split validators by variant and feed one stateful board operation coordinator (AR-C04/C10–C13) |
| `src/board/board-authority.ts` | Board-owned extension dispatcher and pending expectation adapter | Become the semantic operation coordinator used by every producer (AR-C04) |
| `src/board/kanban-viewport.ts` | 1,696-line source/layout/render/input lifecycle owner | Compose extracted drag/target/autoscroll/overlay modules; do not absorb operation state (AR-C16) |
| `src/board/viewport-projector.ts` | 705-line canonical scene → geometry/card/action projection | Extract immutable overlay composition and keep geometry pure/bounded (AR-C04/C16) |
| `src/board/viewport-render.ts` | Cards, shadows, workflow/swimlane chrome | Draw ghost, placeholder, gap, pending and target states with theme/ASCII cues (AR-C05/C07/C19/C20) |
| `src/board/viewport-damage.ts` | Source/geometry/scroll-based damage | Union prior/current ghost, gap, pending and reflow regions without stale trails |
| `src/testing.ts`, `src/testing/instrumentation.ts` | Deterministic source/cache/event helpers | Add drag-frame, clock, request, lifecycle, and semantic trace fixtures (AR-C09/C17) |

## Gaps Identified

### Gap 1: Capture loss cannot notify an inert owner

The loop clears `captureTarget` on modal transitions, stale unmount detection, and disposal, while a view
can only poll `hasCapture` during a later event. That cannot satisfy synchronous cleanup when the board is
behind a modal or the host loses focus. SPEC-C-CAPTURE introduces a reusable generation lease before any
Kanban drag begins (03-01; AR-C03).

### Gap 2: Request contracts are deliberately only a foundation

`KanbanRequest` currently aliases only the extension variant. Validation and dispatch are robust but do
not understand card/structural moves, operation states, atomic bulk shapes, undo metadata, conflicting
entity locks, or retained operation IDs. The standard union and pure eligibility must precede pointer
release (03-02/03-03; AR-C06/C10–C14).

### Gap 3: No drag geometry or overlay exists

The hit map, pointer router, scene projector, and tests explicitly assert that insertion targets, capture,
threshold, ghost, gap, and drag-hover behavior are absent. Phase C adds a separate semantic drop map over
final clipped geometry and immutable overlays without contaminating the existing action-hit z-order
(03-04/03-05; AR-C04/C07/C08).

### Gap 4: Viewport and projector are already over the file ceiling

The viewport is 1,696 lines and the projector is 705 lines. Adding timers, capture, request state,
eligibility, pending overlays, and reconciliation inline would multiply responsibilities and make failure
ordering unreviewable. Extraction is a prerequisite, not cleanup after implementation (03-04–03-06;
AR-C04/C16).

### Gap 5: Real PTY/ConPTY evidence is absent

Existing host E2E intentionally uses advertised pipe streams, while RD-07 requires real Unix PTY and
platform-scoped Windows ConPTY evidence alongside browser/xterm. A dev-only native harness and explicit
CI/runtime guards are required; it must never become a package runtime dependency (03-06; AR-C17).

## Dependencies

### Internal dependencies

- UI event loop, dispatch, view mount lifecycle, modal transitions, reactivity, drawing, and deterministic
  event harnesses.
- Core terminal mouse/key decoding, text width/sanitization, glyph/color capabilities, and host events.
- Web xterm host normalization for browser semantic parity.
- Kanban source sessions/cursors, placement, scene/geometry, interaction facade, workflow policies,
  themes, locales, observations, limits, and package/testing subpaths.
- Completed Phase A/B public compatibility and immutable specification suites.

### External dependencies

- Proposed test-only `node-pty@^1.1.0`, `@xterm/headless@^6.0.0`, and workspace
  `@jsvision/web@1.5.2` under `packages/kanban/devDependencies` for Unix PTY/Windows ConPTY and the real
  public `createBrowserHost` browser-terminal path. Installation is a separate execution-time permission;
  none is imported by Kanban production code or included in the package runtime closure (AR-C17).
- The native child fixture is checked-in bounded `.mjs`, so the E2E harness does not rely on raw TypeScript
  execution or an undeclared runner. Designated Node 22 Ubuntu/macOS/Windows CI cells execute the host suite;
  Windows must run ConPTY assertions instead of accepting an unsupported skip.

## Domain lenses

| Lens | Why it applies | Required treatment |
|---|---|---|
| Distributed and concurrent | Async dispatcher outcomes, source publications, abort, generations, and unrelated concurrent work can interleave | Define ordering, exactly-once dispatch, conflict sets, late-outcome suppression, and deterministic clocks |
| Data and migration | Public request/result/capture APIs and extension compatibility must coexist with Phase A/B consumers | Preserve extension requests and legacy capture calls; add packed-consumer/API compatibility tests and no destructive migration |

Compiler/language, financial-system, and web-application lenses do not apply: this is a local UI SDK
component with no parser, money, HTTP/session, tenant, or persistent database authority.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Reentrant loss callback releases a replacement capture | Medium | High | Generation-scoped lease; one exception-contained replace/lose transition (AR-C03) |
| Captured ancestor unmounts without another input event | Medium | High | Permanent ViewHost pre-cleanup subtree notification; root/group/dynamic unmount paths converge without per-capture closures |
| Drag clears before pending projection is visible | Medium | High | Atomic `commitProposal` handoff and same-tick overlay composition (SPEC-C-HANDOFF) |
| Stale anchors/tokens dispatch after scroll or publication | High without checks | High | Revalidate scene/cursor/query/entity revisions immediately before dispatch (AR-C06/C13) |
| Bulk operation partially settles | Medium | High | Exact result validation rejects partial accepted identities; one entity conflict set (AR-C14) |
| Ghost/gap leaves stale terminal cells | Medium | High | Old/new overlay union damage plus settled-frame oracle |
| Autoscroll timer survives capture/modal/disposal | Medium | High | Single drag owner disposes timer before lease release; fake-clock lifecycle tests |
| Structural drag forks behavior | Medium | High | Shared capture/ghost/autoscroll/release primitives with type-specific target resolver only |
| Native PTY dependency breaks developer install | Medium | Medium | Explicit authorization/proof task, dev-only placement, stable version, platform-scoped tests, no runtime edge |
| Host E2E passes only through hoisting or skipped Windows evidence | Medium | High | Explicit owning dev dependencies, plain-JS child fixture, dedicated cross-OS Node 22 CI contract |
| Public union breaks extension consumers | Low with design | High | Retain extension discriminator and validation; packed type/runtime compatibility suite |
| Retained inverse closures grow or reenter stale state | Medium | High | Exact callback contexts/results, commit-only `retainedUndoDescriptors` FIFO, fresh validation, teardown clearing |
| Viewport complexity grows further | High without extraction | High | Extract before feature wiring and keep semantic lifecycle board-owned (AR-C04/C16) |
