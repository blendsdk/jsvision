# Ambiguity Register: JSVision Kanban

> **Status**: ✅ GATE PASSED — 45 of 45 items resolved; scope confirmed for implementation
> **Last Updated**: 2026-08-12
> **Feature-Set**: kanban (`codeops/features/kanban/`)
> **Mode**: auto-design
> **Root Invocation ID**: `kanban-20260803-01`
> **Policy Version**: 1

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|---|---|---|---|---|
| 1 | Naming / scope | What is the package and CodeOps feature identity? | Package/feature names proposed from the user's seed | **`@jsvision/kanban` in the confirmed `kanban` feature target** | ✅ Resolved |
| 2 | Scope / packaging | Does Kanban live in UI or its own package? | UI primitive / standalone specialist package | **Standalone public package, following Data Grid and Code Editor precedent** | ✅ Resolved |
| 3 | Data / ownership | Who owns authoritative board data and mutations? | Application-owned / component-owned / dual mode | **Application-owned; the component emits typed requests and reconciles published source updates** | ✅ Resolved |
| 4 | Data / cards | How generic is the card contract? | Fixed mainstream schema / minimal generic identity and placement / arbitrary renderer only | **Minimal stable identity, column placement, and rank; optional standard card model and presentation adapters** | ✅ Resolved |
| 5 | UX / editing | Where are card edits performed? | Inline card editing / dialogs / both | **Dialogs only; package supplies standard create/view/edit dialogs and complete replacement seams** | ✅ Resolved |
| 6 | Data / geometry | What do vertical columns and horizontal swimlanes mean? | Columns only / both axes / nested grouping | **Mandatory workflow columns plus optional horizontal grouping by one selected dimension per view** | ✅ Resolved |
| 7 | UX / swimlanes | How are horizontal groups rendered and nested? | Separator / band / hybrid / rail / custom; flat / nested | **Hybrid default; separator, band, rail, and custom variants; no nested grouping** | ✅ Resolved |
| 8 | UX / configuration | Who supplies column and swimlane configuration UI? | Application-only / package-only mutation / package dialogs over app-owned data | **Package supplies localized themed dialogs and confirmations plus programmatic request APIs; applications choose whether to invoke them** | ✅ Resolved |
| 9 | Behavior / moves | How are pointer and keyboard moves validated and committed? | Immediate mutation / async-only / sync preview plus async request | **Pure synchronous `canDrop`-style preview plus cancellable async move request; only application data commits the move** | ✅ Resolved |
| 10 | Non-functional / scale | Which scale modes shape the API? | Resident arrays only / windowed only / eager plus windowed | **Design eager and per-lane windowed sources; target 5,000 resident cards and 100,000 logical cards with bounded rendering** | ✅ Resolved |
| 11 | Scope / delivery | Is discovery limited to an MVP? | MVP-only / complete long-term design with phases | **Design the complete long-term component now and implement it in independently verified phases** | ✅ Resolved |
| 12 | i18n | Which localization contract applies? | English only / injected i18n / complete official locale family | **Injected `I18n`, English fallback, and `en`, `nl`, `de`, `fr`, `es`, `it`, `pt-PT`, `pl`, `ro`, `sv` catalogs for package-owned text; every non-English catalog requires current digest-bound review evidence before it is called official** | ✅ Resolved |
| 13 | Documentation | What documentation depth is required? | API reference only / component page / Data Grid-style specialist hub and live labs | **Detailed specialist documentation and focused live examples comparable to Data Grid** | ✅ Resolved |
| 14 | Examples / showcase | How is the component demonstrated? | General kitchen-sink story only / dedicated showcase only / both | **A Reddit-ready dedicated `kanban-showcase`, a polished general kitchen-sink story, and focused docs labs** | ✅ Resolved |
| 15 | Workflow features | Which mainstream workflow capabilities belong? | W1–W8 Want/Maybe/Skip comparison | **WIP min/max, definition of done, ranking, arbitrary allowed transitions, multi-card moves, and honest counts included; split columns and component-owned backlog excluded** | ✅ Resolved |
| 16 | Card presentation | Which mainstream card features belong? | C1–C8 Want/Maybe/Skip comparison | **Configurable fields, labels, summaries, common metadata, conditional styling, and density included; inline editing and graphical covers excluded from the standard renderer** | ✅ Resolved |
| 17 | Views / discovery | Which filtering, sorting, grouping, and view features belong? | V1–V8 comparison | **Search, quick filters, saved views, column personalization, field sorting, one-dimensional grouping, and summaries included; separate slicing primitive excluded** | ✅ Resolved |
| 18 | Productivity | Which board productivity features belong? | P1–P8 comparison | **Keyboard commands, creation, action menus, undo integration, public commands, configurable keymap, and normalized events included; component-owned cross-board transfer excluded** | ✅ Resolved |
| 19 | TUI interaction | Which terminal-specific interaction requirements apply? | T1–T8 comparison | **Four-edge autoscroll, keyboard parity, insertion markers, non-color state, focus preservation, responsive widths, full state surfaces, and resolver failure isolation** | ✅ Resolved |
| 20 | Editor / forms | What does the package-owned editor support? | E1–E8 comparison; modal / modeless | **Schema-driven standard dialogs, generic typed custom fields, isolated drafts, sync/async validation, dirty/destructive confirmation, full replacement; modal editing plus optional modeless inspector** | ✅ Resolved |
| 21 | Lifecycle | How does the board handle async and reactive change? | L1–L8 comparison | **Explicit source/operation states, cancellation, stale-work protection, deterministic focus reconciliation, ID validation, error isolation, and windowed-source honesty** | ✅ Resolved |
| 22 | Security | What safety boundary applies to generic card data and custom code? | S1–S8 comparison | **Sanitized bounded display/errors, no package-provided host handles, bounded package inputs/results/invocations and async work, safe diagnostics, trusted same-thread custom code with application-owned runtime/side effects, and adversarial fixtures; no sandbox or synchronous pre-emption claim** | ✅ Resolved |
| 23 | Accessibility | Which terminal accessibility and compatibility guarantees apply? | A1–A8 comparison | **Keyboard reachability, non-color cues, visible help/feedback, color-depth fallback, Unicode geometry, ASCII mode, translated layout, and accurate scope disclosure** | ✅ Resolved |
| 24 | Layout / hosting | How does Kanban adapt and where can it be hosted? | R1–R8 comparison | **Surface or window hosting, host-controlled shadow, two-axis scrolling, sticky headers, wide/compact/narrow modes, measured widths, and resize reconciliation** | ✅ Resolved |
| 25 | Card checklist | Can cards display task/checklist detail? | Hidden / progress / bounded preview / full inline checklist | **Reactive hidden, progress, or bounded read-only preview; default hidden, two-item standard preview, progress-only compact degradation, dialog editing** | ✅ Resolved |
| 26 | Card summaries | Are other compact card sections supported? | Checklist-specific / generic ordered summaries / arbitrary inline content | **Generic ordered summary sections; only checklists preview individual child rows, while comments/attachments and similar data use summaries** | ✅ Resolved |
| 27 | Scope boundary | Which application concerns are explicitly outside the component? | Component owns app services / integration seams only | **No auth system, persistence, network sync, activity storage, attachment storage, notifications, automation engine, analytics dashboard, or cross-board orchestration** | ✅ Resolved |
| 28 | Theme / reactive visuals | How are card and swimlane visuals resolved? | Static theme only / custom renderer only / semantic defaults plus reactive resolvers | **Package-local `KanbanTheme` semantic defaults derived from Core roles plus reactive application resolvers and complete custom renderer seams; status may drive title/background while deterministic effective-depth contrast fallback and non-color cues preserve readability** | ✅ Resolved |
| 29 | Commands / input | How are input bindings exposed? | Hard-coded keys / actions plus configurable keymap | **Stable public actions/commands with documented defaults, configurable conflict-validated keymap, semantic Primary modifier (Command on capable macOS browser hosts, Ctrl elsewhere/native), menus/status/command-palette integration, and pointer parity** | ✅ Resolved |
| 30 | Data / compatibility | Does saved view state create a compatibility obligation? | In-memory only / application-owned versioned serialization | **Package defines versioned serializable view state; storage is application-owned; data-and-migration lens applies** | ✅ Resolved |
| 31 | User journeys | What exact end-user journeys and recovery outcomes must be normative? | Card/move/configuration/filter journeys plus responsive, async/windowed, selection, capability, and SDK integration walkthroughs | **User approved the complete journey set: deterministic focus/edit/recovery, responsive hosting, independent windowed states, honest unknown-edge drops, atomic multi-selection, discoverable capabilities/read-only behavior, uncluttered pointer actions, generic/standard SDK paths, and complete lifecycle/testing/distribution journeys** | ✅ Resolved |
| 32 | Data / ranking | What precise rank and placement token contract works for eager, windowed, multi-card, and concurrent moves? | Numeric index / before-after stable IDs / opaque app rank / hybrid | **Authority: AI — semantic placement proposals use stable neighbor anchors, explicit logical/window-edge intent, ordered moved IDs, operation/data/view revisions, and an optional source-issued opaque placement token; the application resolves rank atomically** | ✅ Resolved |
| 33 | Behavior / configuration | What exact behavior applies when deleting or hiding a non-empty column or swimlane? | Reject / require reassignment / archive through application policy / configurable combination | **User approved G1–G16: isolated atomic drafts/requests, hide distinct from delete, empty confirmation, non-empty blocked by default, optional atomic reassignment/archive/custom policy, no cascade card deletion, capability-controlled derived groups, normalized-name safety, deterministic focus, and application policy for the final empty column** | ✅ Resolved |
| 34 | UX / geometry | What measured minimum card/column widths and adaptive breakpoints apply? | Fixed thresholds / measured prototype-derived thresholds / application-only policy | **Authority: AI — cell-measured constrained widths with 18/24/32-cell default min/preferred/max classes, app overrides, horizontal scrolling, and a one-row focused-column navigator when two usable columns cannot fit** | ✅ Resolved |
| 35 | Data / editor schema | Which standard-card fields are required versus optional, and how are multiple checklist groups represented? | Fixed model / generic schema only / standard adapter over one generic protocol | **Authority: AI — one schema/adapter editor protocol plus an optional `StandardCard`; its required semantic fields are identity, placement/rank, title, and status, while mainstream metadata and ordered stable-ID checklist groups/items are optional** | ✅ Resolved |
| 36 | Data / view state | Which saved-view fields, schema version, compatibility, and unknown-field behavior are public? | Strict version rejection / migration adapters / best effort | **Authority: AI — a validated v1 durable semantic envelope, explicit sequential migrations, stable registry IDs, bounded namespaced extensions, deterministic reconciliation, and no ephemeral focus/selection/scroll/pending/editor/cache state** | ✅ Resolved |
| 37 | Behavior / filtering | How do hidden, collapsed, filtered, empty, unloaded, and selected groups interact with counts and focus? | F1–F18 pipeline, count, focus, selection, collapse, and windowing recommendations | **User approved F1–F18: view-only filters; distinct total/matching/loaded/visible/selected/WIP semantics; authoritative WIP; distinct states; deterministic focus; invisible-selection pruning; honest bounded select-all; temporary drag auto-expand without header drops; no hidden auto-reveal; and application-supplied windowed counts/policy** | ✅ Resolved |
| 38 | Quality / verification | What exact benchmark fixtures, test matrices, visual review evidence, and release gates define completion per phase? | Conventional snapshots / layered spec-first evidence / showcase-led manual testing | **Authority: AI — layered specification-first model, component, terminal-frame, pointer-trace, real PTY/ConPTY and browser host-E2E, bounded-source/performance, migration, docs, showcase, locale-review, and release-gate evidence with controlled timing budgets and curated semantic goldens** | ✅ Resolved |
| 39 | UX / pointer | What quality bar governs mouse drag-and-drop? | Basic outline / modern lifted ghost with live reflow and full recovery behavior | **User approved M1–M16: flagship pointer UX with a defined Manhattan threshold, UI capture-loss lease, bounded ghost, live insertion reflow, substantial targets, autoscroll, cancellation, multi-card and column/swimlane drag, keyboard alternatives, and native/browser acceptance evidence** | ✅ Resolved |
| 40 | UX / density | Is there a permanent card-to-card gutter and how does it interact with compact density and swimlane separators? | Permanent one-row gutter / drag-only expanded gap / density-specific combination | **User approved M17–M26: one-row comfortable/spacious gutter, full-width target, before/after card-half fallback with hysteresis, leading/trailing zones, separate post-swimlane leading gap, large empty targets, and drag-expanded compact insertion marker** | ✅ Resolved |
| 41 | Layout / composition | How strongly must Kanban and its included dialogs use JSVision's layout DSL? | Best-effort DSL use / DSL-first with named exceptions / bespoke geometry throughout | **User requires maximum use of the public JSVision layout DSL and responsive UI everywhere; ordinary Kanban/dialog composition must use DSL flow/stack/measurement, with raw cell geometry limited to documented window-manager, framework-overlay, virtualized canvas, hit-test, and transient drag-layer exceptions** | ✅ Resolved |
| 42 | Public architecture | What public component, source, request, identity, and export topology preserves DSL responsiveness, bounded windowing, and application authority? | Monolithic view or view-per-card / board plus viewport; flat, cell, or session source; callbacks or request dispatcher; one barrel or many subpaths | **Authority: AI — `KanbanBoard<T>` is a DSL-composed group around one measured `KanbanViewport<T>` leaf; a board query session exposes sparse lazy cell cursors; one discriminated atomic request dispatcher owns application-data mutations while pure local view transitions remain separate; public terminology is column/swimlane; the canonical main barrel exports models/UI/dialogs with locale and testing subpaths only** | ✅ Resolved |
| 43 | Public defaults / bounds | Which exact default keys, geometry timings, data bounds, and resource limits keep the first public contract usable and safe without deferring decisions to planning? | Leave to implementation / unbounded / centralized conservative defaults with host-lowerable limits | **Authority: AI — freeze the centralized classified limits and keymap in AR-43/RD-14: every resource has a safe default, standard ceiling, and absolute maximum; immutable safety bounds remain fixed; geometry timings are explicit; Primary resolves to Command on capable macOS browser hosts and Ctrl elsewhere/native; destructive/configuration actions are unbound by default** | ✅ Resolved |
| 44 | UX / drag ghost | After native visual review, what bounded content should the card drag ghost retain? | Earlier title/status fragment / compact framed title-only ghost | **User approved one compact framed card title, plus bounded selected count when multiple, with no status row or blank trailing row; pointer-relative tracking and theme/capability fallbacks remain unchanged** | ✅ Resolved |
| 45 | Theme / application accents | How can the approved colorful showcase represent status families without lying through read-only/WIP/error roles? | Repurpose state roles / one neutral surface with text cues / four bounded neutral accent roles | **User authorized four generic application-neutral `card.accent-1`…`card.accent-4` roles with deterministic legacy fallback, exact text/non-color status cues, and focus/selection composition that preserves the accent surface** | ✅ Resolved |

