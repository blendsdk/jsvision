# Current State: Kanban Phase D Productivity and Editing

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing implementation

### What exists

- `KanbanQuery` already carries bounded search, registered filters, one grouping field, ordered sorts,
  visible column/swimlane IDs, and a view revision. Validation snapshots exact shapes.
- Eager sources already execute registered search/filter/group/sort functions; remote/windowed sources
  receive the same semantic query and own equivalent execution.
- Query replacement is generation-safe but currently disposes the active session before opening its
  replacement; Phase D must make this transactional to preserve a usable projection on failure.
  Board/viewport rendering is sparse, damage-aware, responsive, and independently stabilized.
- Honest total/matching/loaded/visible/selected/WIP count contracts exist.
- Card-create/update, structure, saved-view-store, extension, confirmation, publication, and history
  request primitives already converge on one board authority coordinator.
- `@jsvision/forms` supplies reactive typed forms, async validation generation control, submit sealing,
  and modal integration. UI supplies DSL layout, scrollers, dialogs, measured buttons, confirmations,
  commands, keymaps, status/menu seams, and capture-safe pointer input.
- `@jsvision/examples` is a private TypeScript runtime workspace with typecheck, unit/E2E, and runnable
  demo scripts but no distributable build script; example completion therefore uses typecheck plus
  import/smoke and behavior tests rather than claiming a nonexistent artifact build.
- Kanban already ships ten locale subpaths, semantic theme roles, a permanent standalone showcase,
  GitHub-project demo, testing fixtures, package docs, architecture docs, and plugin impact mapping.

### Relevant files and planned treatment

| Current file | Purpose | Phase D treatment |
|---|---|---|
| `src/source/types.ts`, `validation.ts`, `eager-index.ts` | Query and registered eager execution | Reuse; extend registries/diagnostics only where RD-09 requires |
| `src/board/kanban-board.ts` | DSL shell, interaction, authority | Keep composition owner; extract new binders instead of growing monolithically (AR-D03) |
| `src/board/kanban-viewport.ts` | 2,691-line exact-cell projection leaf | Do not add view/editor/command ownership; consume derived snapshots only |
| `src/contract/semantic-query.ts` | Bounded semantic values and canonical form | Reuse for saved-view JSON and extension validation (AR-D04/D13) |
| `src/contract/request*.ts` | Standard proposal/envelope validation | Reuse and add focused public builders, not a second dispatcher |
| `src/operation/coordinator.ts` | Async operation authority | Reuse for editor/config/history submissions and event derivation |
| `src/interaction/facade.ts` | Stable board interaction path | Bind actions to it through one router (AR-D09) |
| `src/i18n/`, `src/locales/`, `card/theme.ts` | Current vocabulary/roles | Add only Phase D messages and truthful UI roles |
| `packages/forms/src/form-dialog.ts` | Basic Forms modal bridge | Compose or extend through public APIs; no private imports |
| `packages/ui/src/event/` | Command/keymap/capture routing | Reuse public command/keymap seams; change UI only if a proven prerequisite is missing |
| `packages/examples/kanban-showcase/` | Permanent demo shell | Add focused Phase D stories and preserve current performance/drag behavior |

## Gaps

| Gap | Current behavior | Required correction |
|---|---|---|
| View ownership | Applications hand-author query getters | Public controller, registries, pure transitions, optional chrome, and atomic reconciliation |
| Saved views | Request variants exist, no schema/codec | Validated v1 envelope, canonical codec, migrations, reconciliation, capture/apply |
| Card editing | Read-only preview emits open action only | Generic schema/session plus standard create/view/edit dialogs and custom replacement |
| Structure configuration | Proposals exist, no public builders/dialogs | Validated builders, responsive dialogs, deletion/reassignment policies |
| Commands/capabilities | Interaction commands are internal and capabilities cover extensions only | Stable public actions, conflicts, standard capability provider, read-only preset, help/status |
| Events/history | Diagnostics and operation snapshots exist | Public ordered events and application availability/fresh history requests |
| Demonstration | Current examples stop at modern interaction | Phase D productivity/editing stories using public APIs |

## Dependencies

### Internal

- RD-09 consumes completed query/session, structure, selection reconciliation, and request seams.
- RD-10 consumes card presentation, Forms/UI public APIs, and request lifecycle.
- RD-11 consumes RD-09 view state, RD-10 form lifecycle, and structure request variants.
- RD-12 consumes RD-09 view transitions, RD-11 actions, existing interaction facade, and authority.

### External package surface

- Add `@jsvision/forms` as a workspace runtime dependency and `zod:^4` as a peer/dev dependency for
  the standard editor adapter (AR-D05).
- No network, database, persistence, authorization, clipboard, filesystem, or rich-text dependency.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| View typing causes session churn/reflow | Medium | High | 150 ms scheduler, generation cancellation, atomic snapshots, focused perf oracles (AR-D12) |
| Saved state accepts hostile/deep data | Medium | High | Exact allowlists, global byte/depth/count limits, inert registries, fuzz/property tests (AR-D04/D13) |
| Dialog async work overwrites newer records | Medium | High | Base revision, generation, AbortSignal, stale gate, retained draft, authoritative publication |
| New command route bypasses authority | Low | Critical | One router and existing coordinator; origin-parity ST cases (AR-D08–D11) |
| Board/viewport files grow beyond maintainability | High | High | New concern folders and small board binders; no Phase D logic in viewport hot path |
| Forms/Zod dependency leaks into generic types | Medium | Medium | Separate generic protocol modules and type-level consumer fixtures (AR-D05) |
| Event subscriber blocks or leaks data | Medium | High | Bounded snapshots, exception isolation, redaction, reentrancy guard, disposal tests |
| Showcase regresses drag/scroll responsiveness | Medium | High | Existing stabilization suites plus Phase D mounted/manual matrix before completion |
| Failed query candidate destroys the usable session | Medium | Critical | Stage through first valid publication, swap atomically, dispose candidate on failure (AR-D17) |
| Host Meta/pointer semantics are lost before Kanban | High on macOS Web | High | Additive Core Primary and Web DOM pointer/dedupe prerequisite (AR-D20) |
