# RD-05: Component Documentation System

> **Document**: RD-05-component-docs.md
> **Status**: Approved
> **Created**: 2026-07-09
> **Revised**: 2026-07-29
> **Project**: jsvision
> **Feature-Set**: docs-website
> **Depends On**: RD-03 (live-example system), RD-06 (generated API reference)
> **CodeOps Skills Version**: 3.3.2

---

## Feature Overview

Build a complete, maintainable component-learning system for JSVision. A component page is not a
symbol dump: it explains why and when to use the component, demonstrates its behavior live, documents
its public configuration and layout contract, teaches its distinctive capabilities through focused
sections and snippets, and finishes with practical guidance, theming, related components, and API
links.

Standard components use the `component-page-template1` page directive and the `template1` live-example
directive recorded in `AGENTS.md`. Button, Input, and Text are the completed reference pages/examples.
Every other existing component page is upgraded, and every other existing component live example is
rebuilt to `template1`.

Data Grid and Code Editor are too broad for one “everything” demo or one long page. Each becomes a
dedicated multi-page hub with a prefix-specific sidebar and multiple focused live examples distributed
through its capability pages. The old Data Grid and Code Editor pages are removed and all internal
links are updated to the new hubs.

Coverage is governed by one machine-readable catalog of public user-facing visual components and major
application surfaces. Non-visual helpers, value types, algorithms, controllers, and engines remain in
guides or generated API reference unless they are necessary to teach a visual component. The catalog
does not publish maturity labels until JSVision has an authoritative stability policy.

---

## Definitions

| Term | Meaning |
|---|---|
| **Primary component** | A public visual component or major application surface that deserves a standard page or specialist-hub landing/topic page. |
| **Coupled subcomponent** | A public visual piece that is meaningful mainly inside a primary component, such as a Data Grid band or popup. It may target a stable anchored section instead of receiving a shallow standalone page. |
| **Standard page** | A page following `component-page-template1`, normally with one flagship `template1` example and additional focused examples where useful. |
| **Specialist hub** | A dedicated multi-page documentation area for Data Grid or Code Editor, with its own sidebar and examples distributed by capability. |
| **Catalog** | The machine-readable coverage and navigation source. Component entries own public visual symbols and their documentation targets; specialist topic entries own hub routes, page profiles, examples, and navigation relationships. |
| **Specialist page profile** | One of `landing`, `capability`, or `api`; each profile has its own enforceable teaching-page backbone and example rule. |

---

## Functional Requirements

### Must Have

- [ ] **One enforceable component-page contract.** Every standard page follows
      `component-page-template1`:
      1. title, concise description, and focused import/usage snippet;
      2. one flagship live example, with more focused examples where the component needs them;
      3. Props / public state;
      4. Size and Layout;
      5. component-specific capability sections, each allowed multiple live examples;
      6. Best Practices;
      7. Theming;
      8. Related components and generated API links.
- [ ] **Focused snippets.** A snippet demonstrates only the concept discussed in its section. It need
      not be runnable, but it must show the essential API without unrelated shell, layout, or state
      machinery.
- [ ] **One enforceable live-example presentation.** Standard component examples use `template1`:
      Classic theme, a complete application shell, a window background matching the application menu
      bar, a centered non-full-screen dialog, and dialog padding `1`.
- [ ] **Existing-content migration.** Button, Input, and Text remain the reference implementations and
      are checked for catalog/structure integration. Every other existing component page is upgraded;
      every other existing component live example is rebuilt to `template1`. `PlayComingSoon` is not
      permitted on a cataloged component target.
- [ ] **Public visual-surface coverage.** The catalog covers the primary pages and grouped symbols in
      the coverage matrix below. Any public user-facing visual surface discovered during implementation
      must be classified and added before the coverage gate can pass.
- [ ] **Machine-readable catalog.** `packages/docs-site/components.json` uses a discriminated union:
      component entries own `package`, non-empty `symbols`, `complexity`, documentation target,
      examples, and API symbols; specialist topic entries own `hub`, `profile`, route, examples,
      and navigation relationships. `complexity` is one of `standard`, `data-grid-hub`, or
      `code-editor-hub`; `profile` is one of `landing`, `capability`, or `api`. No
      `status`/maturity field or visible maturity badge is required.
- [ ] **Specialist teaching-page contracts.** Hub landing, capability, and API pages satisfy
      profile-specific structural and content requirements. Capability pages place focused examples
      beside the behavior they teach; API pages may omit live examples.
- [ ] **Navigation parity.** Every cataloged page appears in the appropriate sidebar. The standard
      component catalog drives or validates the `/components/` navigation; Data Grid and Code Editor
      use their own prefix-specific sidebars.