## Resolution Notes

**AR-1–AR-14:** Direct user decisions from the project vision and architecture discovery rounds.

**AR-15–AR-19:** The user accepted the complete recommendation batches W1–W8, C1–C8,
V1–V8, P1–P8, and T1–T8. Exclusions recorded in those batches are deliberate scope decisions,
not deferred work.

**AR-20–AR-24:** The user explicitly accepted all recommendations in the editor, lifecycle,
security, accessibility, and responsive-layout batch, including modal standard editing and the
optional application-controlled modeless inspector.

**AR-25–AR-26:** The user explicitly approved all checklist and generic summary-section
recommendations and defaults. Card-level checklist rows remain read-only and open the editor for
changes.

**AR-27–AR-30:** These decisions record the accepted component/application boundary and the
cross-cutting consequences of earlier accepted recommendations.

**AR-31:** The user approved the final responsive hosting, async/windowed recovery, multi-selection,
capability/read-only, uncluttered mouse-action, generic/standard SDK, saved-view, testing, lifecycle,
and distribution journey batch. Together with the previously approved card/editor, move,
configuration, and filtering journeys, this closes the normative workflow set.

**AR-33:** The user explicitly approved G1–G16. Structural deletion is application-authorized,
blocked by default while cards remain, and never silently deletes or partially reassigns cards.
Hide/collapse remain reversible saved-view operations.

