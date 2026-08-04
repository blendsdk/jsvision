# Input and Integration: Kanban Phase B Core Board

> **Document**: 03-06-input-integration.md
> **Parent**: [Index](00-index.md)

## Overview

This specification owns mounted keyboard/pointer event routing, semantic intent delivery, responsive
board chrome, lifecycle ordering, i18n/theme activation, public exports, documentation, and plugin
closure. It wires the pure models without importing later dialog/drag/command systems
(PAR-B01/PAR-B18/PAR-B21).

## Mounted input router

`KanbanViewport.onEvent` delegates to a package-private router after wheel handling. The router reads
the final active hit map and current interaction snapshot, then synchronously accepts or rejects one
typed facade transition. Current Core/UI events preserve Ctrl/Alt/Shift but not Meta/Command, so Phase B
handles only the deliverable closed subset:

- arrows, Home/End, PageUp/PageDown navigation, plus programmatic board-edge navigation;
- Space toggle, Shift+navigation cell-local range, and Ctrl+A loaded-visible-matching select-all where
  Ctrl is the host's Primary equivalent;
- Enter activation and Escape layered cancellation/selection clearing;
- primary down/up pending-press routing, right mouse input, and framework-provided down `clickCount` for
  matching-up double-click completion;
- focused-column navigator clicks/keyboard movement and capable header collapse.

RD-12 later supplies conflict-validated configurable keymaps and formal command routing. Phase B uses
the already-approved default gestures directly only for this closed subset and exposes programmatic
facade transitions for all selection/navigation operations. Command-click, Command+A, and Command+Home/
End on macOS browser hosts remain explicitly open until RD-12 preserves and normalizes Meta through the
Core/Web event pipeline; Ctrl-only evidence cannot close those criteria. No create, move/grab, undo,
search-focus, configuration, or destructive binding becomes active (PAR-B01/PAR-B18).

Input is ignored when the board is disposed, minimum geometry makes the target unavailable, the target
is clipped/non-actionable, or capability/read-only state disables the operation. Because `onEvent` is
synchronous, “accepted” means the facade recognized an enabled gesture against a current target and
queued its transition; the event is marked handled immediately. Async acquisition/settlement then runs
behind generation checks. Rejected or unknown gestures remain unhandled for outer application routing.

## Intent delivery

After the controller commits the required focus/selection transition, the board facade constructs the
immutable intent specified in 03-01 and invokes `onInteraction` exactly once. Descriptor action targets
carry the validated action ID; checklist preview maps to the standard editor action. Right-click intent
always names the newly focused/eligible selection, never a prior card. Handler failure emits one safe
observation and leaves interaction state committed (PAR-B08/PAR-B16).

Programmatic `activate`, `openContext`, `invokeScopedAction`, and navigation/selection facade transitions
follow the same serialization, settlement, intent-once, and capability checks. Controllers return
transition results and never invoke handlers themselves. The raw application mutation dispatcher is
never invoked by these intents.

## Responsive board composition

`KanbanBoard` continues to use DSL `col` composition around the growing viewport. Phase B may add
conditional one-row selection/feedback/help status only when required by active feedback; it does not
reserve a permanent toolbar. The focused-column navigator becomes actionable through a small DSL child
view and remains removed outside focused-column mode. All ordinary chrome uses measured localized text,
padding, and conditional layout; exact rectangles stay inside the viewport leaf (PAR-B19/PAR-B22).

Hosting remains identical on a surface or inside an application-owned window. The component creates no
window/shadow/dialog. Resize/maximize/restore reruns DSL layout, scene geometry, sparse anchor correction,
and focus reconciliation without remounting data resources.

## Lifecycle and concurrency