- [ ] **Components overview.** `/components/` explains the component families and renders a linked
      hierarchy/composition model showing a typical application:
      Application → Desktop or Router → Window/Dialog → Group/container → controls.
- [ ] **Accurate public contracts.** Props, defaults, public state, keyboard/mouse behavior, sizing,
      and snippets are cross-checked against public barrels, exported options types, implementation
      defaults/key handling, and generated TypeDoc.
- [ ] **Related/API navigation.** Every primary component target links to related component pages and
      its generated API symbol(s); generated API pages continue to back-link through the existing API
      map.

### Standard Coverage Matrix

| Family | Primary documentation units | Coupled/grouped public surfaces |
|---|---|---|
| Foundations | View, Group | Layout behavior and composition helpers are linked to guides/API. |
| Application shell | Application, Desktop, Router, Window, Menu Bar, Status Line | `createApplication`, `createRouter`, `MenuPopup`, `StatusItemView`, `statusLine`, and `statusItem` are documented with their owning surface. |
| Controls | Button, Input, Text, Label, Check Group, Radio Group, Multi-check Group, Slider, Switch | Button groups and input validators appear in the relevant component-specific sections. |
| Containers and navigation | Dialog, List View, List Box, Scroller, Scroll Bar, Tree, Tabs, Split View, Combo Box, History | Message/prompt helpers belong to Dialog; popup behavior belongs to Combo Box/History. |
| Feedback | Progress Bar, Spinner | `runSpinner` belongs to Spinner. |
| Date | Calendar, Date Picker | Date value/format helpers remain API/guide material. |
| Color | Color Swatch, Color Picker | Palette/value behavior is taught in component-specific sections. |
| Surface | Surface, Surface View | Off-screen drawing and viewport composition cross-link the two pages. |
| Editing and output | Editor, Memo, Edit Window, Indicator, Terminal | Editor dialogs/commands belong to Editor/Edit Window; `terminalWriter` belongs to Terminal. |
| Forms | Form Dialog | `createForm` and field binders are supporting guide/API concepts. |
| Files | File Dialog, Change Directory Dialog, File List, Directory List, File Input, File Info Pane, File Editor | File-system algorithms and openers remain in guides/API; virtual-file examples use the browser file-system seam. |

### Data Grid Specialist Hub

The hub lives under `/components/data-grid/`. Its exact titles may be refined for clarity, but it
must retain the following capability coverage and dedicated sidebar:

| Page | Required teaching focus | Minimum live-example shape |
|---|---|---|
| Overview and quick start | Choosing `DataGrid` vs `EditableDataGrid`, imports, first useful grid, capability map | One flagship comparison/quick-start example |
| Data sources and columns | Row identity, in-memory/reactive/windowed sources, typed columns, value/format/parse | At least two focused examples |
| Sizing, layout, and rendering | Widths, autofit, alignment, frozen panels/rows, density, custom rendering/styles | At least two focused examples |
| Sorting and filtering | Single/multi sort, quick filter, condition filter, value list, push-down | At least three focused examples |
| Rows, selection, and navigation | Selection modes, checkbox/gutter, row mutations, cursor and Tab traversal, keymaps | At least two focused examples |
| Editing and cell editors | Commit lifecycle, dirty state, overlays, built-in editor kinds, custom editors | At least four focused examples |
| Validation and lifecycle | Cell/row validation, veto/before-save, loading/empty/error states | At least two focused examples |
| Footer, aggregation, and master-detail | Aggregates, widgets, sticky behavior, honesty, master-detail | At least two focused examples |
| Data at scale | Windowing, large in-memory data, performance boundaries | At least two focused examples |
| Export, variants, and personalization | Safe export formats, saved layouts, freeze, personalization dialog | At least two focused examples |
| Theming, accessibility, and performance | Theme roles, keyboard discoverability, readable state, lazy loading, performance guidance | At least two focused examples or one example plus measurable guidance |
| API map | Public visual symbols and supporting APIs organized by task | No live example required |

The docs examples remain independent of the Data Grid showcase registry. They adapt representative
behavior from the 67 shipped showcase stories into smaller documentation examples.

### Code Editor Specialist Hub

The hub lives under `/components/code-editor/`. Its exact titles may be refined for clarity, but it
must retain the following capability coverage and dedicated sidebar:

| Page | Required teaching focus | Minimum live-example shape |
|---|---|---|
| Overview and quick start | `CodeEditor` vs `CodeEditorWindow`, imports, capability map | One flagship example |
| Documents, controllers, and lifecycle | Model/controller ownership, revisions, external changes, save formatting | At least two focused examples |
| Editing, navigation, and clipboard | Keyboard model, selection, mouse, clipboard, read-only behavior | At least two focused examples |
| Languages and syntax | Plain/JavaScript/TypeScript/PostgreSQL, registry, syntax projection, fallback behavior | At least three focused examples |
| Folding | Structural/language folds, visible rows, collapsed hierarchy | At least two focused examples |
| Search and replace | Search session, presentation, replacement behavior | At least two focused examples |
| Language intelligence and LSP | Completion, hover/signature, diagnostics, formatting, navigation, service state | At least three focused examples |
| Viewport and large documents | Resizing, projection, size tiers, degradation, observability | At least two focused examples |
| Themes and fallbacks | Classic/dark/light editor themes, resolution and fallback reports | At least two focused examples |
| Host authorization, safety, and recovery | Safe terminal text, host effects, command authorization, failure/recovery behavior | At least two focused examples |
| API map | Public visual symbols and supporting APIs organized by task | No live example required |

The docs examples remain independent of the Code Editor demo catalog. The source catalog contains
20 ordinary scenarios plus 11 QA scenarios. The hub selects 21 documentation examples by capability
coverage rather than attempting one-for-one source-scenario parity.

### Should Have

- [ ] Cross-links describe the decision boundary between related components, not merely list names.
- [ ] Component-specific sections use multiple live examples when one demo would become crowded or
      obscure the feature being taught.
- [ ] Each standard page includes at least one compact common-pattern snippet.
- [ ] Family pages and specialist-hub landings provide “choose this when…” comparisons.
- [ ] Example titles and blurbs state the interaction to try and the behavior to observe.

### Won't Have (Out of Scope)

- Generated symbol documentation itself; RD-06 owns TypeDoc generation.
- A runnable code playground/REPL; that remains later work.
- One documentation page for every helper, type, algorithm, controller, or rendering engine.
- Direct reuse of kitchen-sink/showcase story modules inside docs pages.
- Visible stable/experimental/planned badges without an authoritative stability policy.
- Compatibility pages for the old `/components/table/data-grid` and `/guide/code-editor` routes.

---

## Technical Requirements

### Catalog and Navigation

- `components.json` is checked in and deterministic.
- Each catalog row has a stable `id` and explicit `kind`. `(package, symbol)` ownership is unique
  across component entries; topic entries do not claim symbol ownership.
- `page` may include a stable heading anchor for a coupled subcomponent.
- Every example ID resolves to exactly one entry in `examples/index.ts`.
- Every catalog target resolves to a Markdown page and, when present, a real heading anchor.
- Every primary page is reachable from exactly one intended component/sidebar hierarchy.
- Specialist sidebar definitions are isolated by VitePress route prefix so their topic menus replace
  the global component list while browsing a hub.

### Content and Examples

- Standard flagship examples use `kind: 'app'` so the example owns the full `template1` shell.
- Specialist examples may share small test-data/building-block modules outside the recursively
  scanned example tree, but each registered example remains independently loadable and smoke-testable.
- Examples use bounded deterministic data. File examples use the virtual file-system seam and never
  access a visitor's real file system.
- Large example collections remain lazy-loaded; opening a page must not eagerly mount every terminal.
- Registry `sourcePath` values identify the independently compiled runnable example modules.
  Markdown snippets are separate, essence-only teaching artifacts: they may omit shell plumbing and
  need not be runnable, but must use the public API accurately. Full live-example modules are never
  extracted or pasted into component pages; the existing snippet-drift checks enforce that boundary.
- Every registered example has a checked-in typed behavior contract authored before implementation.
  The contract maps its declared capabilities to independently resettable cases with executable
  initial/expected probes, bounded structured action sequences, and disposal evidence.

### Content Accuracy

- Props/public-state tables cite the exact exported options/public type.
- Defaults come from constructors, option normalizers, or constants—not inference from screenshots.
- Keyboard and mouse tables come from actual event/keymap handling.
- Size and Layout sections state intrinsic measurement, minimum useful dimensions, flex behavior,
  overflow/scroll behavior, and dialog/container constraints where applicable.
- Theming sections identify semantic roles/inputs without hard-coding claims from one color depth.

### Structural Validation

The docs-site verification must hard-fail when:

1. a cataloged primary page is missing;
2. a cataloged symbol is not exported from its declared package;
3. a cataloged primary page lacks a registered live example;
4. a standard page is missing a required `component-page-template1` section;
5. a catalog target or heading anchor is broken;
6. an example ID is missing, duplicated, or points to a missing module;
7. a cataloged target is absent from its intended sidebar;
8. a cataloged component page still uses `PlayComingSoon`;
9. a specialist hub is missing its required topic/sidebar topology;
10. an internal link still targets a removed Data Grid or Code Editor page.