**AR-39:** The user explicitly approved the complete M1–M16 pointer interaction and visual/performance
acceptance batch. Exact prototype-derived constants remain governed by AR-34 and AR-38.

**AR-40:** The user explicitly approved M17–M26. Comfortable and spacious densities reserve a
one-row card gutter; compact density may reclaim it at rest but expands the active target during a
drag. Swimlane headers remain controls and never double as ambiguous card insertion targets.

**AR-44:** During native visual review after Phase C, the user explicitly approved a smaller drag ghost:
one framed title row, a bounded multi-selection count when applicable, and no status or blank trailing row.
This later decision supersedes only the earlier ghost-content detail in AR-39/RD-07; capture, pointer-relative
tracking, placeholder, insertion-gap, autoscroll, cancellation, accessibility, and host-evidence guarantees
remain unchanged.

**AR-45:** During the T-03 preflight re-scan, codebase evidence proved that the closed inventory had no
truthful neutral roles for the approved colorful status showcase. The user explicitly authorized the
recommended bounded public expansion through completion. Four application-neutral accents are added with
source-compatible optional caller tokens, deterministic `card.normal` fallback, exact text/non-color status
cues, and focus/selection composition that never replaces the accent surface or repurposes state roles.

**AR-37:** The user explicitly approved F1–F18. Filtering remains a view projection; WIP and
structural counts use authoritative data; focus and selection never leave invisible destructive
scope; collapsed groups auto-expand temporarily for drag targeting without changing saved state.

### AR-32 — Semantic placement and application-owned rank

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Public integration mechanism within the user-approved application-owned mutation,
  eager/windowed source, atomic multi-card move, and stale-operation behavior.
- **Objective:** Describe the user's intended location without making a display index or the
  component's optimistic projection authoritative.
- **Decision:** A move proposal carries a unique operation ID; ordered moved card IDs; source and
  target column/swimlane identities; the cards' captured source placements; an explicit target kind
  (`start`, `between`, `end`, or `window-edge`); nullable stable `beforeCardId`/`afterCardId` anchors;
  source-data and view-projection revisions; and, when supplied by a windowed source, an opaque typed
  placement token. `start` and `end` are legal only when the source declares that logical boundary
  known. A loaded-window boundary is always `window-edge`, never silently promoted to a logical edge.
  The application atomically accepts, rebases, or rejects the whole proposal and publishes the
  authoritative rank/order; the component never manufactures persistent fractional ranks.
- **Filtered/windowed rule:** Anchors describe the visible projection. If hidden or unloaded cards
  make the interval ambiguous, the source/application placement policy must resolve it or `canDrop`
  must reject it with a reason. The default package policy uses a source-issued placement token when
  available and otherwise does not guess across an unknown window boundary. An optional visual index
  is diagnostics-only and never affects placement.
