# Ambiguity Register: Component Documentation System

> **Document**: 00-ambiguity-register.md
> **Plan**: component-documentation-system (feature: docs-website, RD-05)
> **Gate status**: ✅ GATE PASSED — 2026-07-29
> **Last updated**: 2026-07-29

This register records every material decision that the RD-05 refresh and implementation plan will
rely on. `AR-N` identifiers are local to this plan. Rows sourced from the requirements register or
the user's accepted five-part direction are authoritative. Repository review and preflight resolved
the planning decisions before execution; delegated runtime decisions are appended with full
provenance when real integration evidence requires them.

## Legend

Status: ✅ Resolved · ⏳ Open. Source: `requirements` = inherited from the docs-website requirements
register; `accepted-five` = explicitly accepted by the user on 2026-07-29; `template directives` =
the user-approved `AGENTS.md` documentation templates; `inventory` = repository evidence that does
not require a product choice; `preflight` = a user-authorized technical remediation selected during
the formal plan audit; `runtime-auto-design` = an implementation mechanism selected under the
user-delegated auto-design policy.

## Register

| ID | Category | Question / ambiguity | Resolution or recommendation | Status | Source |
|---|---|---|---|---|---|
| AR-1 | Scope | Which requirement and feature own this work? | Refresh **RD-05** in the `docs-website` feature and create the `component-documentation-system` plan. | ✅ | accepted-five |
| AR-2 | Scope | What counts as component-documentation coverage? | Cover every public, user-facing visual component and major application surface. Keep non-visual helpers, value types, algorithms, controllers, and engines in guides or generated API reference unless they are needed to explain a visual surface. | ✅ | accepted-five |
| AR-3 | Existing content | Are Button, Input, and Text considered complete by default? | Treat Button, Input, and Text as the newly completed reference implementations, subject only to catalog/structural integration checks. Upgrade every other existing component page **and rebuild every other existing component live example to `template1`**. | ✅ | session |
| AR-4 | Page contract | What is the standard component-page structure? | Use `component-page-template1`: description and import/usage, one or more live examples, Props, Size and Layout, component-specific sections (each allowed multiple focused live examples), Best Practices, Theming, Related/API links. Snippets stay minimal and teach one concept. | ✅ | template directives |
| AR-5 | Live-example presentation | How are standard component examples presented? | Use `template1`: Classic theme, full application shell, menu-bar-matching window background, centered non-full-screen dialog, and dialog padding `1`. | ✅ | template directives |
| AR-6 | Large components | Do Data Grid and Code Editor use one long component page? | No. Give each a dedicated documentation hub with its own prefix-specific sidebar and multiple topic pages containing focused live examples. Minor topic regrouping is allowed when source inventory shows a clearer boundary. | ✅ | accepted-five |
| AR-7 | Data Grid scope | Which grid surfaces are taught in the specialist hub? | One unified Data Grid hub teaches both `@jsvision/ui` `DataGrid` and `@jsvision/datagrid` `EditableDataGrid`, including the public visual composition surfaces where relevant. Base read-only concepts precede editable/enterprise capabilities. | ✅ | accepted-five |
| AR-8 | Code Editor scope | Which editor surfaces are taught in the specialist hub? | The Code Editor hub covers `CodeEditor` and `CodeEditorWindow`; document/controller, language, LSP, lifecycle, safety, and theme APIs appear as supporting concepts rather than standalone component pages. | ✅ | accepted-five |
| AR-9 | Example sources | Can docs pages embed the kitchen-sink/showcase registries directly? | No. Preserve the existing decision that docs examples are separate, compiled, smoke-tested modules. Adapt representative scenarios from the **67 shipped Data Grid stories** and the Code Editor catalog's **20 ordinary + 11 QA scenarios**, keeping each docs example focused and maintainable. | ✅ | requirements + inventory |
| AR-10 | Catalog | What is the source of truth for coverage and navigation? | Add a machine-readable catalog consumed by structural tests and sidebar generation/validation. It records package, public symbols, family, documentation target, complexity (`standard`, `data-grid-hub`, `code-editor-hub`), example IDs, and related/API targets. | ✅ | accepted-five |
| AR-11 | Maturity labels | Should pages display stable/experimental/planned badges? | No visible maturity badges until the project has an authoritative stability policy. The catalog must not invent maturity claims. This supersedes the old RD-05 badge requirement. | ✅ | accepted-five |
| AR-12 | Sidebar coverage | What happens to missing public visual surfaces? | Add every cataloged documentation target to navigation. The inventory must account for missing shell/spine, controls, containers, editor, files/forms, Data Grid, and Code Editor surfaces; no cataloged target may be orphaned. | ✅ | accepted-five |
| AR-13 | Props and interaction accuracy | What is authoritative for props, defaults, keyboard, and mouse behavior? | Public barrels, exported option types, implementation defaults/key handling, and generated TypeDoc are authoritative. Hand-written prose and snippets must be cross-checked against them. | ✅ | inventory |
| AR-14 | Testing | How is the richer contract enforced? | Specification tests validate catalog schema/parity, required page backbone, live-example registration, sidebar reachability, related/API links, and specialist-hub topology. Existing example compile, headless smoke, snippet drift, link, and docs-build gates remain in force. | ✅ | accepted-five + requirements |
| AR-15 | Performance and accessibility | How can pages contain many live examples safely? | Continue lazy example loading; do not mount every specialist example eagerly. Every live example retains DOM prose/source context, labelled keyboard-operable controls, sanitization boundaries, and a non-live fallback. | ✅ | requirements |
| AR-16 | Verification | What is the completion gate? | Use focused docs-site tests while iterating and `yarn verify` as the authoritative final gate. | ✅ | accepted-five + project guidance |
| AR-17 | Specialist routes and compatibility | What routes should the new hubs use, and what happens to old links? | Use `/components/data-grid/` and `/components/code-editor/`, each with nested topic pages and its own sidebar. Remove the old/broken Data Grid and Code Editor pages instead of retaining compatibility pages. Update all internal links as part of the replacement. | ✅ | session |
| AR-18 | Documentation-unit granularity | Must every exported visual class have a separate Markdown file? | Use one page per primary standard component, while tightly coupled public subcomponents may map to a clearly anchored section in the owning page or specialist hub. Every cataloged symbol still needs an exact documentation target; this avoids shallow pages for pieces such as grid bands/popups that only make sense in composition. | ✅ | session |
| AR-19 | Example ownership | Must every cataloged symbol have a unique live-example module? | Every primary standard component page owns at least one registered primary example. A focused example may cover multiple tightly coupled symbols, and specialist topic pages may contain several examples; every cataloged symbol must map to at least one example, but duplicate demos are not required. | ✅ | session |
| AR-20 | Documentation source | Are page snippets extracted from full runnable modules? | No. Registry `sourcePath` identifies the compiled runnable module. Markdown snippets remain separately authored, essence-only teaching artifacts and must not paste or extract a whole example module. | ✅ | preflight |
| AR-21 | Runtime interaction | Which accelerator can focus the vertical Slider without conflicting with the Classic application shell? | Use **Alt+T** on “verTical.” Alt+V is already owned by the always-present View menu and opened that menu instead of focusing the slider. | ✅ | runtime-auto-design |
| AR-22 | Runtime interaction | How should the Menu Bar example execute an item accelerator through the real menu state machine? | Use **Alt+L** to open the example's top-level File menu, then plain **O** to activate Open. Alt+O cannot directly target a submenu item while the menu is closed. | ✅ | runtime-auto-design |
| AR-23 | Runtime verification | How should the Code Editor template specification observe maximize and restore? | Flush the existing deferred render/layout root after each `Template1Dialog.zoom()` before inspecting bounds. This preserves the established asynchronous layout contract and matches the shared template1 specifications; it does not require a new synchronous dialog behavior. | ✅ | runtime-auto-design |
| AR-24 | Live-example fidelity | What evidence must a Code Editor lab expose for its learning objective? | Drive the public editor/controller/service/host input path itself and assert its public state. Status text and docs-only probes may summarize that evidence, but may not substitute for clipboard output, document lifecycle, adapter state, search presentation, protocol results, theme reports, viewport input, or recovery state. | ✅ | runtime-auto-design |
| AR-25 | Flagship presentation | How should Code Editor examples communicate a capability at first glance? | Treat Code Editor as a flagship surface. Start its examples maximized, use substantial scenario-relevant source instead of one- or two-line fixtures, run the real built-in language adapter so syntax highlighting is visible on first render, replace generic actions with capability-specific teaching controls, and show human-readable evidence beside the editor. Establish the pattern with completion, diagnostics, and language-folding pilots; obtain visual approval before applying it to the remaining examples. | ✅ | session |
| AR-26 | Flagship migration | How should the approved Code Editor presentation scale across the remaining examples? | Use one responsive lesson shell with scenario-specific source, named actions, teaching cues, and native evidence; keep lifecycle/reset/disposal shared. | ✅ | session + runtime-auto-design |
| AR-27 | DOM verification seam | How should PlayExample expose deterministic terminal and resize dependencies to DOM tests? | Resolve a typed runtime through a Vue injection key with a browser-production default. Tests provide a mount-scoped runtime; no test-only prop or mutable module-global override enters the component API. | ✅ | runtime-auto-design |
| AR-28 | Lazy launcher cancellation | How should PlayExample close safely while browser chunks or an example module are still loading? | Give both the launcher and plain-TS controller lifecycle generations. Publish the opening session before awaiting it, keep the opening terminal disposable, reject stale continuations before mount, surface startup failures in the existing alert, and validate persisted cell dimensions before terminal allocation. | ✅ | runtime-auto-design |