---

## Integration Points

### RD-03: Live Examples

- Reuse the existing registry semantics, lazy imports, Play component, independently compiled
  runnable examples, smoke harness, and sanitization boundary. Keep Markdown teaching snippets
  deliberately separate from runnable module source.
- This RD expands example coverage and standardizes component presentation; it does not replace the
  live-example runtime.

### RD-06: API Reference

- Catalog `apiSymbols` connect hand-written pages to generated symbols.
- The existing API-map backlink injection is extended from the catalog or validated against it so the
  two mappings cannot silently diverge.

### RD-08: Reference and Trust

- Component keyboard tables can feed the global keyboard reference.
- Theming sections link to theme-role and color-depth guidance.
- Accessibility/performance guidance on the specialist hubs links to the broader trust content.

### RD-09: Anti-drift Governance

- `components.json`, component pages, examples, and sidebars are the coverage inputs.
- RD-09's eventual gate must adopt this RD's visual-surface scope and no-badge policy.

---

## Scope Decisions

| Decision | Chosen | Rationale | AR Ref |
|---|---|---|---|
| Standard page structure | `component-page-template1` | Matches the successful Button/Input/Text pages while allowing component-specific depth and multiple examples | AR-34 |
| Standard example presentation | `template1`; rebuild every existing example except Button/Input/Text | Makes examples visually coherent and prevents controls from being glued to or visually lost against their host | AR-35 |
| Large-component architecture | Dedicated multi-page Data Grid and Code Editor hubs | Their 67-story and 31-scenario evidence sets cannot be taught clearly in one demo/page | AR-36 |
| Coverage boundary | Public visual components and major app surfaces | Documents what users compose and see without manufacturing shallow pages for algorithms/types | AR-37 |
| Coverage authority | Machine-readable catalog without maturity badges | Enables parity and navigation checks without publishing unsupported stability claims | AR-38 |
| Coupled symbols | Anchored sections allowed | Keeps public symbols discoverable while preserving useful conceptual page boundaries | AR-39 |
| Old specialist pages | Remove and replace; update links | The user does not require compatibility for broken/unpublished content | AR-40 |
| Example ownership | Primary page example required; deliberate sharing allowed | Guarantees hands-on coverage without duplicating equivalent demos | AR-41 |

---

## Security and Accessibility Considerations

- The docs site is static and handles no authentication, server-side storage, or database input.
- Live terminal content retains the established sanitization boundary; examples must not render
  untrusted text directly.
- File examples use the browser virtual file system. They must not transmit uploads or imply access to
  a visitor's host file system.
- Export examples use safe formula/HTML escaping paths and bounded in-memory output.
- LSP/Code Editor examples use in-process or explicitly mocked service seams; they must not connect to
  arbitrary network endpoints.
- Play controls remain labelled and keyboard-operable, with prose and source available in the DOM
  outside the terminal canvas.
- Large demo sets remain lazy to avoid excessive CPU/memory use and degraded page accessibility.

---

## Acceptance Criteria

1. [ ] `components.json` contains every approved public visual component/application surface and no
       unresolvable symbol, page, anchor, example, related target, or API target.
2. [ ] Every primary standard component has a sidebar-linked page conforming to
       `component-page-template1` and at least one registered live example.
3. [ ] Button, Input, and Text pass the final structural/catalog checks unchanged in intent; every
       other pre-existing component page is upgraded and every other pre-existing component example
       conforms to `template1`.
4. [ ] No cataloged component page renders `PlayComingSoon`.
5. [ ] `/components/` presents a linked family/composition hierarchy covering the catalog.
6. [ ] Data Grid is available only through the new `/components/data-grid/` hub, with a dedicated
       sidebar, all required topic pages, and the minimum focused-example coverage specified above.
7. [ ] Code Editor is available only through the new `/components/code-editor/` hub, with a dedicated
       sidebar, all required topic pages, and the minimum focused-example coverage specified above.
8. [ ] No internal link targets `/components/table/data-grid` or `/guide/code-editor`; the old pages
       are absent.
9. [ ] Props/defaults, keyboard/mouse behavior, Size and Layout guidance, and API links pass
       source-backed spot checks for at least one component in every family and every specialist page.
10. [ ] Catalog, structure, sidebar, example registry, snippet drift, compile, headless smoke, link,
        and docs-build specification tests all pass.
11. [ ] Live examples remain lazy, deterministic, sanitized, keyboard-operable, and accompanied by
        accessible prose/source context.
12. [ ] `yarn verify` passes.
