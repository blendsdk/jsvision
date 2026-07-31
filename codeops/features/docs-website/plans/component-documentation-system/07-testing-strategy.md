# Testing Strategy: Component Documentation System

> **Requirements**: RD-05 / PR-1 through PR-8
> **Rule**: Specification tests are written from this document before their corresponding implementation.

## Test Layers

| Layer | Purpose | Location |
|---|---|---|
| Catalog specifications | Freeze the approved visual-surface inventory and discriminated component/topic schema; validate exports/projections. | `packages/docs-site/test/component-catalog.spec.test.ts` |
| Page specifications | Validate the richer page backbone, catalog/example bindings, and removed routes. | `packages/docs-site/test/component-pages.spec.test.ts` |
| Template specifications | Paint real examples and verify `template1` geometry/presentation. | `packages/docs-site/test/template1-examples.spec.test.ts` plus family specs |
| Behavior contracts | Freeze each example's capabilities and independently resettable cases with executable probes and bounded structured action sequences before implementation. | `packages/docs-site/test/contracts/` |
| Family specifications | Verify each delivered page/example against its source-backed behavior contract and cumulative immutable ID set. | `packages/docs-site/test/<family>-components.spec.test.ts` |
| Hub specifications | Verify page profiles, topology, behavior contracts, safety, and specialist behavior in concern-sharded files. | `packages/docs-site/test/data-grid-docs.*.spec.test.ts`, `code-editor-docs.*.spec.test.ts` |
| Implementation tests | Parser diagnostics, reset/disposal, fixtures, edge/error paths. | matching `*.impl.test.ts` files |
| Vue DOM specifications | Mount Play in a focused DOM project with injected/mocked terminal and resize seams; verify labels, keyboard activation, lazy import, and mount/disposal counts. | `packages/docs-site/test-dom/play-example.spec.test.ts` |
| Existing integration gates | Family-sharded registry parity, snippet drift, per-example paint smoke, accessibility, security, API backlinks, docs build/link validation. | existing docs-site tests and scripts |

## 🚨 Specification Test Cases