- **Evidence:** `packages/datagrid/src/data-source.ts` establishes stable row identity, undefined
  unloaded reads, bounded `ensureRange`, completeness, and reactive revision precedents. Numeric
  indices cannot preserve intent across filtering, windowing, or concurrent updates.
- **Rejected alternatives:** Numeric indices bind the request to a stale projection. Neighbor IDs
  alone cannot distinguish a logical end from the last loaded card. An opaque token alone prevents
  eager sources and diagnostics from explaining the intended relationship.
- **Strongest counterargument:** Anchors can disappear concurrently and the richer proposal is more
  work for application adapters.
- **Confidence:** High; explicit revisions and atomic application resolution turn disappearance
  into a deterministic rebase/reject outcome instead of a silent misplacement.
- **Hardening:** The independent challenger converged on the hybrid and added explicit logical-edge
  versus loaded-window-edge semantics and operation deduplication.
- **Policy version:** 1.
- **Root invocation ID:** `kanban-20260803-01`.
- **Reopen triggers:** A source cannot expose either stable anchors or an opaque placement token, or
  application adapters cannot distinguish authoritative from projection revisions.

### AR-34 — Responsive cell geometry

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** TUI measurement and degradation mechanism within the approved wide, compact, and
  narrow presentations.
- **Objective:** Keep cards readable at 80×24 and smaller viewports without adding persistent rails,
  toolbars, or repeated labels.
- **Decision:** Column surfaces use terminal-cell constraints with default width classes of 18 cells
  minimum, 24 preferred, and 32 maximum, excluding the inter-column separator. Applications and
  custom renderers may provide bounded per-column overrides and minimum-content hints. The solver
  measures display width of invariant chrome and localized header content, clamps it to the declared
  bounds, fits/distributes preferred widths, and uses horizontal scrolling for overflow. If the
  viewport cannot fit two columns at their effective minima plus their separator, it switches to a
  single focused-column presentation with one compact header row containing previous/next affordances,
  the ellipsized column name, and position/count. No permanent side navigator is added.
- **Degradation:** Optional card sections progressively collapse in configured priority order;
  checklist rows become progress-only before disappearing; titles/status/non-color focus and pending
  cues remain. Localized labels ellipsize with their full value available through focus/help rather
  than forcing unbounded columns. Resize preserves card identity and scroll anchors; returning to a
  wider viewport restores the multi-column presentation.
- **Evidence:** JSVision already measures wide-glyph-aware cell widths and constrains min/max columns
  (`packages/ui/src/table/columns.ts`); Calendar derives locale-aware density metrics rather than raw
  string lengths (`packages/ui/src/date/calendar-metrics.ts`). At 80 cells, three preferred columns
  plus two separators consume 74 cells before optional outer chrome.
- **Rejected alternatives:** Fixed viewport breakpoints ignore host insets, locale, and renderer
  needs. App-only layout policy would make baseline usability and docs examples inconsistent.
- **Strongest counterargument:** Measured widths can jitter as data or translations change.
- **Confidence:** Medium-high; width classes, clamping, and stable renderer hints avoid content-driven
  jitter, but the defaults must be reopened if the first real card prototype clips mandatory cues.
- **Hardening:** The independent challenger converged on constrained measurement, requested clamped
  translated content and width classes, and rejected unrestricted content measurement.
- **Policy version:** 1.
- **Root invocation ID:** `kanban-20260803-01`.
- **Reopen triggers:** A focused prototype cannot show title, status, focus, and move feedback at 18
  cells, or the standard 80×24 docs shell cannot retain visible desktop margin with the intended board.

### AR-35 — Standard card and editor protocol

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Data-shape and extensibility mechanism within the approved generic card contract,
  package editor, checklist, and application-owned commit behavior.
- **Objective:** Supply a useful mainstream editor without imposing its storage model on consumers or
  maintaining separate standard and generic form engines.
- **Decision:** Both paths use one typed schema/adapter protocol with stable field IDs, typed
  get/set/format/validate adapters, sections, visibility/read-only predicates, and custom-control
  factories. The optional `StandardCard` adapter requires stable identity, placement/rank, title, and
  status. Description, type, priority, assignees, labels, start/due dates, estimate, checklist groups,
  summary values, and application custom data are optional. Presentation colors and glyphs are
  resolver outputs and are never persisted as status semantics.
- **Checklist shape:** A card may contain zero or more ordered groups. Every group and item has a
  stable ID and explicit array order; a group has an optional title; a standard item has text and a
  completion flag, with further data supplied through the generic schema. Preview policy may select
  groups or aggregate progress, but never edits them on the card.
- **Draft/concurrency rule:** The editor clones application values into an isolated normalized draft,
  captures a base revision, and submits one typed full-draft proposal plus changed field IDs. The
  application validates and commits; stale outcomes follow the already-approved reload/cancel or
  application merge/overwrite policy. Custom application payloads remain opaque to the standard
  model and pass through explicit bounded adapters rather than unsafe spreading.
- **Visual-density rule:** The standard dialog is scrollable and sectioned, starts with common fields,
  and uses collapsible secondary/checklist groups with at most one dense group expanded by default.
  This progressive disclosure is presentation only and does not remove schema fields.
- **Evidence:** `@jsvision/forms` already supplies typed field state, isolated values, async validators
  with live `AbortSignal`, submission state, stale-result protection, and disposal semantics.
- **Rejected alternatives:** A fixed card model becomes a mandatory database schema. A generic-only
  editor fails the requirement for strong mainstream defaults. Two editor implementations would
  drift in validation and lifecycle behavior.
- **Strongest counterargument:** A standard adapter plus a generic protocol expands the public API.
- **Confidence:** High; the normalized protocol makes the standard model a documented convenience,
  not a second behavioral surface.
- **Hardening:** The independent challenger converged and added the single-normalized-protocol rule,
  explicit checklist identity, and revision-aware full-draft submission.
- **Policy version:** 1.
- **Root invocation ID:** `kanban-20260803-01`.
- **Reopen triggers:** Forms cannot express a required standard field without package-private behavior,
  or a consumer cannot replace every standard field and control through the same protocol.

### AR-36 — Versioned durable saved views

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Compatibility and migration mechanism within the approved versioned,
  application-persisted view-state policy.