### AR-21 delegated decision provenance

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** The accelerator letter is a reversible implementation mechanism inside the
  approved Slider example; it changes neither component behavior nor documentation scope.
- **Objective:** Every template1 example must expose usable hotkeys while retaining the Classic
  application shell.
- **Decision:** Mark the `T` in “verTical” and drive the vertical-slider behavior case with Alt+T.
- **Evidence:** The focused controls specification rendered the View menu after Alt+V and left the
  vertical value at `50`; the shell always includes that menu.
- **Rejected alternatives:** Keep Alt+V was rejected because it is unreachable; use Tab alone was
  rejected because the example explicitly teaches linked-label accelerators; change the View menu
  was rejected as out of scope and a public shell compatibility change.
- **Strongest counterargument:** Alt+T is less mnemonic than the initial letter. The visible tilde
  accent and on-screen instruction make the route discoverable.
- **Confidence:** High — the conflict reproduced through the real shell and Alt+T is unclaimed in
  this dialog.
- **Hardening:** The replacement preserves the same real focus-and-step behavior and is covered by
  the executable contract.
- **Policy version:** 1.
- **Root invocation ID:** `component-documentation-system-2026-07-29`.
- **Reopen triggers:** The Classic View accelerator changes, or another control in the Slider
  example claims Alt+T.

