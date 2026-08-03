# JSVision Kanban discovery notes

> **Feature**: `kanban`
> **Package**: `@jsvision/kanban`
> **Phase**: Phase 2 — scope confirmed; structuring and RD authoring
> **Last Updated**: 2026-08-03 18:30
> **Mode**: auto-design (`kanban-20260803-01`, policy version 1)

## Vision

Create a sophisticated terminal-native Kanban component in its own public package. The package is
an equal foundation for third-party JSVision applications and a future first-party Kanban
application. Discovery covers the complete long-term design; implementation may proceed in
independently verified phases.

## Selected domain lenses

| Lens | Evidence |
|---|---|
| Data and migration | Saved board-view state is a serialized public artifact whose schema and compatibility affect consumers across package releases. |

Universal CodeOps ambiguity, public-API, security, quality, accessibility, and verification
categories also apply. The web, distributed/concurrent, financial, and compiler/language lenses
do not currently apply: the component owns no HTTP/session surface, distributed authority,
financial values, grammar, or evaluator.

## Stakeholders

| Stakeholder | Key needs |
|---|---|
| SDK application developer | Typed generic APIs, stable identity, customization, lifecycle clarity, and test seams. |
| First-party Kanban application developer | Strong defaults, settings/editor dialogs, persistence adapters, and command integration. |
| Board end user | Fast navigation, readable cards, predictable moves, feedback, and recovery. |
| Keyboard-only user | Full standard operation without pointer input and visible focus/grab states. |
| Pointer user | Accurate hit targets, capture, drop preview, autoscroll, and cancellation. |
| Board administrator | Column/swimlane configuration, WIP policy, views, presentation, and editor schema. |
| Theme author | Semantic roles and safe truecolor/256/16/mono fallbacks. |
| Translator | Typed catalogs, accelerator safety, and expansion-aware layout. |
| Documentation learner | Progressive teaching, copyable examples, focused labs, and a complete showcase. |
| Maintainer | Specification tests, performance evidence, compatibility policy, and plugin synchronization. |

The user approved this stakeholder map.

## Confirmed architecture

- The application owns authoritative columns, swimlanes, cards, view storage, history, and every
  mutation. The component emits typed requests and reconciles data updates by stable identity.
- A generic card requires stable identity, workflow-column placement, and ordering information.
  The package also supplies an optional mainstream standard card model, renderer, and editor.
- Workflow columns are mandatory. Horizontal swimlanes are optional, use zero or one selected
  grouping dimension per saved view, and may derive from team, project, epic, sprint, priority, or
  application data. Nested grouping is explicitly excluded.
- Swimlanes support hybrid (default), separator, band, rail, and custom presentation. Groups can be
  ordered, styled, shown, hidden, collapsed, and filtered reactively.
- Pointer and keyboard movement share a proposal lifecycle: synchronous pure drop eligibility,
  visible preview, cancellable async request, and authoritative application update. A stale or
  rejected operation cannot mutate the board.
- The source design covers eager resident data and per-lane windowed data. Initial architecture
  targets are 5,000 resident cards, 100,000 logical cards, and bounded visible rendering. Normative
  fixtures prove bounded reads and deterministic operation costs; controlled local timing uses a
  warmed 16 ms median target at 80×24 and records p95 evidence separately.
- Saved view state is a versioned serializable package value; the application owns storage.
- Move proposals express semantic placement through stable neighbor anchors, explicit logical versus
  loaded-window edges, operation/data/view revisions, and optional source-issued opaque tokens. The
  application alone resolves and publishes persistent rank.

## Confirmed feature set

### Workflow and organization

- Configurable columns, names, order, widths, visibility, collapse state, definition of done, and
  informational/advisory/blocking min/max WIP policy.
- Stable rank within each column/swimlane intersection and application-authorized arbitrary forward
  or backward transitions.
- Multi-card selection and atomic bulk move requests.
- Horizontal grouping, search, jointly active named quick filters, view-only field sorting, saved
  views, honest counts, and application-provided numeric summaries.
- No split-column primitive, separate slice primitive, component-owned backlog, nested swimlanes,
  or component-owned cross-board transfer.
- Filters never change source membership. Total, matching, loaded, visible, selected, and WIP counts
  are distinct; WIP uses authoritative data. True empty, filtered empty, loading, partial, collapsed,
  and error states remain visibly distinct.
