# Current State: Component Documentation

> **Plan**: component-documentation-system
> **Inventory date**: 2026-07-29

## Shipped Foundations

| Area | Evidence | Consequence |
|---|---|---|
| Page directive | `AGENTS.md:59-163` defines `component-page-template1`, including required sections, focused snippets, multiple section-local examples, accuracy checks, and Button as the canonical page. | The plan standardizes existing/new pages against an already user-approved contract instead of inventing a second template. |
| Example directive | `AGENTS.md:29-57` defines `template1`: Classic theme, app-owned shell, centered non-full-screen Dialog, padding `1`, dialog/menu-bar surface match, rich states, and focused specs. | All component examples except the newly completed Button/Input/Text references must migrate to this contract. |
| Example registry | `packages/docs-site/examples/index.ts:1-40` defines unique IDs, category, kind, source path, and lazy imports. | Extend the existing registry; do not replace it with catalog-driven eager imports. |
| Reference examples | `packages/docs-site/examples/index.ts:42-61` registers Button, Input, and Text as `kind: 'app'`. | These three are the reference baseline and need only integration checks. |
| Existing component examples | `packages/docs-site/examples/index.ts:63-90` registers Form Dialog, List Box, File Dialog, and Data Grid; List Box and Data Grid still use `kind: 'component'`. | Rebuild all four; the old Data Grid module is replaced by hub examples. |
| Lazy loading | Every registry row uses a dynamic `import()` (`packages/docs-site/examples/index.ts:37-39`). | Large hub example sets can remain page-load efficient if registry imports stay lazy and terminals mount only on demand. |
| Sidebar | One global `/components/` sidebar is hand-authored at `packages/docs-site/.vitepress/config.ts:185-259`. | Introduce catalog-backed validation and more-specific Data Grid/Code Editor prefix sidebars. |
| API links | `packages/docs-site/src/api/api-map.mjs:1-145` is a separate hand-authored symbol↔page map; it currently has 29 rows and points Data Grid to the obsolete route at `:121`. Its validator duplicates the package allowlist, and fragment-bearing component targets break labels/build-path checks. | Keep the checked-in map, validate exact parity with the catalog, derive packages from `PACKAGES`, and introduce one fragment-aware component-target parser used by every consumer. |

## Current Coverage

| Measure | Current value | Gap |
|---|---:|---|
| Markdown files under `components/` | 33 | Includes the overview and two theming demos; it is not equivalent to cataloged component coverage. |
| Existing primary component pages | 30 | Several public visual/application surfaces remain undocumented. |
| Pages closely matching the richer template | 3 | Button, Input, and Text. |
| Pages rendering `PlayComingSoon` | 22 | All must receive registered live examples; Tabs separately has no Play block. |
| Component-oriented registered examples | 7 | Button, Input, Text, Form Dialog, List Box, File Dialog, Data Grid. |
| Existing component examples exempt from rebuild | 3 | Button, Input, Text only. |
| Dedicated specialist sidebars | 0 | Data Grid and Code Editor currently inherit unrelated global/guide navigation. |

## Public-Surface Inventory

The visual-surface boundary is grounded in the public barrels, not every exported implementation
class. For example, the UI barrel explicitly describes the shell at `packages/ui/src/index.ts:93-129`,
controls at `:131-167`, containers at `:169-201`, tables/tabs/splits at `:203-239`, and the remaining
visual families at `:241-318`.

### Standard Documentation Units

| Wave | Existing pages to upgrade | Missing pages to add |
|---|---|---|
| Reference controls | Button, Input, Text (integration audit only); Label, Check Group, Radio Group, Slider, Switch | Multi-check Group |
| Foundations and shell | — | View, Group, Application, Desktop, Router, Window, Menu Bar, Status Line |
| Containers and navigation | Dialog, List Box, Scroller, Scroll Bar, Tree, Tabs, Combo Box, History | List View, Split View |
| Feedback/date/color | Progress Bar, Spinner, Calendar, Date Picker, Color Swatch, Color Picker | — |
| Surface/editing/output | Surface View, Editor, Memo, Edit Window, Terminal | Surface, Indicator |
| Forms/files | Form Dialog, File Dialog | Change Directory Dialog, File List, Directory List, File Input, File Info Pane, File Editor |

### Coupled Symbols

| Owner | Coupled public surfaces |
|---|---|
| Application | `createApplication` and application variants/types |
| Router | `createRouter` |
| Menu Bar | `MenuPopup` and menu builders |
| Status Line | `StatusItemView`, `statusLine`, `statusItem` |
| Dialog | `messageBox`, `confirm`, `inputBox`, standard button helpers |
| Button | `buttonColumn`, `buttonGroup`, group measurement |
| Input | validators |
| Spinner | `runSpinner` |
| Terminal | `terminalWriter` |
| Data Grid hub | `DataGrid`, `GridRows`, `GridHeader`, `EditableDataGrid`, `EditableGridRows`, `SortHeader`, `QuickFilterRow`, `FilterPopup`, `ValueList`, `FooterBand`, personalization surface |
| Code Editor hub | `CodeEditor`, `CodeEditorWindow`; supporting controller/document/language/LSP/theme systems are taught as concepts and linked to API |

## Specialist Evidence

| Hub | Repository evidence | Planning use |
|---|---|---|
| Data Grid | `packages/examples/datagrid-showcase/stories/index.ts` registers 67 shipped stories across foundation, editing, cell editors, formatting/rendering, sorting, filtering, columns/layout, rows/selection, footer/master-detail, navigation, validation/lifecycle, scale, export/variants, and personalization. | Select representative behaviors for focused docs examples; do not migrate every story or embed the showcase registry. |
| Code Editor | `packages/examples/code-editor-demo/scenario-catalog.ts` creates 20 ordinary scenarios and adds 11 QA scenarios spanning direct/windowed editors, capabilities, read-only, languages/folding, keyboard/mouse, line endings, LSP, shared sessions, safety, themes, and document-size tiers. | Select 21 topic-local docs examples by capability coverage rather than source-count parity. |

## Existing Test and Build Seams to Reuse

| Seam | Role in this plan |
|---|---|
| Example registry parity | Ensures every example module has one registry row and vice versa. |
| Snippet drift checks | Ensures page source embeds stay tied to the real compiled module. |
| Example smoke harness | Paint-smokes registered examples and verifies real interaction/state. |
| API build checker | Validates generated API paths and component backlinks. |
| VitePress build/link checks | Catches broken pages, routes, links, headings, and generated-site failures. |
| `yarn verify` | Authoritative repository gate per `AGENTS.md:10-11`. |

## Known Migration Hazards

| Hazard | Required control |
|---|---|
| A broad manual sidebar and a new catalog can become competing authorities. | Derive sidebar rows from the catalog where practical; otherwise enforce exact parity in one spec test. |
| API-map routes can remain stale after moving Data Grid/Code Editor, and current consumers mishandle fragments. | Keep the checked-in map in exact catalog parity and route every anchored target through one shared fragment-aware parser. |
| Dozens of examples can inflate initial JavaScript or mount many terminals. | Retain dynamic imports and mount only after Play activation; add lazy-loading assertions. |
| Template structure can encourage shallow boilerplate. | Structural tests enforce the backbone, while content specs require source-backed family-specific sections and focused objectives. |
| Coupled symbols can disappear inside broad pages. | Catalog each symbol with an exact page/anchor and at least one mapped example. |
| Old routes may linger in prose or generated maps. | Add a repository-wide stale-route specification test before deleting the old pages. |