### AR-22 delegated decision provenance

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** The input sequence is a reversible test/example mechanism within the approved
  Menu Bar behavior; it changes neither the public API nor documentation scope.
- **Objective:** Exercise real top-level and item accelerator behavior with visible command feedback.
- **Decision:** Mark the `l` in the top-level `Fi~l~e` menu; drive it with Alt+L followed by plain O
  for `~O~pen`.
- **Evidence:** `MenuBar.onEvent` routes Alt+letter to `topHotkey`, while a plain letter reaches
  `itemHotkey` only when a controller is already open.
- **Rejected alternatives:** Map Alt+O through the application keymap was rejected because it would
  bypass MenuBar; label the top-level title Open was rejected because it would demonstrate opening
  a menu, not activating an item; use mouse-only activation was rejected because the contract
  explicitly teaches keyboard navigation.
- **Strongest counterargument:** Two keystrokes are slower than a global accelerator. They accurately
  expose the menu hierarchy, and the application can separately add a global chord when its product
  design calls for one.
- **Confidence:** High — the source defines separate closed/open routing paths and existing menu
  specifications exercise the same sequence.
- **Hardening:** The behavior contract dispatches both events through the real application loop and
  requires the emitted command's visible result.
- **Policy version:** 1.
- **Root invocation ID:** `component-documentation-system-2026-07-29`.
- **Reopen triggers:** MenuBar gains direct closed-state item accelerators or the File top-level
  accelerator conflicts with future shared chrome.