- **Objective:** Restore semantic board presentation across package and data evolution without
  serializing transient runtime objects or functions.
- **Decision:** Version 1 is a bounded, validated plain-JSON envelope with a package discriminator,
  integer schema version, optional caller-facing name, stable-ID column order/visibility/collapse and
  user width overrides, grouping and swimlane visibility/collapse, filters and quick-filter IDs,
  sort, density, card-presentation configuration, and bounded namespaced application extensions.
  Runtime predicates, renderers, comparators, and formatters are referenced only through registered
  stable IDs. Focus, selection, pending operations, editor drafts, cache/window contents, scroll
  offsets, hover expansions, and other session state are excluded; an application may build a separate
  ephemeral resume facility.
- **Compatibility:** Parse/restore validates depth, sizes, discriminators, value types, and IDs before
  use. Known older versions pass through explicit sequential package/caller migration adapters; unknown
  newer versions and unknown required semantics fail with structured sanitized diagnostics. Unknown
  top-level fields are rejected. Missing registry/data IDs are preserved in the bounded raw envelope
  where practical, ignored behaviorally, and reported; current new columns/swimlanes reconcile by a
  documented deterministic append/default policy. Namespaced optional extensions are preserved but
  never executed. Numeric widths remain cell values and clamp only in the runtime projection.
- **Evidence:** Data Grid's `GridVariant` and `resolveVariant` prove app-owned JSON state and
  drop-unknown/append-new reconciliation (`packages/datagrid/src/variant.ts`), while its unversioned
  envelope demonstrates the compatibility gap Kanban must not repeat.
- **Rejected alternatives:** Serializing runtime state creates stale identities and capability-specific
  artifacts. App-defined opaque payloads prevent package-level dialogs, validation, migrations, and
  portable examples.
- **Strongest counterargument:** Excluding focus and scroll prevents exact workspace resumption.
- **Confidence:** High; durable view semantics and ephemeral session restoration have different
  lifetimes and compatibility obligations.
- **Hardening:** The independent challenger converged and added namespaced extension preservation,
  required-versus-optional unknown semantics, and deterministic restoration inputs.
- **Policy version:** 1.
- **Root invocation ID:** `kanban-20260803-01`.
- **Reopen triggers:** A durable approved feature cannot be represented by stable IDs and JSON values,
  or compatibility testing shows lossless bounded preservation prevents safe validation.

### AR-38 — Layered verification and phase gates

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Testing architecture, performance evidence, and implementation verification
  mechanism; product acceptance and release authorization remain user-owned.
- **Objective:** Prove semantic correctness, terminal rendering, modern pointer behavior, bounded
  scale, documentation, and distribution without relying on brittle full-frame snapshots or manual
  impressions.
- **Decision:** Requirements-derived `*.spec.test.ts` files are normative oracles and precede
  implementation tests. They change only with an accepted requirement/AR change, synchronized
  traceability, and review evidence; git history proves creation order. Normative layers cover pure ordering/filter/grouping/placement/migration
  models (including property/fuzz cases), headless keyboard/command/pointer interactions, deterministic
  drag/autoscroll/capture-loss traces with fake clocks, semantic terminal regions and a curated set of
  reviewed golden frames, eager 5,000-card and windowed 100,000-logical-card fixtures, bounded source
  reads/prefetch/cancellation, host integration in browser/xterm, a real Unix PTY, and platform-scoped
  Windows ConPTY-equivalent harnesses (with pipe tests reported separately), public type
  contracts, package-owned dialogs, every docs live example, the dedicated showcase, i18n catalogs,
  and plugin-impact/generated-skill parity.
- **Performance:** Deterministic complexity, allocation, read-window, request-count, and damage-region
  bounds are normative in ordinary tests. A deliberate controlled local benchmark targets median
  render/drag frames at or below 16 ms for an 80×24 visible board after warmup; p95 at or below 33 ms
  is recorded as diagnostic evidence until a stable controlled runner justifies promotion. Shared CI
  does not enforce machine wall-clock timing. No visible operation may scan all 100,000 logical cards.
- **Visual matrix:** Selected semantic frames cover Classic plus representative alternate theme,
  truecolor/256/16/mono/`NO_COLOR`, Unicode and ASCII, standard 80×24, narrow, resize/maximize/restore,
  the longest official translations, hostile text, empty/loading/partial/error, valid/invalid/pending/
  rejected drops, and gutter/swimlane variants. Tests assert named regions, cell geometry, focus, and
  non-color cues; they do not snapshot every animation frame or incidental ANSI sequence. Manual native
  terminal and browser review records host/capability observations but is not a substitute for tests.
- **Phase gate:** Each phase runs the smallest package-local typecheck/tests/docs checks covering its
  behavior, `yarn verify:local`, mapped `yarn plugin:update` review, and `yarn plugin:check`. Docs phases
  additionally run focused docs tests/typecheck/build; CI owns full `yarn verify`. A phase cannot claim
  a behavior whose normative evidence is deferred.
- **Evidence:** `packages/core/test/perf-budget.spec.test.ts` already separates deliberate local 16 ms
  timing assertions from CI and uses warmed medians. Project policy requires spec-first tests,
  generated plugin parity, focused local verification, and CI-owned full verification.
- **Rejected alternatives:** Snapshot-only testing is brittle and misses semantics. Showcase-led manual
  testing cannot prove cancellation, stale work, migration, or bounded reads.
- **Strongest counterargument:** The layered matrix has substantial maintenance cost.
- **Confidence:** High; curated semantic frames and controlled timing keep the cost proportional to
  this flagship component's interaction and compatibility risk.
- **Hardening:** The independent challenger strongly converged and clarified normative deterministic
  bounds versus controlled/informational timing evidence.
- **Policy version:** 1.
- **Root invocation ID:** `kanban-20260803-01`.
- **Reopen triggers:** Host harnesses cannot deterministically deliver pointer sequences, a selected
  golden depends on font pixels rather than terminal cells, or controlled benchmark variance makes the
  stated evidence non-repeatable.

### AR-41 — Responsive layout-DSL mandate

- **Authority:** User decision.
- **Objective:** Make every package-owned surface naturally responsive and consistent with JSVision
  composition instead of accumulating fixed-coordinate layouts that clip when resized or translated.