- Focus survives when visible and otherwise falls deterministically to the next/previous local card,
  neighboring columns, a column header, then the board/no-results surface. Clearing a filter never
  steals focus back. View changes prune invisible selections with feedback; window unloading alone
  preserves selection identity. Client select-all is explicitly loaded/visible/matching only unless
  the application provides a server-wide model.
- Drag-hover temporarily expands collapsed swimlanes but still requires a real gutter. Leaving restores
  collapse state; successful drops do not mutate the saved preference; hidden groups never auto-reveal.

### Card surface

- Configurable ordered fields, labels, status, priority, type, assignee, dates, estimate, counts,
  summaries, conditional styles, and compact/standard/custom density.
- No inline editing and no graphical cover/attachment preview in the standard renderer.
- Reactive checklist presentation modes: hidden, progress, or bounded read-only preview. Defaults
  are hidden, two preview rows in standard density, progress-only compact/narrow degradation when
  space permits, source order, completed items visible, omitted count enabled, and empty hidden.
- Checklist rows ellipsize by display-cell width and degrade to ASCII. All checklist changes occur
  in the editor dialog.
- Ordered generic summary sections are supported. Only checklists preview individual child rows;
  comments, attachments, child items, and similar data use counts/summaries.

### Interaction and productivity

- Complete keyboard actions and pointer parity where terminal capabilities permit.
- Grab/drop, insertion markers, four-edge drag autoscroll, cancellation, pending/rejected states,
  focus preservation, and non-color cues.
- Card creation at a selected placement, card action menu, duplicate/archive/delete requests,
  public commands, configurable conflict-validated keymap, undo/redo integration, normalized
  observability/automation events, and visible help/status feedback.
- Sorted views visibly disable within-cell manual rank changes while preserving allowed
  cross-column movement.
- The user approved a flagship modern pointer experience: configurable one-cell drag threshold,
  pointer capture, a bounded recognizable lifted-card ghost, source/target placeholders, live card
  reflow around the insertion position, substantial card/empty-column targets, non-color invalid
  feedback, two-speed four-edge autoscroll, exactly one request on pointer-up, safe cancellation,
  multi-card stack preview, and the same principles for column/swimlane reordering.
- Pointer acceptance covers native terminals and browser/xterm hosts, deterministic frame sequences,
  no stale ghost/trails/damage, responsive and color-depth variants, and measured local drag-frame
  evidence. Exact visual constants remain prototype-derived.
- Comfortable and spacious card stacks reserve one blank full-width gutter row between cards. It is
  the primary insertion target; card upper/lower halves provide forgiving before/after fallback with
  target hysteresis. Stacks expose leading/trailing positions, empty cells retain larger targets, and
  the first card target starts below rather than on a swimlane header. Compact density may omit the
  resting gutter but expands the active insertion marker to one row during a drag.
- Single-click focuses and singly selects; double-click opens; semantic Primary-click toggles (Command
  on capable macOS browser hosts, Ctrl elsewhere/native); right-click
  focuses and opens actions. Space toggles keyboard selection and Shift navigation extends a range
  only within one column/swimlane cell. Dragging a selected card moves the atomic selection; dragging
  an unselected card moves only it. Multi-source selections insert as one deterministic visually
  ordered block and cannot partially succeed.
- A synchronous application capability provider controls actions globally and per entity. Disabled
  with a reason is the discoverable default, explicit hiding is supported, and application-side
  authorization remains authoritative. Read-only mode preserves navigation, search, views, help, and
  permitted inspection while removing mutation/drop affordances.
- Cards do not carry permanent gear/action buttons. Right-click and commands expose actions; a
  one-cell Add affordance may appear on a focused/hovered column header when geometry permits, and an
  empty writable column provides a larger Add Card target.

### Dialogs and configuration

- Package-owned localized themed dialogs and confirmations collect card, column, and swimlane data.
  Applications can invoke them, replace individual controls/dialogs, or use entirely custom UI.
- Standard card create/view/edit is modal. An enhanced optional application-controlled modeless
  inspector is supported, but the same card identity cannot have simultaneous editors.
- Generic typed fields cover text, multiline, number, boolean, date, single choice, multiple
  choice, and custom control factories.
