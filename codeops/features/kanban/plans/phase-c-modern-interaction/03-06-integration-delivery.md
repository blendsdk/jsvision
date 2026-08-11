# Integration and Delivery: Kanban Phase C Modern Interaction

> **Document**: 03-06-integration-delivery.md
> **Parent**: [Index](00-index.md)

## Overview

Phase C integrates capture, drag geometry, request authority, lifecycle projection, documentation, testing
and distribution without changing the application-owned data model or importing later dialogs/saved-view
UI. Board construction owns semantic operations; the viewport owns exact-cell interaction and drawing;
the stable interaction facade exposes pointer-independent parity (AR-C02/C04/C15/C19).

## Board and viewport integration

### Construction options

`KanbanBoardOptions<TCard>` retains `dispatcher` and adds:

- optional `operationId: () => KanbanOperationId`;
- optional typed `KanbanConfirmer` seam receiving the frozen `KanbanConfirmationContext`. The coordinator invokes it once after reservation and before
  dispatch for warnings and `card-archive`, `card-delete`, `column-delete`, `swimlane-delete`, and
  `saved-view-delete`; exact boolean/native-Promise handling, reentrancy protection, and post-settlement
  generation/revision/eligibility validation are mandatory;
- optional validated drag configuration limited to threshold and package-authorized timing/zone values;
- existing capabilities, observations, interaction handler, source, query, structure, presentation, theme,
  i18n, limits, and overscan seams remain authoritative in their current domains.

No separate move callback is added. A standalone `KanbanViewport` without a board may render/read and keep
click behavior, but mutation drag is unavailable because it lacks a board operation coordinator
(AR-C04/C10).

### Ownership and mount order

```text
construct board bindings + operation coordinator + stable interaction facade
    ↓
construct viewport with non-owning semantic operation adapter
    ↓
mount source/session/scene
    ↓
mount interaction controller and subscribe coordinator/viewport
    ↓
enable pointer/key input last
```

Rollback and disposal are cancellation-first:

```text
disable input
→ invalidate drag generation / stop timers / abort prefetch / release capture lease
→ unsubscribe viewport from operation snapshots
→ abort and dispose operation coordinator
→ dispose interaction facade/controller
→ dispose viewport source/session/cache
→ release DSL bindings/chrome
```

Late pointer reports, dispatcher settlements, source publications, and timers are inert after the owning
generation is invalidated (AR-C03/C13).

## Public interaction facade

The stable facade adds programmatic methods for card move, selected-block move, column reorder, swimlane
reorder, operation cancellation, and fresh undo/redo dispatch. Methods serialize with existing focus/
selection transitions, snapshot the current eligible selection after earlier queued work settles, and
return a typed operation result rather than `true` for application commit (AR-C04/C15).

The same public `board.request(proposal)` submission seam accepts every standard producer proposal.
Test-only adapters construct representative editor draft, board-configuration draft, saved-view, and
context-menu proposals and prove that each reaches the same coordinator/dispatcher without changing source
records. They are contract fixtures, not deferred RD-09–12 user interfaces.

Keyboard routing binds only a small documented Phase C move subset through current normalized key events
and semantic methods. It does not pre-empt text entry or claim the complete future configurable command
map. Escape preserves layered priority: active drag → active transient/pending action where cancellable →
selection clearing (AR-C02/C15).

## Testing subpath

`@jsvision/kanban/testing` exports deterministic, payload-free helpers:

- fake clock/scheduler for autoscroll and hover delay;
- drag-frame/overlay inspection and semantic drop-map snapshots;
- pointer trace builder/replayer independent of raw host bytes;
- dispatcher harness with deferred exact Promise settlement and call counts;
- operation/publication lifecycle harness and retained-ID/concurrency counters;
- PTY/browser fixture adapters that expose semantic trace, not raw card bodies/tokens.

Production entry points never import testing helpers (AR-C09/C17/C20).

## Host verification

### Direct and browser

The real UI loop receives decoded pointer sequences against direct surfaces and application-owned windows.
The Kanban E2E path uses dev-only workspace `@jsvision/web@1.5.2` and
`@xterm/headless@^6.0.0` to exercise the real public `createBrowserHost` path and verifies equivalent
semantic traces through drag tracking, resize, decoded focus-loss, and teardown. Raw browser DOM/terminal
events stay outside Kanban (AR-C17).

### Native PTY/ConPTY

After explicit dependency-install authorization, add stable `node-pty@^1.1.0`,
`@xterm/headless@^6.0.0`, and workspace `@jsvision/web@1.5.2` only to Kanban dev dependencies. A
checked-in bounded `.mjs` child fixture runs a real JSVision host without raw TypeScript execution, receives
SGR mouse bytes, renders bounded frames, and emits a sanitized semantic result. Unix assertions require an
actual PTY. Designated Node 22
Ubuntu/macOS/Windows CI cells run the focused host suite; Windows must execute ConPTY assertions rather than
passing through an unsupported skip. Other unsupported platforms report a scoped skip without claiming
evidence. The harness closes children, timers, streams, and PTY handles on success/failure (AR-C17/C20).