- **Decision:** Kanban's outer board composition, workflow header band, optional navigator, status and
  feedback bands, empty/loading/error surfaces, standard cards and card sections, editor forms,
  configuration dialogs, confirmation dialogs, docs laboratories, kitchen-sink story, and dedicated
  showcase use the public `col`, `row`, `stack`, `grow`, `fixed`, `spacer`, placement, measurement,
  button-group, and `setLayout`/invalidation contracts to the maximum technically meaningful extent.
  Layout trees express fixed, measured, fractional, conditional, and stacked relationships and are
  re-solved on every relevant viewport, locale, density, visibility, and presentation change.
- **Responsive rule:** No package-owned ordinary content assumes 80×24, its host's complete terminal
  rectangle, one locale's string lengths, or construction-time dimensions. Measured controls use
  terminal display cells; changing geometry invalidates layout; resize/maximize/restore/narrow-mode
  tests exercise the authentic mounted tree.
- **Named exceptions:** Raw cell rectangles are permitted only for a `Window`/`Dialog` frame's desktop
  placement, framework-positioned menus/popups, the virtualized card canvas and sticky-region solver,
  cell-accurate scroll/damage/hit-test maps, and transient drag ghost/insertion layers after the DSL has
  assigned their containing viewport. `stack`/`place` remains preferred for app-authored overlays.
  Every exception must be isolated behind a measured custom `View`, document why DSL flow cannot
  express it, remain parent-interior-relative and clipped, and expose responsive tests. Dialog
  interiors and card content never qualify merely because fixed coordinates are easier.
- **Evidence:** Canonical JSVision guidance says to compose every screen with the layout DSL and limits
  raw rectangles to desktop window placement, framework overlays, and true overlap/pinning that flow
  cannot express (`tools/jsvision-skill/references/layout.md`). The public DSL exports the required
  responsive builders from `packages/ui/src/index.ts` and supports measured `auto`, fixed, fractional,
  constrained growth, padding, gaps, conditional children, and overlays.
- **Strongest counterargument:** A Kanban's two-axis virtualized board and drag hit map require exact
  cell coordinates that ordinary flow containers cannot produce efficiently.
- **Resolution:** Keep that exact geometry inside one measured board-viewport leaf whose surrounding
  chrome, cards' internal composition, dialogs, and overlays remain DSL-driven. This preserves bounded
  rendering without turning the whole component into a hand-positioned canvas.
- **Confidence:** High.
- **Reopen triggers:** A public DSL limitation prevents required responsive composition; the affected
  region must then be documented as a narrow exception and tested at compact, resized, maximized, and
  restored geometry before implementation proceeds.

## Systematic discovery scan

| Category | Result |
|---|---|
| Vision, scope, stakeholders, and ownership | Resolved by AR-1–AR-14 and AR-27. |
| Comparable workflow and presentation behavior | Resolved by AR-15–AR-19 and AR-25–AR-26. |
| Data identity, ordering, scale, and compatibility | Resolved by AR-3–AR-4, AR-10, AR-30, AR-32, and AR-36. |
| End-user, administrator, pointer, keyboard, and SDK journeys | Resolved by AR-8–AR-9, AR-20, AR-29, AR-31, AR-33, AR-37, and AR-39–AR-40. |
| Reactive lifecycle, concurrency, cancellation, and recovery | Resolved by AR-9, AR-21, AR-31–AR-33, and AR-37–AR-39. |
| Responsive geometry, hosting, measurement, and TUI degradation | Resolved by AR-7, AR-19, AR-24–AR-25, AR-34, AR-39–AR-41. |
| Editor schemas, validation, generic extension, and dialogs | Resolved by AR-5, AR-8, AR-20, AR-25–AR-26, and AR-35. |
| Security, host boundaries, diagnostics, and application capabilities | Resolved by AR-22, AR-27, AR-31, and application-owned authority in AR-3. |
| Accessibility, i18n, theme, color-depth, and Unicode behavior | Resolved by AR-12, AR-23, AR-28–AR-29, AR-34, AR-38, and AR-41. |
| Performance, verification, documentation, showcase, and distribution | Resolved by AR-10–AR-14, AR-31, and AR-38. |
| Explicit exclusions and future application boundary | Resolved by AR-15–AR-18 and AR-27. |
| Data/migration lens and public compatibility evolution | Resolved by AR-30, AR-32, AR-35–AR-36, and AR-38. |

The scan found no remaining Maybe-scope item or deferred ambiguity. New semantic choices discovered
during RD authoring must reopen this register before the affected requirement is written.

### AR-42 — Public component, source, request, and package topology

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** New public integration architecture and internal composition mechanism within the
  confirmed package, application-authority, layout-DSL, windowing, dialog, and testing scope. It does
  not change an existing compatibility contract.
- **Objective:** Make the first public surface coherent enough for requirement-level verification
  without turning every logical card into a live view, allocating a column×swimlane source matrix, or
  creating avoidable permanent export entry points.
- **Component decision:** The primary component is `KanbanBoard<TCard>`, a normal DSL-composed `Group`.
  Its responsive bands and state surfaces are ordinary views. It owns one measured
  `KanbanViewport<TCard>` leaf for bounded card projection, sticky-region geometry, two-axis scrolling,
  hit testing, damage, pointer capture, insertion markers, and the drag ghost. Standard and custom card
  renderers produce bounded descriptors with declared/measured density limits; the core never mounts
  one live `View` per logical card. A bounded visible-view recycler may be evaluated later only if it
  proves focus/state isolation and does not become the baseline contract.
- **Source decision:** `KanbanDataSource<TCard>` opens a revisioned `KanbanQuerySession<TCard>` for the
  active filter/group/sort/view query. A session supplies batched board/header/count metadata and
  creates sparse lazy `KanbanCellCursor<TCard>` objects only for visible/prefetched
  `{ columnId, swimlaneId? }` addresses. Cursors expose authoritative total/matching/loaded counts,
  indexed loaded reads, bounded `ensureRange` with cancellation, state/error/retry, revision, and
  source-issued placement anchors/tokens. Eager and windowed helpers satisfy the same contract; no
  implementation allocates or subscribes all theoretical cells.