The stable facade exists at construction and rejects pre-mount target-dependent transitions as
unavailable. Mount order is source/session → scene/environment services → default or factory controller
→ controller/scene subscriptions → input availability, so a factory never receives a half-formed
environment. Each acquired resource registers rollback before application factory/controller code runs;
any setup failure follows the atomic fail-closed contract in 03-05. Disposal order is input rejection →
transient/pending cancellation → facade/controller
subscriptions and owned controller → scene and descriptor/height caches → cursors/session → board
authority. Every release is idempotent and late async completion observes generation/disposed state. A
disposed board/controller cannot remount (PAR-B13/PAR-B16).

Reactive query, structure, presentation, renderer, i18n, theme, capability, and controller revision
changes are read under one board-owned effect boundary. Each retained descriptor additionally owns the
bounded card-local computation specified in 03-02; it is not a second board authority. Semantic no-op
snapshots do not trigger layout; card-local presentation changes invalidate only their descriptor/
damage region; structure/locale/presentation changes re-solve once and preserve stable anchors
(PAR-B15).

## i18n and theming

Every new visible Phase B label, reason, count qualifier, help/feedback message, state action, WIP/DoD
cue, checklist cue, and swimlane presentation term is added to the typed English catalog, all nine
non-English catalogs, placeholders, and review evidence in the first task that consumes it. Generator
wrappers, official registry, literal ownership, and digest-bound review evidence remain atomic. Phase 6
performs final generation/parity closure rather than deferring vocabulary needed by earlier green gates.
Missing/invalid application labels use English-safe package fallbacks; translated text participates in
measurement (PAR-B22).

Phase B activates/adds semantic roles for workflow policy, swimlane variants, checklist progress/items,
metadata/summaries, range anchor, navigation pending/error, and actionable headers. Resolution retains
Core fallback chains, capability depth, monochrome/`NO_COLOR`, and ASCII cues. RD-13 still owns final
contrast/accessibility matrix completion (PAR-B22/PAR-B25).

## Public and package integration

- Export every durable Phase B contract/helper from the main barrel with junior-readable JSDoc and
  practical `@example`; keep internal scene/controller implementations private.
- Extend `@jsvision/kanban/testing` with deterministic scene, height-index, interaction, fake-clock,
  event-host, and semantic-frame fixtures; production imports remain independent.
- Preserve `sideEffects: false`, current runtime dependency graph, ten locale subpaths, package exports,
  and packed offline NodeNext runtime/type/private-path proof (PAR-B20/PAR-B21).
- For every task that changes a path mapped by `tools/jsvision-plugin-impact.json`, review each reported
  canonical skill/API reference, run `yarn plugin:update`, inspect generated output, and require
  `yarn plugin:check` before that task's auto-commit; record a no-op when output is unchanged. Phase 6
  performs final parity closure (PAR-B24).

## Documentation boundary

Update package README/changelog and technical architecture/API/security/data-model/decision indexes for
the implemented core board and honest later-phase boundary. Update generated API coverage. Do not create
a placeholder component page, `template1` lab, kitchen sink story, or showcase; RD-15/Phase F owns those
complete teaching surfaces (PAR-B23).

## Verification boundary

Each implementation phase runs the smallest owning Kanban unit/spec/E2E/type/build/docs/dependency gate,
then `yarn verify:local` before a task is verified/committed. Mapped SDK work runs plugin update/check in
the same change. Final closure runs all Kanban package gates, authentic packed consumer, focused i18n/docs/
API/plugin checks, docs build when technical/generated docs change, and `yarn verify:local`. CI owns full
root `yarn verify` (PAR-B24).

## Testing requirements

- Authentic event-loop keyboard/mouse routes, click counts, right-click focus, handler once/failure,
  unhandled-key propagation, read-only/capability gates, and disposed input.
- Surface/window/focused-column/minimum geometry, resize/maximize/restore, theme/locale replacement,
  long translations, Unicode/ASCII/mono/`NO_COLOR`, and lifecycle leak/cancellation.
- Public type/barrel/private-path, production/testing dependency isolation, packed package, locale,
  API generation, docs link/build, and plugin parity evidence.