| ID | Requirement oracle | Expected behavior | Trace |
|---|---|---|---|
| ST-1 | Approved catalog schema | `components.json` has schema version 1; every row satisfies exactly one `component` or `topic` union branch and contains no maturity/status field. | AC-1 · PR-1 · AR-10/11 |
| ST-2 | Approved visual inventory | The catalog contains the complete RD-05 standard matrix plus all required Data Grid/Code Editor visual rows; removing a required ID fails. | AC-1 · PR-1/4/5/6 · AR-2 |
| ST-3 | Public symbols | Every `(package,symbol)` declared by the catalog is exported by the declared public barrel; duplicate ownership fails with a precise diagnostic. | AC-1/9 · PR-1 · AR-13 |
| ST-4 | Page/anchor resolution | Every catalog page exists and every optional anchor matches a real heading. | AC-1/2 · PR-1/4 |
| ST-5 | Example resolution | Every catalog example resolves exactly once through the family-sharded registry; every component and non-API topic has an example; each runnable source path maps to one module. | AC-1/2/4 · PR-1/3/4 |
| ST-6 | Sidebar parity | Standard primary pages appear once under `/components/`; each hub topic appears once in its prefix sidebar; no catalog page is orphaned. | AC-2/5/6/7 · PR-1/4/5/6/7 |
| ST-7 | Related/API integrity | Related IDs resolve, are not self-links, and API targets resolve; API backlinks use the same component target as the catalog. | AC-1/9/10 · PR-1/4 |
| ST-8 | Catalog determinism | Catalog projection is stable regardless of filesystem enumeration order and produces no duplicate order keys/routes. | AC-1/10 · PR-1 |
| ST-9 | Page metadata/overview | Every delivered standard page has frontmatter title/description, one H1, introductory prose, and focused public-entry usage before the flagship example. Phase 2 proves the parser against references/fixtures; Phase 11 proves global catalog parity. | AC-2/9 · PR-2/3/4 |
| ST-10 | Props and sizing | Every delivered standard page has Props/public-state and Size and Layout sections naming the relevant public type and practical sizing behavior; Phase 11 applies the rule globally. | AC-2/9 · PR-2/3/4 |
| ST-11 | Component-specific teaching | Every delivered standard page has its required catalog/family-specific section set; pages are not allowed to satisfy the contract with only generic headings; Phase 11 applies the rule globally. | AC-2/9 · PR-2/3/4 |
| ST-12 | Best practices/theming/related | Every delivered standard page has substantive Best Practices, exact Theming roles/regions, and valid Related/API links; Phase 11 applies the rule globally. | AC-2/9 · PR-2/3/4 |
| ST-13 | Focused snippets | TypeScript fences on every delivered standard page import public packages, do not embed a full demo shell, and are not copies of whole live-example modules; Phase 11 applies the rule globally. | AC-9/10 · PR-3/4 |
| ST-14 | Template shell | Every example in the current cumulative delivery set is `kind: 'app'`, renders the Classic menu/status shell, and owns a real Dialog. Phase 11 proves that the cumulative set equals every catalog example. | AC-3/11 · PR-3/4 · AR-5 |
| ST-15 | Template geometry | At 80×24 the Dialog is centered, non-full-screen, leaves desktop margin on every side, and has one-cell content padding beyond the frame inset. | AC-3/11 · PR-3/4 · AR-5 |
| ST-16 | Template surface and clipping | The dialog uses the Classic theme-controlled surface matching menu-bar background and its frame/content/instructions do not clip. | AC-3/11 · PR-3/4 · AR-5 |
| ST-17 | Template interaction | Each delivered example has a valid typed behavior contract; independently resettable cases provide executable initial/expected probes, one-to-six structured actions, disposal evidence, and exact capability coverage. | AC-3/9/11 · PR-3/4 |
| ST-18 | Reference preservation | Button/Input/Text retain their accepted example objectives and pass catalog/page/template integration checks. | AC-3 · PR-2 |
| ST-19 | Controls coverage | Label, Check Group, Radio Group, Multi-check Group, Slider, and Switch pages/examples meet their source-backed objectives. | AC-2/3/9 · PR-3/4 |
| ST-20 | Foundations/shell coverage | View, Group, Application, Desktop, Router, Window, Menu Bar, and Status Line pages/examples meet their composition/shell objectives. | AC-2/9 · PR-4 |
| ST-21 | Containers/general families | Containers/navigation, feedback, date, color, surface, editing, and terminal pages/examples meet their family objectives. | AC-2/9 · PR-3/4 |
| ST-22 | Forms/files coverage | Form Dialog and all seven file-family pages/examples meet their source-backed objectives using only deterministic virtual file systems. | AC-2/3/9/11 · PR-3/4 |
| ST-23 | Data Grid topology | `/components/data-grid/` has exactly the 12 required pages in specialist-sidebar order; every page satisfies its catalog-selected profile and only the API page may omit examples. | AC-6 · PR-5 |
| ST-24 | Data Grid objectives | All 24 named Data Grid example IDs exist, paint, and prove the learning objectives in 03-04 through real grid state/input. | AC-6/9/10 · PR-5 |
| ST-25 | Data Grid trust boundaries | Scale examples avoid full-array access for windowed data; export proves escaping; examples are lazy and use bounded deterministic sources. | AC-6/10/11 · PR-5/8 |
| ST-26 | Code Editor topology | `/components/code-editor/` has exactly the 11 required pages in specialist-sidebar order; every page satisfies its catalog-selected profile and only the API page may omit examples. | AC-7 · PR-6 |
| ST-27 | Code Editor objectives | All 21 named Code Editor example IDs exist, paint, and prove the learning objectives in 03-05 through real editor/controller state/input. Every example starts maximized, uses substantial language-appropriate source, applies non-empty real syntax when its language supports it, exposes capability-named actions instead of generic checks, renders Try/Result/Look-for guidance, resets independently, and presents capability-specific native editor state. | AC-7/9/10 · PR-6 |
| ST-28 | Code Editor safety | LSP uses bounded in-process seams; protocol text is sanitized; host effects require explicit authorization; large-doc fixtures remain bounded; disposal/reset leaves no work running. | AC-7/10/11 · PR-6/8 |
| ST-29 | No Coming Soon | No cataloged page contains `PlayComingSoon`; every `PlayExample` resolves and its title/blurb states an objective. | AC-2/4 · PR-3/4 |
| ST-30 | Accessibility and lazy loading | A Vue-capable DOM project mounts Play with deterministic terminal/ResizeObserver seams and proves labelled controls, keyboard activation, lazy imports, mount/disposal counts, and unopened-example isolation; the production build remains green. | AC-10/11 · PR-8 |
| ST-31 | Removed routes | Executable docs source, sidebar, catalog, API map, and current tests contain no `/components/table/data-grid` or `/guide/code-editor`; both old Markdown files are absent. | AC-8 · PR-5/6 |
| ST-32 | Rendered integration | Docs build renders every catalog target/hub/anchor, resolves the correct specialist navigation and fragment-aware API backlinks, has one H1 per page and unique routes/sidebar labels within each hub, and has no broken internal link. Human titles may repeat across different hubs. | AC-5/6/7/8/10/12 · PR-1/5/6/7/8 |