- **Request decision:** Every application-data mutation path builds a discriminated `KanbanRequest` carrying a unique
  string operation ID, expected board/query/entity revisions, typed payload, and `AbortSignal`, then
  invokes one application `dispatch` seam. Results are atomic accepted/rejected/cancelled/superseded
  outcomes correlated to that ID; extensions use a namespaced custom-request variant. Public commands,
  programmatic column/swimlane/card methods, standard dialogs, context menus, application-store
  saved-view save/rename/delete, and undo/redo adapters
  are typed convenience producers for this same dispatcher and cannot bypass capabilities or
  application authority. Undo is a fresh authorized request using an application-issued token or
  inverse payload, never a component-side model rewind.
  Ephemeral interaction state and durable local semantic view transitions such as saved-view apply,
  hide/collapse, and personalization remain pure; they emit view events but do not dispatch mutations.
- **Terminology and identity:** Public names use `column` only for vertical workflow stages and
  `swimlane` only for horizontal groups; bare `lane` is not exported. Runtime `CardKey` is
  `string | number`, with type-preserving maps so `1` and `'1'` remain distinct. Column, swimlane,
  field, view, renderer/editor registry, operation, checklist, and serialized IDs are bounded strings.
  Ordering remains a required source/adapter semantic rather than a mandatory property name on every
  consumer record. Cross-boundary `PlacementToken` is an opaque branded bounded string scoped to its
  source/query revision; applications encode database-native ordering values behind it and saved views
  never persist it.
- **Export decision:** `@jsvision/kanban` is the canonical side-effect-free main barrel for public pure
  models/codecs, eager helpers, `KanbanBoard`, renderers, and, when their owning RDs introduce them,
  commands/events and standard dialogs. The foundation may depend on `@jsvision/core`, `@jsvision/ui`,
  and `@jsvision/i18n`. RD-10 introduces the Kanban-owned runtime schema adapter, `zod: ^4`, and
  `@jsvision/forms` together when editor/schema code imports their public APIs; internal leaf
  modules never import the barrel. Official catalogs use the repository-standard
  `@jsvision/kanban/locales/<locale>` subpaths. Deterministic public harnesses and fixture builders use
  `@jsvision/kanban/testing` so production imports do not pull them in. No `/model` or `/dialogs`
  subpath is created initially; tree-shaking and `sideEffects: false` keep unused dialog runtime out of
  consumer bundles without multiplying compatibility surfaces.
- **Evidence:** Data Grid and Code Editor publish a canonical main barrel plus genuine locale/language/
  host subpaths, declare `sideEffects: false`, and rely on stable-key windowing. JSVision's layout DSL
  supports a measured custom leaf inside responsive flow. The application-owned request requirement
  rules out direct component mutation.
- **Rejected alternatives:** A monolithic custom view violates the DSL mandate for ordinary chrome and
  dialogs. One view per card cannot meet the logical scale target. Eager per-cell sources create an
  unbounded object/subscription matrix. Separate action callbacks drift in revision, cancellation, and
  atomicity behavior. `/model` and `/dialogs` add permanent entry points without a current host or
  dependency boundary that requires them.
- **Strongest counterargument:** A descriptor viewport is a second, constrained rendering abstraction,
  and a single main barrel makes headless model imports appear coupled to UI/dialog dependencies.
- **Confidence:** High for component/request/terminology, medium-high for the sparse session source and
  barrel topology; both are covered by explicit dependency and scale tests.
- **Hardening:** The independent challenger converged on the board/viewport split and atomic dispatcher,
  recommended a board-wide source and more public subpaths, and surfaced N×M and dependency risks. The
  reconciled sparse query-session design adopts its batching/cancellation safeguards while the main
  barrel plus testing/locales subpaths follows stronger repository precedent.
- **Policy version:** 1.
- **Root invocation ID:** `kanban-20260803-01`.
- **Reopen triggers:** The main barrel measurably prevents tree-shaking, sparse cursors cannot express
  independent cell failure/retry without hidden subscriptions, descriptor renderers cannot support
  the approved custom card surface, or package dependency checks reveal a cycle.

### AR-43 — Centralized public defaults and safety limits

- **Authority:** AI — delegated by `--auto-design` during RD authoring.
- **Eligibility:** Reversible technical defaults, input/resource bounds, and key-routing mechanics within
  already approved behavior. Applications may lower limits or explicitly override bindings; raising a
  hard safety ceiling requires measured evidence and compatibility review.
- **Objective:** Remove plan-time guesswork, make acceptance tests concrete, and keep dense terminal UI,
  windowed work, saved artifacts, and async extensions bounded.
- **Decision:** RD-14 owns one exported/documented limits manifest. Every row declares a safe default,
  ordinary configurable ceiling, and absolute maximum; immutable ID/token/standard-row/custom-descriptor
  bounds repeat the same value in all classes. It additionally bounds source columns, source swimlanes,
  retained cursors, and one `ensureRange` span. Search debounce is 150 ms. Drag uses the approved one-cell threshold, one-cell
  hysteresis, the original two-speed autoscroll zones, and 500 ms collapsed-swimlane hover expansion.
  AR-46 supersedes only the autoscroll activation and cadence defaults after native-terminal evidence.
- **Default keys:** arrows, Home/End, PageUp/PageDown and Primary+Home/End navigate; Enter opens/drops;
  Space toggles selection; Shift+navigation extends a cell-local range; Primary+A selects loaded visible
  matching cards; Primary+F focuses search; Insert creates a card; Alt+M starts keyboard grab/move; Esc
  cancels/clears; Shift+F10 opens context actions; F1 opens help; Primary+Z/Primary+Y request undo/redo.
  Primary is Command on capable macOS browser hosts and Ctrl elsewhere/native.
  Destructive and board-configuration commands are exported but unbound by default.
- **Evidence:** The defaults fit the approved 80×24/18-cell geometry, 5,000/100,000 scale split, one-row
  drop targets, JSVision key/event conventions, and bounded async/saved-input security requirements.
  Conservative limits prevent hidden full-data work while remaining above mainstream card metadata needs.
- **Strongest counterargument:** Real applications may require more checklist items, selected cards, token
  bytes, or concurrent loads, and some terminals reserve Alt/Shift function-key routes.
- **Resolution:** Limits use the exact RD-14 default/standard/absolute classes;
  capability/keymap validation reports unavailable routes and applications may override exact bindings.
  Server-wide selection remains an application token rather than expanding the in-memory set.
- **Confidence:** Medium-high; controlled scale/host prototypes are reopen triggers before the defaults are
  frozen in a stable release.
- **Hardening:** Both prior challengers identified unbounded renderer/source/async/public-compatibility
  risks. This centralized manifest applies those safeguards consistently instead of scattering magic
  numbers across components.