### AR-23 delegated decision provenance

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** The verification synchronization mechanism is a reversible testing decision
  inside the approved responsive-dialog behavior and changes no product behavior or acceptance
  criterion.
- **Objective:** Verify maximized and restored geometry only after the UI has applied the requested
  layout.
- **Decision:** Flush the real render root after each direct `zoom()` call before collecting bounds
  and responsive-layout evidence.
- **Evidence:** `Window.zoom()` requests layout through `setLayout`; the established shared,
  primitive, and Data Grid template specifications all flush before inspecting new geometry.
- **Rejected alternatives:** Make `Template1Dialog.zoom()` synchronously mutate settled bounds was
  rejected because it would change the shared UI scheduling contract; weaken maximize assertions was
  rejected because exact desktop bounds are required.
- **Strongest counterargument:** The extra flush makes the test aware of the rendering scheduler.
  That scheduler is already the public headless verification boundary used by the rest of the suite.
- **Confidence:** High — the same pattern is green across all existing responsive examples.
- **Hardening:** The test still inspects exact maximized bounds and exact compact restore geometry.
- **Policy version:** 1.
- **Root invocation ID:** `component-documentation-system-2026-07-29-phase-10`.
- **Reopen triggers:** `Window.zoom()` becomes synchronous or the headless render API changes.

### AR-24 delegated decision provenance

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** This strengthens reversible documentation fixtures and tests without changing
  public SDK behavior, page topology, or the approved example population.
- **Objective:** Make every Code Editor live-example claim demonstrably true through the public
  surface it teaches.
- **Decision:** Replace synthetic state transitions with real keyboard, mouse, clipboard, document,
  language-scheduler, search, LSP, theme-resolution, host-authorization, and recovery operations;
  retain probes only as content-free projections of those results.
- **Evidence:** The independent Phase 10 review found status-only paths that passed their own probe
  assertions without exercising the promised behavior. The corrected tests inspect public
  controller, editor, coordinator, clipboard, theme, viewport, and degradation state.
- **Rejected alternatives:** Weaken the page claims was rejected because the approved hub is meant
  to demonstrate these capabilities; retain probe-only checks was rejected because they cannot
  detect divergence from SDK behavior.
- **Strongest counterargument:** The shared lab becomes more involved. Common Template1 geometry
  remains centralized, while each scenario still performs one bounded teaching action.
- **Confidence:** High — each corrected path uses an existing public API already covered by package
  specifications.
- **Hardening:** Focused tests rebuild every case and assert both behavior contracts and the relevant
  public state; the authoritative repository gate remains mandatory.
- **Policy version:** 1.
- **Root invocation ID:** `component-documentation-system-2026-07-29-phase-10`.
- **Reopen triggers:** A public Code Editor input/state contract changes or a live-example claim no
  longer maps to executable public evidence.

### AR-25 decision provenance

- **Authority:** User approval on 2026-07-29; implementation mechanisms delegated by
  `--auto-design`.
- **Objective:** Make the flagship Code Editor immediately recognizable as a capable,
  syntax-aware development surface whose focused examples explain what to try and what changed.
- **Decision:** Use maximized `template1` dialogs, meaningful multi-line fixtures, real initial
  syntax analysis, feature-named actions, and visible human-readable results. Pilot completion,
  diagnostics, and language folding before migrating the remaining examples.
- **Evidence:** The existing shared lab gives most scenarios the same three-line TypeScript
  document, generic “Run check” and “Focus editor” controls, and a fixed
  language/revision/selection inspector. Assigning `languageId` alone does not populate the
  controller's syntax result.