## Concrete Inputs

The expected outputs are owned by the ST table above. These fixtures make each case executable rather
than leaving the input to implementation-time interpretation.

| ID | Concrete input |
|---|---|
| ST-1 | The checked-in catalog plus fixtures missing branch-specific fields, mixing `component`/`topic` fields, using unknown complexity/profile values, and adding a `status` field. |
| ST-2 | The checked-in catalog compared with the immutable RD-05 ID/symbol matrix; a mutation removes one required standard row and one hub row. |
| ST-3 | Catalog package/symbol pairs compared with exports parsed from the five declared public barrels; mutations use a private symbol and wrong package. |
| ST-4 | Every catalog `page`, plus fixtures for a missing file, missing heading, and valid anchored coupled symbol. |
| ST-5 | Catalog example IDs and the aggregate family registry, plus missing/duplicate source-path, empty component/non-API-topic, and unregistered runnable-module mutations. |
| ST-6 | Catalog projection and VitePress sidebar resolver, plus duplicate, missing, wrong-prefix topic mutations and representative Data Grid/Code Editor URLs. |
| ST-7 | All catalog `related`/`apiSymbols` values, the checked-in API map, generated metadata, and fragment-aware target parser, plus broken/self-related/API/parity/anchor mutations and plain-page/directory-landing targets with and without fragments. |
| ST-8 | The same valid catalog rows presented in forward, reverse, fixed rotations, and one checked-in adversarial shuffle. |
| ST-9 | Every standard Markdown page plus fixtures missing frontmatter, duplicating H1, moving usage after Play, and importing an internal path. |
| ST-10 | The current cumulative delivered standard pages plus fixtures omitting Props or Size/Layout and one page naming the wrong options type; Phase 11 uses the complete catalog set. |
| ST-11 | The per-family required-section fixture compared with the cumulative delivered standard pages plus one generic-only fixture; Phase 11 uses the complete catalog set. |
| ST-12 | The cumulative delivered standard pages plus fixtures omitting Best Practices/Theming/Related or using a nonexistent theme role/link; Phase 11 uses the complete catalog set. |
| ST-13 | TypeScript fences on the cumulative delivered standard pages plus full-shell, internal-import, and copied-module fixtures; Phase 11 uses the complete catalog set. |
| ST-14 | Button/Input/Text plus the current cumulative immutable delivery set built at 80×24; a bare component and an app without Dialog are negative fixtures. Phase 11 compares the cumulative set with the complete catalog. |
| ST-15 | Painted app/dialog geometry at 80×24; edge-touching, positioned, full-screen, and zero-padding fixtures. |
| ST-16 | Classic menu/dialog cell roles and rendered lines; custom-background and clipped-frame fixtures. |
| ST-17 | Every checked-in typed behavior contract, its capability set, independently rebuilt cases, executable initial probes, one-to-six structured key/mouse actions, executable expected probes, and disposal evidence. |
| ST-18 | Real Button/Input/Text catalog rows, pages, examples, and their existing objective-specific spec evidence. |
| ST-19 | Six control IDs with their real pages/apps and objective-specific input sequences defined in the family spec. |
| ST-20 | Eight foundation/shell IDs with real pages/apps and composition/command/navigation input sequences. |
| ST-21 | The complete container/general-family ID fixture with real pages/apps and family-specific input sequences. |
| ST-22 | Form/file IDs built over a deterministic virtual tree plus a docs-test-local `FileSystem` fault adapter that injects explicit denied and I/O-error paths without changing `@jsvision/web`. |
| ST-23 | Data Grid topic-route/sidebar fixture from 03-04 compared with catalog, filesystem, and VitePress config. |
| ST-24 | The 24 Data Grid IDs, deterministic row fixtures, and capability-complete reset/action/probe cases in `test/contracts/data-grid/`. |
| ST-25 | Windowed source trap, export injection strings, import spies, and bounded row counts exercised through scale/export pages. |
| ST-26 | Code Editor topic-route/sidebar fixture from 03-05 compared with catalog, filesystem, and VitePress config. |
| ST-27 | The 21 Code Editor IDs, bounded document fixtures, and capability-complete reset/action/probe cases in `test/contracts/code-editor/`; presentation checks inspect maximized responsive geometry, meaningful source size, language-appropriate adapter syntax, capability-specific controls, Try/Result/Look-for guidance, reset, and native editor evidence for every example. |
| ST-28 | Malformed/oversized protocol payloads, denied host effect, failed/recovered session, large-tier fixture, and disposal signal. |
| ST-29 | All cataloged Markdown and every `PlayExample` ID/title/blurb; a Coming Soon and missing-ID fixture. |
| ST-30 | A dedicated `dom` Vitest project using `@vitejs/plugin-vue`, `happy-dom`, and Vue Test Utils, with injected/mocked xterm and `ResizeObserver`, keyboard activation, dynamic-import spies, unopened/opened mount counts, disposal evidence, and production-build assertions. The docs manifest exposes a focused DOM command and its normal `test` script runs both `unit` and `dom` projects under `yarn verify`. |
| ST-31 | Repository scan over current executable docs paths plus filesystem assertions for the two removed Markdown files. |
| ST-32 | Production docs output, rendered route manifest, heading IDs, sidebar state by URL prefix, link graph, one-H1 checks, route uniqueness, within-hub label uniqueness, and fragment-aware API backlinks. |