- **Policy version:** 1.
- **Root invocation ID:** `kanban-20260803-01`.
- **Reopen triggers:** Phase-A/C prototypes demonstrate clipped mandatory content, measurable starvation,
  unavoidable host key conflicts, or a security/performance failure at a stated bound.

### AR-44 — Compact title-only card drag ghost

- **Authority:** User — approved during native visual review after Phase C implementation.
- **Objective:** Keep pointer drag feedback recognizable and contemporary without wasting a terminal row or
  obscuring the target beneath an oversized lifted card.
- **Decision:** A card drag ghost is one compact framed title row and, for an atomic multi-card drag, one
  bounded selected-count cue. It contains no separate status row and no blank trailing row. The title remains
  sanitized, display-cell bounded, clipped to the viewport, and positioned from the pointer-relative grab
  offset. Existing Unicode/ASCII, monochrome/color, border, source-placeholder, and target-gap cues remain.
- **Evidence:** The user manually reviewed the implemented title/status form, reported the unnecessary row,
  approved the compact title-only correction, and subsequently accepted the stabilization preflight's
  traceability synchronization.
- **Rejected alternative:** Restoring the earlier title/status fragment would reverse the later approved
  native visual result without adding information needed to identify the moving card.
- **Confidence:** High; this is a direct recorded user choice and the current renderer/specification already
  implement it.
- **Reopen triggers:** Multi-card identity becomes ambiguous in native review, title-only fallback becomes
  unrecognizable in a supported capability profile, or the user requests richer drag content.

### AR-45 — Bounded application-neutral card accents

- **Authority:** User — explicitly authorized during the T-03 Iteration-2 preflight scope gate.
- **Objective:** Keep the showcase and consumer boards colorful while preserving truthful state semantics,
  accessibility cues, and compatibility for existing `KanbanTheme` values.
- **Decision:** Add exactly four generic roles, `card.accent-1` through `card.accent-4`. They communicate
  application-owned visual grouping only and never imply read-only, warning, error, WIP, or operation state.
  Accent entries are optional at the caller-input boundary so existing complete theme literals continue to
  typecheck; `createKanbanTheme` produces all four, and missing accents resolve to `card.normal` with bounded
  fallback evidence. `contractVersion: 1` remains. Focus/selection compose through border, title, attributes,
  and non-color cues while retaining the accent surface. Exact status remains bounded visible text and a
  non-color cue across every supported color/glyph profile.
- **Evidence:** The closed inventory contains only one neutral normal surface; the existing GitHub demo obtains
  four colors by repurposing read-only, WIP-warning, and WIP-error roles whose names, Core fallbacks, and cues
  carry false semantics. One neutral surface cannot meet the user's explicit colorful-showcase outcome.
- **Rejected alternatives:** State-role repurposing is semantically and accessibly false. One surface plus
  text/glyph cues is truthful but fails the approved showcase outcome. A general custom-token registry is a
  materially larger compatibility and validation surface than four bounded accents.
- **Strongest counterargument:** Four roles enlarge the public union and are less flexible than arbitrary
  application tokens.
- **Confidence:** High; the bounded addition is the smallest option satisfying truthful semantics, color,
  compatibility, and terminal fallbacks.
- **Hardening:** The independent Iteration-2 challenger converged and required legacy fallback plus preserving
  accent surfaces across focus/selection.
- **Policy version:** 1.
- **Root invocation ID:** `kanban-t03-preflight-20260812`.
- **Reopen triggers:** Existing theme literals fail source/runtime compatibility, four accents cannot retain
  readable fallbacks in a supported profile, or a future separately approved generic token API supersedes
  the bounded inventory.

### AR-46 — Terminal-safe drag autoscroll cadence

- **Authority:** AI — delegated by `--auto-design` during execution remediation.
- **Eligibility:** Reversible interaction timing and performance engineering inside the already approved
  four-edge, two-speed autoscroll behavior; no product capability, scope, or compatibility boundary changes.
- **Objective:** Preserve web-like hold-to-scroll behavior without letting large terminal repaints starve
  pointer-up, keyboard, or quit input.
- **Decision:** A directional edge dwell arms for 250 ms, then advances at a fixed 125 ms cadence. The outer
  zone retains its two-cell step and the inner zone its one-cell step. Same-direction reprojection and
  slow/fast changes retain the current activation phase; leaving all zones, reversing direction, changing
  generation, or ending capture cancels synchronously and a later edge dwell rearms.
- **Evidence:** Native 248×54 testing reproduced a scrolled drag returning to row zero in under 500 ms while
  the prior 50 ms loop emitted up to 20 large repaint frames per second. The fixed cadence caps repeated work
  at eight frames per second while keeping deterministic target recomputation after every successful step.
- **Rejected alternatives:** Adaptive render-duration timing is nondeterministic and adds complexity before
  fixed backpressure has been measured. Disabling edge autoscroll or reducing every step to one cell removes
  approved behavior or needlessly discards the two-speed zones.
- **Strongest counterargument:** The initial 250 ms dwell and 8/16 cells-per-second steady speeds feel slower
  than a web board when traversing a very long lane.
- **Confidence:** High for preventing the reproduced repaint flood; native acceptance remains the reopen gate
  for perceived speed.
- **Hardening:** An independent blind challenger approved the fixed cadence and required explicit arming versus
  steady ownership so reprojection cannot postpone activation and direction reversal cannot inherit a timer.
- **Policy version:** 1.
- **Root invocation ID:** `kanban-t03-runtime-20260812`.
- **Reopen triggers:** Native acceptance finds ordinary long-lane traversal too slow, a supported host still
  starves input at eight frames per second, or measured host backpressure supports a simpler stronger cadence.

## Auto-design context

- **Authority:** Eligible technical design decisions may be resolved by AI under `--auto-design`.
- **Delegated categories:** Algorithms, data structures, internal/public integration mechanisms,
  failure/recovery mechanisms within approved behavior, compatibility mechanisms within the approved
  versioned-state policy, testing strategy, performance engineering, and implementation sequencing.
- **Reserved categories:** Product behavior and scope, priorities and acceptance criteria, data
  ownership/retention, access/security policy, legal/compliance/risk acceptance, public compatibility
  breaks, destructive actions, publication/deployment, and external communication.
- **Permission state:** Unchanged; requirements artifacts only.
- **User boundary:** Choices must remain visually and technically feasible in a TUI and must not
  clutter the board, cards, dialogs, or included configuration surfaces.
