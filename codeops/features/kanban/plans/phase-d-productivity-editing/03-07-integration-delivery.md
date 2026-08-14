# Integration and Delivery: Phase D

> **Document**: 03-07-integration-delivery.md
> **Parent**: [Index](00-index.md)

## Board composition

`KanbanBoard` remains the lifecycle/DSL composition owner and `KanbanViewport` remains the exact-cell
projection. New small binders connect an optional view controller/bar, editor/config invokers, action
router, event hub, and history provider to the existing interaction facade and authority. Legacy query
getter construction remains supported and mounts no new chrome or state owner. When a controller is
present, one board-view binder composes all effective view-owned getters with controller precedence;
otherwise every legacy getter retains its prior behavior (AR-D03/D14/D22).

Ordinary composition uses DSL flow/grow/fixed/conditional layout. Raw absolute geometry is limited to
existing virtualized viewport/hit/overlay work and framework dialog internals. Dialogs and view chrome
preserve one-cell content insets, responsive resize, scroll reachability, focus identity, mouse targets,
and keyboard parity (AR-D07).

## I18n, theme, and accessibility

Add closed message keys for search/filter/sort/views, fields/validation/stale/dirty, column/swimlane
configuration/deletion, commands/help/capability reasons, events/history feedback, and confirmations.
English is canonical; all ten locale modules remain type-compatible and use reviewed fallback until
Phase E's complete native-language review.

Add semantic theme roles only where existing roles cannot truthfully represent Phase D controls/states.
All focus, disabled, hidden, pending, error, stale, destructive, and selected states have non-color cues,
ASCII-safe glyphs, high-contrast fallbacks, and keyboard reachability. Phase E owns final cross-theme/
locale/accessibility certification (AR-D02).

## Examples

The permanent Kanban kitchen sink gains focused stories for:

1. Search, two active quick filters, sort/group, honest counts, filtered-empty Clear Filters, and view capture/apply.
2. Mainstream standard-card create/view/edit with checklist, validation, rejection, stale reload, and custom field.
3. Programmatic and dialog column/swimlane configuration including safe delete/reassign.
4. Keyboard/mouse/menu action parity, read-only mode, custom key binding, event trace, and history feedback.

The GitHub-project showcase gains colorful movable cards plus responsive view chrome, quick filters,
theme switching, card view/edit play mode, and local-only saved views without remote mutation. Existing
drag/scroll/window-resize responsiveness and no-freeze acceptance remain regression gates. Example data
is deterministic after load and all application mutations remain local/play-only.

## Documentation and plugin impact

- Update public JSDoc with junior-readable rationale and `@example` where practical.
- Update package README current boundary/usage and `docs/architecture/{kanban,api-design,data-model,security}.md`.
- For every commit touching a mapped SDK path, run source-impact review, `yarn plugin:update`, inspect
  every reported reference, and run `yarn plugin:check`; repeat as an aggregate Phase D closure gate.
- Do not create the final docs-site component course or claim RD-15 complete in this phase.

## Phase closure matrix

| Area | Commands |
|---|---|
| Kanban | `yarn workspace @jsvision/kanban typecheck`, `test`, `test:e2e`, `build`, `check:deps`, `check:docs` |
| Forms/UI/Core/Web prerequisite changes | Smallest affected workspace typecheck/test/build gates |
| Dist consumers | Run `yarn workspace @jsvision/kanban build` immediately before packed-consumer or Examples checks |
| Examples | `yarn workspace @jsvision/examples typecheck`, `test`, `test:e2e`, and focused demo import/smoke tests; this private runtime workspace has no build artifact script |
| Docs/architecture | Focused link/docs checks for changed surfaces |
| Plugin | `yarn plugin:update`, inspect impact output, `yarn plugin:check` |
| Repository | `yarn verify:local`; CI owns full `yarn verify` (AR-D16) |

Every verification run is captured per the exec-plan protocol. Native manual acceptance covers 80×24,
narrow/wide resize, direct surface and Window hosting, multiple themes, mouse/keyboard dialogs, search
typing latency, repeated drag/drop after view changes, and cleanup. No completion claim is made while
input freezes, scroll jumps, stale drafts overwrite, visual artifacts bleed, or examples fail checks.

The automated fixture uses 2,000 cards across 8 columns/4 swimlanes with 10 registered filters, 20
discarded warmups, and 200 measured iterations. Fake time advances the 150 ms debounce exactly. Each
commit permits one candidate query open, one session activation, at most one layout reflow, at most two
render invalidations, exactly one delivery per subscriber, and zero full-scene invalidations. Controlled
median post-debounce work must be ≤16 ms; p95 remains diagnostic where scheduling would be flaky.

## Quality lenses

Data-and-migration lens applies to saved views. Add-on review lenses are security, performance,
API-surface, and concurrency because the phase processes hostile durable JSON, expands a public SDK,
adds async editor/event lifecycles, and runs in an input-sensitive render loop (AR-D04–D15).