- **Rejected alternatives:** Retaining the generic lab with richer prose was rejected because the
  visible examples would still look alike; synthetic coloring was rejected because it would not
  demonstrate the shipped language adapters; converting all 21 examples before a visual checkpoint
  was rejected because an unreviewed presentation pattern would be expensive to unwind.
- **Strongest counterargument:** Maximized startup and larger fixtures consume more terminal space.
  The Code Editor is a workspace component whose legibility and syntax presentation directly
  benefit from that space.
- **Confidence:** High — the user explicitly approved both the flagship direction and maximized
  startup.
- **Hardening:** The pilot spans three distinct presentation families: assistance, diagnostics,
  and structural transformation.
- **Reopen triggers:** The pilots fail visual review, a built-in adapter cannot provide stable
  first-render syntax, or the maximized layout obscures the teaching controls.

### AR-26 decision provenance

- **Authority:** User approval on 2026-07-29; implementation mechanisms delegated by
  `--auto-design`.
- **Eligibility:** This selects an internal presentation architecture for the already-approved 21
  Code Editor examples without changing their routes, learning objectives, or public SDK behavior.
- **Objective:** Apply the visually approved flagship quality to every remaining Code Editor
  example while keeping each capability understandable at first glance.
- **Decision:** Replace the remaining generic presentation through one shared responsive lesson
  shell and three bounded scenario cohorts: foundation/lifecycle, languages/search, and
  platform/safety. Each scenario supplies substantial language-appropriate source, a named action,
  concise Try/Result/Look-for teaching copy, and native editor evidence. Large capabilities remain
  separate examples.
- **Evidence:** The user approved the completion, diagnostics, and folding pilots but found the
  other examples visually indistinguishable. The existing generic builder already owns the real
  capability actions, so retaining those public paths while replacing tiny shared source and
  generic chrome minimizes behavioral risk.
- **Rejected alternatives:** One kitchen-sink example was rejected because it hides individual
  capabilities; duplicating 18 complete builders was rejected because shared lifecycle and
  Template1 behavior would drift; prose-only changes were rejected because the editor surface
  would still look unchanged.
- **Strongest counterargument:** A shared shell can make lessons feel formulaic. Scenario-specific
  source, action labels, native state, and teaching cues provide the variation while shared
  geometry/reset/disposal remain consistent.
- **Confidence:** High — the user explicitly approved the pilot pattern and the existing actions
  already pass public-state behavior contracts.
- **Hardening:** Immutable specs cover every non-pilot ID, require substantial source and named
  actions, and inspect capability-specific native output; independent review checks the full
  migration diff.
- **Policy version:** 1.
- **Root invocation ID:** `component-documentation-system-2026-07-29-phase-10.7`.
- **Reopen triggers:** A migrated example cannot expose meaningful native state, the shared shell
  obscures a capability, or fixture size makes the maximized workspace hard to scan.

### AR-27 delegated decision provenance

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** The dependency-injection mechanism is a reversible internal testing and
  architecture choice inside the approved DOM verification scope; it does not change live-example
  behavior, routes, or acceptance criteria.
- **Objective:** Exercise PlayExample through a deterministic DOM oracle without eagerly loading
  xterm or sharing mutable test state.
- **Decision:** Export a typed Vue injection key and browser runtime. PlayExample resolves the
  injected value with the browser runtime as its production default; each DOM test provides a
  mount-scoped replacement.
- **Evidence:** PlayExample currently constructs xterm, addons, the controller, and ResizeObserver
  inside the SFC. The DOM oracle needs to count lazy construction, mount/disposal, reset, and
  resize behavior without WebGL or browser-layout nondeterminism.
- **Rejected alternatives:** A runtime prop was rejected because it exposes test plumbing as
  component API; a module-global setter was rejected because concurrent mounts/tests can leak state;
  mocking every dynamic import was rejected because it couples the oracle to bundler internals and
  cannot cleanly own ResizeObserver construction.
- **Strongest counterargument:** Vue injection adds one indirection to a previously local
  implementation. The runtime stays small and typed, and the default preserves the existing
  production call path.
- **Confidence:** High — Vue already owns the component lifecycle and mount-scoped providers are
  directly supported by Vue Test Utils.