- Drafts are isolated. Sync/async validation, dirty-close confirmation, destructive confirmation,
  pending state, cancellation, and stale-result protection reuse JSVision Forms/Dialog semantics.
- Programmatic column/swimlane add, edit, reorder, collapse, and delete request APIs coexist with
  standard configuration dialogs.
- Configuration dialogs edit isolated drafts and emit one atomic application request. Stable IDs do
  not change with names. Direct programmatic requests do not force UI confirmation, while package
  destructive UI always confirms.
- Hide/collapse are reversible view operations. Empty structural groups can be deleted after
  confirmation. Non-empty deletion is blocked by default; applications may supply one atomic
  reassignment, archive destination, or custom workflow. The package never cascade-deletes cards or
  accepts partial reassignment success.
- Derived swimlane operations are capability-controlled. Normalized duplicate display names are
  rejected by default but applications may allow them with a disambiguator. A zero-column board is a
  valid component state; application policy decides whether the standard UI permits deleting the
  final empty column.
- Standard and generic editors share one typed schema/adapter protocol. The optional `StandardCard`
  requires identity, placement/rank, title, and status; mainstream metadata is optional. Checklist
  groups and items have stable IDs and explicit order. The scrollable standard dialog uses progressive
  sections rather than placing every field on screen at once.

### Lifecycle, safety, and compatibility

- Ready, loading, refreshing, partial, empty, and error/retry source states.
- Proposed, pending, accepted, rejected, cancelled, and superseded operation states.
- Unrelated source updates reconcile during a grab; changes affecting the grabbed card or its
  placement cancel safely with visible feedback.
- Duplicate/invalid IDs fail predictably. Focus falls to a deterministic nearest survivor when its
  identity disappears. Renderer/resolver/callback failures are isolated and observable.
- All display/error text is sanitized and bounded. No implicit filesystem, network, clipboard, or
  visitor-data access; no sensitive card payloads in diagnostics; async work is bounded and
  cancellable.
- Truecolor, 256-color, 16-color, monochrome, `NO_COLOR`, Unicode-width, combining-character,
  hostile-text, hostile-translation, and ASCII-safe behavior are verification concerns.
- Screen-reader semantics are not promised beyond what the terminal host can support; documentation
  must state the accessibility boundary accurately.
- Durable saved views use a validated version-1 JSON envelope with stable registry IDs, explicit
  sequential migrations, bounded namespaced extensions, and deterministic missing-ID reconciliation.
  Focus, selection, scroll, pending work, editor drafts, cache windows, and temporary expansion remain
  ephemeral and are never written into the durable view artifact.

### Layout and hosting

- Host directly on a surface or inside a window. Shadows are host/theme controlled.
- Independent horizontal/vertical scrolling, sticky workflow headers, and appropriate sticky
  swimlane header/rail behavior.
- Wide multi-column, compact horizontally scrolling, and narrow focused-column presentations.
- Column surfaces default to constrained 18/24/32-cell minimum/preferred/maximum width classes with
  application overrides. Resize/maximize/restore preserves the focused card and reconciles scroll.
  When two effective minimum-width columns do not fit, a one-row previous/name/next navigator replaces
  the multi-column viewport without adding a permanent side rail. The first prototype must reopen the
  defaults if mandatory title/status/focus/move cues clip at 18 cells.
- Responsive composition is mandatory everywhere. The package uses JSVision's public
  `col`/`row`/`stack`, sizing, placement, measurement, button-group, and layout invalidation contracts
  for the board's surrounding structure, cards, state surfaces, dialogs, docs labs, and examples.
  Raw rectangles are isolated to desktop window placement, framework overlays, and the measured
  virtualized board/hit-test/drag leaf after DSL layout assigns its viewport; dialog interiors and
  ordinary content are never hand-positioned for convenience.

### i18n, docs, and showcase

- Package-owned messages use injected `I18n`, English fallback, and catalogs for `en`, `nl`, `de`, `fr`,
  `es`, `it`, `pt-PT`, `pl`, `ro`, and `sv`; every non-English catalog needs current digest-bound review
  evidence before it is described as official.
- A Data Grid-style specialist documentation hub contains focused live examples and generated API
  links.