## Family Objective Fixtures

Family spec files export separately typed immutable `catalogEntryIds` and `exampleIds` sets and
import behavior contracts keyed by the latter. The expected IDs come from RD-05/03-03, not from
`components.json`, so deleting both a catalog row and implementation cannot make the oracle pass.
Phase 11 requires the `catalogEntryIds` union to equal every catalog row ID and the `exampleIds`
union to equal the catalog's distinct example-ID population.

## Red/Green Protocol

For each execution phase:

1. add the phase's `*.spec.test.ts` cases from the ST rows above;
2. run only those specs and record expected failures;
3. implement pages/examples/catalog/navigation for that phase;
4. rerun the specs until green; change implementation, never the oracle;
5. add `*.impl.test.ts` coverage for parser internals, reset/disposal, fixture and error paths;
6. run focused package checks and `yarn verify`.

If a spec passes before implementation because shipped behavior already satisfies it, record the exact
existing evidence instead of weakening the test to force red.

## Non-Code Artifact Validation

| Artifact | Validation |
|---|---|
| JSON catalog | Parse/schema/determinism/export/page/anchor/example/sidebar/API specs |
| Markdown pages | Structure, snippets, links, headings, stale-route, docs-build checks |
| VitePress sidebar | Representative URL resolution and exact catalog parity; source order is a readability convention only |
| Example registry | Family-module aggregation, runnable-source parity, catalog linkage, lazy imports, and per-example paint cases |
| Teaching snippets | Existing snippet-drift test rejects full-module copies; registry `sourcePath` separately identifies runnable source |
| Plan/requirements | Markdown formatting, traceability/readiness tooling |

## Final Gate

`yarn verify`