- **Hardening:** The DOM specification asserts no construction before activation, one open,
  reset/remount, observer ownership, and unmount disposal; existing controller tests continue to
  exercise real headless terminals.
- **Policy version:** 1.
- **Root invocation ID:** `component-documentation-system-2026-07-29-phase-11`.
- **Reopen triggers:** PlayExample moves out of Vue, multiple launchers must intentionally share
  one runtime instance, or production SSR cannot resolve the default without browser effects.

### AR-28 delegated decision provenance

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Cancellation and persisted-size validation are reversible internal lifecycle
  hardening inside the approved Play DOM verification scope.
- **Objective:** Ensure close/unmount is final even when runtime chunks or the selected example
  module settle later, without making xterm eager.
- **Decision:** Track lifecycle generations in both PlayExample and PlayController. The launcher
  exposes its opening session to close immediately; the controller retains the opening terminal so
  close can dispose it across the asynchronous module-load boundary. Late continuations check their
  generation before mounting. Persisted dimensions must be positive safe integers and are clamped
  to 40×12 through 240×80 cells before allocation.
- **Evidence:** Independent review reproduced a close-during-create/open race, unhandled runtime
  import rejection, and unbounded same-origin storage input. Focused DOM and controller tests now
  cover pending creation, pending open, immediate disposal, late resolution, rejected startup,
  real deferred import factories, keyboard activation, and malformed/oversized dimensions.
- **Rejected alternatives:** Waiting for pending work before closing leaves a hidden live terminal;
  an `AbortSignal` alone cannot cancel JavaScript module imports and would not dispose an already
  created terminal; trusting same-origin storage would leave allocation controlled by mutable
  browser state.
- **Strongest counterargument:** Two generation counters duplicate lifecycle state. They protect
  different ownership boundaries: Vue owns the modal/session, while PlayController owns the
  terminal and module-load await.
- **Confidence:** High — cleanup is asserted before the delayed load resolves, and stale resolution
  cannot remount.
- **Hardening:** DOM and plain-TypeScript regression tests exercise both async boundaries, error
  presentation, dimension validation, and idempotent teardown.
- **Policy version:** 1.
- **Root invocation ID:** `component-documentation-system-2026-07-29-phase-11`.
- **Reopen triggers:** The controller gains a cancellable module loader, Play sessions become
  shareable across launchers, or supported terminal dimensions change.

## Inventory evidence

| Surface | Current evidence | Planning consequence |
|---|---|---|
| Existing component content | 33 Markdown files under `components/`; only Button, Input, and Text currently follow the richer template closely. | Audit 3 pages and migrate the remaining standard pages in bounded family waves. |
| Live component examples | 7 component-oriented examples are registered; 22 pages render `PlayComingSoon`, and Tabs has no Play block. | Example authoring is the dominant standard-page workload. |
| Missing standard surfaces | Public barrels expose undocumented shell/spine, control, container, editor, and file components, including `View`, `Group`, `Window`, `Desktop`, `MenuBar`, `StatusLine`, `MultiCheckGroup`, `ListView`, `SplitView`, `Indicator`, `ChDirDialog`, and the composable file views. | The catalog and sidebar work must precede page migration so the target set is explicit and testable. |
| Data Grid | The UI and editable grid packages expose two primary grids plus composable public visual surfaces; the showcase registry contains 67 shipped stories across 14 capability clusters. | Use a multi-page hub and select representative focused examples rather than copying the whole showcase. |
| Code Editor | The package exposes `CodeEditor` and `CodeEditorWindow`, supported by document, language, LSP, lifecycle, degradation, observability, and theme systems; its scenario catalog contains 20 ordinary and 11 QA scenarios. | Use a multi-page hub with 21 capability-selected docs examples distributed across component-specific topics. |

## Gate confirmation

Every row is resolved. The user accepted AR-18 through AR-20, replaced AR-17's compatibility-page
recommendation with direct removal, clarified AR-3's example-migration scope, and authorized the
preflight remediation set on 2026-07-29.

**✅ GATE PASSED**