- `packages/examples/kanban-showcase/` is a flagship Reddit-ready demonstration with realistic
  workflow, keyboard/pointer movement, editors/settings, WIP, filtering/grouping, lifecycle states,
  scale, locale/theme/color-depth switching, deterministic fixtures, tests, and manual TTY review.
- A polished representative story also appears in the general JSVision kitchen sink.

## Explicit component boundary

The package owns no authentication system, authorization store, persistence, database, network
synchronization, activity/comment store, attachment store, notification delivery, automation
engine, analytics dashboard, or cross-board orchestration. It exposes the data, command, request,
and event seams an application needs to provide those concerns.

## Comparable-system evidence

Research was refreshed from official documentation on 2026-08-03. The evidence matrix records which
mainstream capability informed the approved component and whether it was accepted directly, adapted for
terminal constraints, rejected, or left application-owned.

| Product / official source | Documented capability | Kanban disposition | Durable rationale |
|---|---|---|---|
| [Azure Boards overview](https://learn.microsoft.com/en-us/azure/devops/boards/?view=azure-devops) | Workflow columns, WIP, card customization, filters, swimlanes | Accepted | Core workflow, policy, card presentation, filtering, and one grouping axis fit terminal interaction. |
| [Azure Boards overview](https://learn.microsoft.com/en-us/azure/devops/boards/?view=azure-devops) | Definition-of-done and work-item process integration | Adapted | Kanban exposes DoD and transition-policy seams; the application owns the work-item process. |
| [Jira swimlanes](https://support.atlassian.com/jira-software-cloud/docs/configure-swimlanes/) | Query/field-driven horizontal grouping | Adapted | One configurable swimlane dimension is supported; nested grouping is rejected as too dense for TUI geometry. |
| [Jira board and backlog view](https://support.atlassian.com/jira-software-cloud/docs/customize-your-view-of-the-board-and-backlog/) | Card fields, quick filters, configurable density | Accepted | Maps to bounded fields, jointly active quick filters, and density-aware card presentation. |
| [GitHub Projects board layout](https://docs.github.com/en/enterprise-cloud@latest/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout) | Custom columns, field sections, group/sort/filter, multi-item movement, summaries | Adapted | Columns, grouping, sort/filter, atomic multi-card moves, and summaries are included; a second slicing axis is excluded. |
| [GitHub Projects board layout](https://docs.github.com/en/enterprise-cloud@latest/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout) | Board/view limits | Accepted as evidence pattern | JSVision defines its own explicit terminal/source/resource limits rather than copying web limits. |
| [Trello checklists](https://support.atlassian.com/trello/docs/adding-checklists-to-cards/) | Checklist groups, items, progress | Adapted | Cards offer hidden/progress/bounded read-only preview; editing remains in responsive dialogs. |
| [Trello card creation](https://support.atlassian.com/trello/docs/adding-cards/) | Create a card between existing cards | Accepted | Semantic insertion gutters and before/after anchors support precise creation without numeric authoritative ranks. |
| [Trello checklists](https://support.atlassian.com/trello/docs/adding-checklists-to-cards/) | Long interactive checklist content on the card | Rejected | Full inline editing would harm scanability and terminal geometry; dialogs own edits. |
| All four products above | Persistence, authorization, notifications, automation, attachments, and cross-board services | Application-owned | The reusable component supplies typed seams but does not become a Kanban application backend. |

Web-specific graphical covers, inline editing, nested grouping, and duplicated slicing behavior remain
excluded. The matrix is research evidence, not permission to add scope beyond the ambiguity register.

## Discovery completion

- The user approved the complete responsive, async/windowed, selection, capability, mouse-action,
  SDK, saved-view, testing, lifecycle, and distribution journey batch.
- The user added and confirmed a maximum-use responsive JSVision layout-DSL mandate.
- The systematic completeness scan found no unresolved or Maybe-scope item.
- The ambiguity register passed with 43 of 43 items resolved. RD authoring added and resolved the
  responsive public component/source/request topology and centralized default-limit/keymap decisions
  under the active auto-design policy.

## Resume point

Continue Phase 2: define the glossary and RD decomposition, map dependencies and implementation
phases, then author the complete requirement set. Any newly discovered semantic choice must reopen
the ambiguity register before it enters an RD.