## Documentation and kitchen sink

- Update package README/CHANGELOG and architecture docs with request authority, semantic placement,
  capture, pending publication, keyboard/pointer parity, cancellation, and host limits.
- Add accurate public JSDoc and examples for every new type/method; never cite CodeOps artifacts in source.
- Update generated API/plugin references through `yarn plugin:update`; inspect mapped UI and Kanban skill
  references, then run `yarn plugin:check`.
- Extend `packages/examples/kanban-showcase/**` incrementally with deterministic movable cards,
  warning/blocked/unavailable targets, multi-card drag, autoscroll, reject/confirm/publication controls, and
  visible event feedback. Author the red behavior in
  `packages/examples/test/kanban-showcase.smoke.spec.test.ts` first, then implement the story/shell changes.
  It remains a truthful showcase of shipped behavior and does not claim RD-15 completion.
- A full `component-page-template1` course and additional live examples remain RD-15; any Phase C docs-site
  example touched in this phase must still satisfy the project’s `template1` directive (AR-C02/C19).

## Verification commands

Every task runs `yarn verify:local` plus its smallest focused gate. Phase closure runs:

```text
yarn workspace @jsvision/ui typecheck
yarn workspace @jsvision/ui test -- pointer-capture-lease.spec.test.ts pointer-capture-lease.impl.test.ts
yarn workspace @jsvision/kanban build
yarn workspace @jsvision/kanban typecheck
yarn workspace @jsvision/kanban test
yarn workspace @jsvision/kanban test:e2e
yarn workspace @jsvision/kanban check:deps
yarn workspace @jsvision/kanban check:docs
yarn workspace @jsvision/examples typecheck
yarn workspace @jsvision/examples test -- kanban-showcase.smoke.spec.test.ts
yarn workspace @jsvision/i18n test -- i18n-package-registration.spec.test.ts i18n-package-registration.impl.test.ts
yarn i18n:locales:update
yarn check:i18n-literals
yarn i18n:locales:check
yarn i18n:reviews:check
yarn docs:api
yarn plugin:update
yarn workspace @jsvision/docs-site typecheck
yarn workspace @jsvision/docs-site test:unit -- i18n-docs.impl.test.ts
yarn plugin:check
yarn verify:local
```

The dedicated Kanban host-E2E CI job in `.github/workflows/ci.yml` runs the same Kanban E2E command on
Node 22 Ubuntu, macOS, and Windows, with mandatory platform assertions on its designated runners. Focused
docs-site specs/build are added only when a docs live example/page changes; generated API/plugin-only
changes always retain the exact docs-site typecheck above. Full repository `yarn verify` remains CI-owned
per project guidance (AR-C18/C19).

## Error Handling

| Error case | Handling strategy | AR Ref |
|---|---|---|
| Board lacks dispatcher | Move operations unavailable with localized reason; read/click behavior continues | AR-C04/C10 |
| Setup fails after coordinator/viewport creation | Reverse-order rollback; no enabled input or retained callback | AR-C13 |
| Confirmation callback fails, reenters, or stales | Require exact boolean/native Promise; isolate failure, retain reservation, then revalidate generation/revisions/eligibility; no duplicate or stale dispatch | AR-C06/C13/C20 |
| Inverse builder returns hostile/late/reentrant output | Accept only direct proposal/exact native Promise, ignore late work, and pass output through complete fresh-proposal validation/confirmation; never invoke arbitrary thenables | AR-C12/C13/C20 |
| PTY dependency/install unavailable | Stop execution task for explicit user action; never substitute pipe evidence silently | AR-C17 |
| Designated Windows runner lacks/runs no ConPTY evidence | Fail the host-evidence job and Phase C closure; non-designated unsupported platforms may report scoped skip | AR-C17 |
| Plugin/generated docs drift | Regenerate from canonical sources and fail parity gate | AR-C19 |

## Testing Requirements

- Mount/setup rollback, replacement, dispose, remount rejection, late callback, and leak tests across board,
  viewport, capture, coordinator, source, facade, and timers.
- Packed consumer type/runtime/export-map tests for new and legacy request/capture APIs.
- Direct surface/window/browser/PTY/ConPTY semantic trace matrix.
- CI contract test proves the designated Node 22 Ubuntu/macOS/Windows host jobs invoke Kanban E2E and do
  not accept a ConPTY skip on Windows.
- Locale-generator contract and docs implementation tests prove multiple ordered overlay prefixes validate
  without duplicates and generate foundation + Phase B + Phase C wrapper/API exports before locale/review
  checks.
- Incremental kitchen-sink real example tests for visible states, pointer/keyboard interaction, responsive
  resize/maximize/restore, Classic theme, and clean teardown where docs-site is touched.
