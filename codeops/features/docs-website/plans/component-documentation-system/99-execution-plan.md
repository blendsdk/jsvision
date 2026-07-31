# Execution Plan: Component Documentation System

> **CodeOps Artifact Schema**: 1
> **Implements**: docs-website/RD-05
> **Plan**: component-documentation-system
> **Status**: Complete
> **Progress**: 193 / 193 tasks complete
> **Last Updated**: 2026-07-30 22:14 CEST
> **Ordering**: Canonical CodeOps specification-first protocol: spec tests → red → implementation →
> green → implementation tests → verification.

## Execution Rules

- This file is the single source of task completion marks. Use `[~]` while a task is implemented but
  not yet verified; use `[x]` only after its named verification passes.
- Update the Progress header immediately after each `[x]`.
- On resume, inspect the first `[~]`; finish/reverify it before starting the first `[ ]`.
- Do not alter a specification oracle to match implementation behavior.
- A task normally changes one to three files. Split any task that grows beyond that boundary.
- Research each component's public source/tests/theme roles before writing its content.
- Keep Button/Input/Text intent intact unless a catalog/contract test finds a real integration defect.
- Every other existing component example is rebuilt to `template1`.
- After paths covered by `tools/jsvision-plugin-impact.json` change, inspect plugin impact and run
  `yarn plugin:update`/`yarn plugin:check` as required by project guidance.
- Record verification evidence immediately beside the completed task.
- Author each family's typed behavior contracts plus separate immutable `catalogEntryIds` and
  `exampleIds` sets before its implementation tasks; Phase 11 proves each union equals its matching
  complete catalog population.
- Keep registry family modules under `src/example-registry/` and shared fixtures outside the
  recursively scanned `examples/` tree.
- Apply the current `AGENTS.md` `template1` directive to every new live example. Use the shared
  `Template1Dialog` rather than duplicating dialog behavior: examples start compact and centered,
  remain responsive through resize/maximize/restore, and use `startMaximized` only where the user
  has explicitly approved it. Code Editor examples have explicit approval for maximized startup.

## Phase Dependencies

| Phase | Depends on | Outcome |
|---:|---|---|
| 1 | — | Approved catalog inventory and parser |
| 2 | 1 | Executable page/template contract |
| 3 | 2 | Controls complete |
| 4 | 2 | Foundations/application shell complete |
| 5 | 2 | Containers/navigation complete |
| 6 | 2 | Feedback/date/color complete |
| 7 | 2 | Surface/general editing/output complete |
| 8 | 2 | Forms/files complete |
| 9 | 1, 2 | Data Grid hub replaces old page |
| 10 | 1, 2 | Code Editor hub replaces old guide |
| 10.6 | 10 | Three flagship Code Editor presentation pilots establish the visual pattern |
| 10.7 | 10.6 | All remaining Code Editor examples adopt the approved flagship pattern |
| 11 | 3–10.7 | Full catalog/sidebar/API/overview integration |
| 12 | 11 | Final source/content/production verification |

## Phase 1 — Catalog Model and Approved Inventory

> **Phase baseline tree**: `dd2cc488524215815b4e4f64dccc4d5d69ca6964`
> **Expected modification set**: Phase 1 catalog/API/registry sources and declarations, focused
> docs-site specification and implementation tests, `components.json`, registry wiring, this
> execution plan, traceability, and verification evidence.

### 1.1 Specification tests

- [x] **1.1.1** Write `test/component-catalog.spec.test.ts` for ST-1, ST-2, ST-3, and ST-8. The
  expected ID/symbol inventory and component/topic union branches are fixtures derived from RD-05,
  not loaded from the catalog. Add controlled fragment-aware API target cases for ordinary pages,
  directory landings, and both with fragments. ✅ (completed: 2026-07-29 02:46 CEST; docs-site
  typecheck passed; joint RED verification confirmed the missing catalog and target modules)
- [x] **1.1.2** Add `test/example-registry-architecture.spec.test.ts` for family-module aggregation,
  runnable-source scanning, helper-directory exclusion, and one independently named paint case per
  example. ✅ (completed: 2026-07-29 02:46 CEST; docs-site typecheck passed; joint RED verification
  confirmed the absent family aggregate and per-example paint cases)
- [x] **1.1.3** Run the new specs and record RED because the catalog loader and sharded registry do
  not exist. ✅ (completed: 2026-07-29 02:46 CEST; expected RED: 9 failed and 3 passed across 12
  focused cases; log `/tmp/tmp.hdb01ywEZg`)

### 1.2 Implementation

- [x] **1.2.1** Add `components.json` with the complete standard and specialist inventory from
  03-01/03-03/03-04/03-05 using discriminated component/topic entries and specialist page profiles.
  ✅ (implemented: 2026-07-29 02:49 CEST; JSON and 51-component/23-topic population validated;
  Phase 1 focused green verification passed)
- [x] **1.2.2** Add `src/components/component-catalog.mjs`: parsing, schema validation, stable indexes,
  visual-symbol inventory comparison, and deterministic navigation projection. ✅ (implemented:
  2026-07-29 02:50 CEST; all four catalog/schema/inventory/determinism specification cases pass;
  Phase 1 focused green verification passed)
- [x] **1.2.3** Add `src/api/component-target.mjs`, its declaration, and focused tests for
  validation, labels, plain-page/directory-index build keys, and fragments. ✅ (implemented:
  2026-07-29 02:51 CEST; docs-site typecheck and 17 focused catalog/target cases pass; awaiting
  the Phase 1 green verification)
- [x] **1.2.4** Derive API-map validation packages from `PACKAGES`; update the validator declaration
  and focused tests for `code-editor` and fragment-aware component targets. ✅ (implemented:
  2026-07-29 02:52 CEST; docs-site typecheck and 21 focused API/catalog/target cases pass; awaiting
  the Phase 1 green verification)
- [x] **1.2.5** Update API-map labels, backlink injection, and `check-docs-build.mjs` to use the shared
  target parser before either specialist hub adds API rows. ✅ (implemented: 2026-07-29 02:53 CEST;
  docs-site typecheck, script syntax check, and 15 focused API/backlink/target cases pass; awaiting
  the Phase 1 green verification)
- [x] **1.2.6** Add the documented registry entry type and aggregate composer under
  `src/example-registry/`; reduce `examples/index.ts` to stable aggregation/re-export wiring.
  ✅ (implemented: 2026-07-29 02:54 CEST; typecheck and registry aggregation/parity checks pass;
  Phase 1 focused green verification passed)
- [x] **1.2.7** Move existing controls and container/files/table descriptors into bounded family
  registry modules; move any shared builders outside the recursively scanned `examples/` tree.
  ✅ (implemented: 2026-07-29 02:54 CEST; lazy source-path parity passes; awaiting the Phase 1
  green verification)
- [x] **1.2.8** Move existing application and theming descriptors into bounded family registry
  modules while preserving one lazy import per runnable source. ✅ (implemented: 2026-07-29 02:54
  CEST; registry loading and plumbing checks pass; Phase 1 focused green verification passed)
- [x] **1.2.9** Update runnable-source registry scanning and convert paint smoke to registry-driven
  per-example cases with independently named failures. ✅ (implemented: 2026-07-29 02:55 CEST;
  docs-site typecheck and 29 registry/architecture/paint cases pass; awaiting the Phase 1 green
  verification)
- [x] **1.2.10** Run ST-1/ST-2/ST-3/ST-8, API-target, and registry-architecture specs until GREEN.
  Fix catalog/loader/API/registry code, never the expected fixtures. ✅ (verification started:
  2026-07-29 02:55 CEST)

### 1.3 Implementation tests and hardening

- [x] **1.3.1** Add `test/component-catalog.impl.test.ts` for malformed JSON, unknown fields/enums,
  duplicates, anchors, ordering collisions, package/symbol diagnostics, and immutable projections.
  ✅ (completed: 2026-07-29 03:00 CEST; docs-site typecheck and 15 catalog specification/
  implementation cases pass; full verification passed)
- [x] **1.3.2** Run docs-site typecheck/tests, then `yarn verify`. ✅ (completed: 2026-07-29 03:00
  CEST; authoritative `yarn verify` passed in 114.30s; log `/tmp/tmp.g2JyVxUcEd`; Phase 1 quality
  review found and auto-design accepted fixes for canonical API paths, immutable indexes, hub
  landing projection, duplicate projected routes, API package typing, and JSON source diagnostics;
  the one-time re-review closed six findings and exposed a residual cross-kind route collision,
  which was corrected without weakening the oracle)

## Phase 2 — Executable Page and `template1` Contracts

> **Phase baseline tree**: `8c8ad54ced4d62b2e8e1575c5fc030071b5c78f3`
> **Expected modification set**: Phase 2 page parser/declaration, reference behavior contracts,
> template evidence helpers, focused specification and implementation tests, any bounded reference
> integration corrections, this execution plan, traceability, and verification evidence.

### 2.1 Specification tests

- [x] **2.1.1** Add `test/component-pages.spec.test.ts` for ST-9 through ST-13 against the
  Button/Input/Text references plus controlled standard, `landing`, `capability`, and `api`
  fixtures. ✅ (completed: 2026-07-29 03:24 CEST; RED confirmed for the absent page parser)
- [x] **2.1.2** Add `test/contracts/_contract.ts`, Button/Input/Text behavior contracts, cumulative
  delivery-set helpers, and `test/template1-examples.spec.test.ts` for ST-14 through ST-17 against
  the real reference apps. ✅ (completed: 2026-07-29 03:24 CEST; RED confirmed for the absent
  template evidence collector; four executable behavior cases already passed)
- [x] **2.1.3** Run both specs and record RED for missing shared parsers/evidence helpers; record any
  already-satisfied reference behavior rather than forcing artificial failure. ✅ (completed:
  2026-07-29 03:24 CEST; expected RED: 12 failed and 4 passed across 16 focused cases; log
  `/tmp/tmp.CjLCuPfK3E`)

### 2.2 Implementation

- [x] **2.2.1** Add `src/components/component-pages.mjs` to parse frontmatter, headings, PlayExample
  bindings, specialist page profiles, snippets, related links, and anchors with useful diagnostics.
  ✅ (completed: 2026-07-29 04:00 CEST; strict YAML, active-Markdown scanning, VitePress slugs,
  staged content/link expectations, placement rules, and all eighteen page/parser cases pass)
- [x] **2.2.2** Extend `test/example-lab-harness.ts` with the runtime `Template1Evidence` helper from
  03-02. ✅ (completed: 2026-07-29 04:00 CEST; all seven template/reference-contract cases plus
  sixteen geometry, surface, interaction, lifecycle, and isolation cases pass)
- [x] **2.2.3** Make only genuine catalog/structural integration corrections to Button/Input/Text
  pages or specs, at most three files per correction task. ✅ (completed: 2026-07-29 04:00 CEST;
  Input and Text focused snippets gained missing public-entry imports required by the strengthened
  contract; Button required no correction)
- [x] **2.2.4** Run ST-9…ST-17 against canonical references/profile fixtures until GREEN; global
  catalog applicability remains a Phase-11 parity gate. ✅ (completed: 2026-07-29 04:00 CEST; all
  52 page, template, and behavior-contract specification/implementation cases pass)

### 2.3 Implementation tests and hardening

- [x] **2.3.1** Add `test/component-pages.impl.test.ts` for malformed frontmatter, duplicate/missing
  headings, code-fence handling, heading slug/anchor edge cases, and precise file diagnostics.
  ✅ (completed: 2026-07-29 04:00 CEST; seven grouped parser implementation cases cover malformed
  YAML, hidden/fenced content, headings, fences, diagnostics, and VitePress-compatible anchors)
- [x] **2.3.2** Add `test/template1-examples.impl.test.ts` for odd/even centering, padding/frame
  detection, small viewport failure diagnostics, focus reset, and disposal. ✅ (completed:
  2026-07-29 04:00 CEST; sixteen real-app geometry, surface, mouse, focus, and disposal cases pass;
  strict behavior-schema hardening adds ten adversarial cases)
- [x] **2.3.3** Run focused docs-site checks, then `yarn verify`. ✅ (completed: 2026-07-29 03:39
  CEST; initial authoritative `yarn verify` passed in 123.98s; the required reviewer/auditor loop
  found page-oracle, lifecycle, schema, input-dispatch, anchor, and surface gaps; auto-design
  remediated them, a 147.81s authoritative run passed, and the one-time re-review's five residual
  majors were corrected; final exact-state `yarn verify` passed in 111.59s with all 52 Phase 2
  focused cases and 218 docs-site tests green; log `/tmp/tmp.SBsttNxX7D`)

## Phase 3 — Controls

> **Phase baseline tree**: `52881c5dc529b01500fe6fcc78975b7bcbfb0117`
> **Expected modification set**: Phase 3 control behavior contracts, family specification and
> implementation tests, six control pages and examples, the controls registry, bounded integration
> corrections, this execution plan, roadmap, traceability, and verification/review evidence.

### 3.1 Specification tests

- [x] **3.1.1** Add `test/contracts/controls.ts` and
  `test/controls-components.spec.test.ts` for ST-18/ST-19: the immutable control ID list, cumulative
  delivery set, component-specific sections, and exact initial/action/result contract per example.
  ✅ (completed: 2026-07-29 04:11 CEST; docs-site typecheck passed)
- [x] **3.1.2** Run RED for Label, Check Group, Radio Group, Multi-check Group, Slider, and Switch.
  ✅ (completed: 2026-07-29 04:12 CEST; expected RED: 18 failed and 4 passed across 22 focused
  cases, covering five incomplete pages, the missing Multi-check page, and all six absent
  registrations/examples; log `/tmp/tmp.YlrgO3VjHJ`)

### 3.2 Implementation

- [x] **3.2.1** Upgrade `components/controls/label.md` and `check-group.md`. ✅ (completed:
  2026-07-29 04:15 CEST; both focused page contracts pass)
- [x] **3.2.2** Add `examples/controls/label.ts` and `check-group.ts` as `template1` apps.
  ✅ (completed: 2026-07-29 04:17 CEST; docs-site typecheck passed)
- [x] **3.2.3** Upgrade `components/controls/radio-group.md`; add
  `components/controls/multi-check-group.md`. ✅ (completed: 2026-07-29 04:20 CEST; both focused
  page contracts pass)
- [x] **3.2.4** Add `examples/controls/radio-group.ts` and `multi-check-group.ts`.
  ✅ (completed: 2026-07-29 04:22 CEST; docs-site typecheck passed)
- [x] **3.2.5** Upgrade `components/controls/slider.md` and `switch.md`. ✅ (completed:
  2026-07-29 04:25 CEST; both focused page contracts pass)
- [x] **3.2.6** Add `examples/controls/slider.ts` and `switch.ts`. ✅ (completed:
  2026-07-29 04:27 CEST; docs-site typecheck passed)
- [x] **3.2.7** Register the six new lazy `kind:'app'` entries in the controls family registry
  module; update page PlayExample metadata/source embeds in the page tasks above. ✅ (completed:
  2026-07-29 04:28 CEST; four registry architecture cases and docs-site typecheck pass)
- [x] **3.2.8** Run ST-18/ST-19 and shared template specs until GREEN. ✅ (completed:
  2026-07-29 04:31 CEST; 29 focused controls/template cases pass after resolving the Classic
  View-menu accelerator collision through AR-21)

### 3.3 Implementation tests and hardening

- [x] **3.3.1** Add `test/controls-components.impl.test.ts` for reset/focus, invalid/disabled state
  edges, selection boundaries, and deterministic feedback. ✅ (completed: 2026-07-29 04:35 CEST;
  docs-site typecheck and 13 focused implementation cases pass)
- [x] **3.3.2** Complete the source-accuracy/content-review checklist for all nine controls.
  ✅ (completed: 2026-07-29 04:39 CEST; public exports, options/defaults, measurement, key/mouse
  handling, roles, related composition, API targets, unique accelerators, and absence of Coming
  Soon were reviewed; docs-site typecheck and 48 focused cases pass)
- [x] **3.3.3** Run focused docs checks, then `yarn verify`. ✅ (completed:
  2026-07-29 04:45 CEST; 265 docs-site unit cases and the authoritative 19-package `yarn verify`
  pass in 187s; the independent review found four major and two minor gaps, all were fixed, and the
  one-time re-review closed every finding; exact reviewed-state `yarn verify` passed in 115s; logs
  `/tmp/tmp.C7lECeSAu1` and `/tmp/tmp.oBSqJUNCl8`)

## Phase 4 — Foundations and Application Shell

> **Phase baseline tree**: `b722c383e0419b28982020b86b519a696e24bcb7`
> **Expected modification set**: Phase 4 foundation/application behavior contracts, family
> specification and implementation tests, eight pages and examples, foundation/application registry
> modules, bounded integration corrections, this execution plan, roadmap, traceability, and
> verification/review evidence.

### 4.1 Specification tests

- [x] **4.1.1** Add `test/contracts/application.ts` and
  `test/application-components.spec.test.ts` for ST-20, freezing the eight page IDs, cumulative
  delivery set, and exact behavior contract per example. ✅ (completed: 2026-07-29 04:49)
  - Verification: `yarn workspace @jsvision/docs-site typecheck`
- [x] **4.1.2** Run RED for all missing foundation/application targets.
  ✅ (completed: 2026-07-29 04:49)
  - Verification: expected RED, 24 failures covering all eight missing pages and all eight missing
    registered examples (`/tmp/tmp.LCaSBpPauH`).

### 4.2 Implementation

- [x] **4.2.1** Add `components/foundations/view.md` and `group.md`.
  ✅ (completed: 2026-07-29 04:51)
  - Verification: focused page-contract cases pass for both pages.
- [x] **4.2.2** Add `examples/foundations/view.ts` and `group.ts`.
  ✅ (completed: 2026-07-29 04:52)
  - Verification: `yarn workspace @jsvision/docs-site typecheck`
- [x] **4.2.3** Add `components/application/application.md` and `desktop.md`.
  ✅ (completed: 2026-07-29 04:54)
  - Verification: focused page-contract cases pass for both pages.
- [x] **4.2.4** Add `examples/application/application.ts` and `desktop.ts`.
  ✅ (completed: 2026-07-29 04:55)
  - Verification: `yarn workspace @jsvision/docs-site typecheck`
- [x] **4.2.5** Add `components/application/router.md` and `window.md`.
  ✅ (completed: 2026-07-29 04:57)
  - Verification: focused page-contract cases pass for both pages.
- [x] **4.2.6** Add `examples/application/router.ts` and `window.ts`.
  ✅ (completed: 2026-07-29 04:58)
  - Verification: `yarn workspace @jsvision/docs-site typecheck`
- [x] **4.2.7** Add `components/application/menu-bar.md` and `status-line.md`.
  ✅ (completed: 2026-07-29 05:00)
  - Verification: focused page-contract cases pass for both pages.
- [x] **4.2.8** Add `examples/application/menu-bar.ts` and `status-line.ts`.
  ✅ (completed: 2026-07-29 05:02)
  - Verification: `yarn workspace @jsvision/docs-site typecheck`
- [x] **4.2.9** Register all eight application/foundation examples in their family registry modules.
  ✅ (completed: 2026-07-29 05:03)
  - Verification: 19 registry/catalog cases pass.
- [x] **4.2.10** Run ST-20 and shared page/template specs until GREEN.
  ✅ (completed: 2026-07-29 05:04)
  - Verification: 67 application-family, shared page, and template1 cases pass.

### 4.3 Implementation tests and hardening

- [x] **4.3.1** Add `test/application-components.impl.test.ts` for focus ownership, router reset,
  modal/window composition, menu/status command behavior, and cleanup.
  ✅ (completed: 2026-07-29 05:05)
  - Verification: 7 focused ownership, navigation, chrome, and teardown cases pass.
- [x] **4.3.2** Complete source-accuracy/content review; run focused checks, then `yarn verify`.
  ✅ (completed: 2026-07-29 05:11)
  - Verification: 78 focused docs-site cases pass; full `yarn verify` passes across 19 workspaces
    (`/tmp/tmp.2XPsCLVLHc`). The independent review found three Major and one Minor issue; all
    accepted fixes passed 32 focused cases, and the one-time re-review closed every finding
    without a Critical or Major regression. The exact reviewed state passed `yarn verify` in 126
    seconds (`/tmp/tmp.uOFttzzbYL`).

## Phase 5 — Containers and Navigation

> **Phase baseline tree**: `307635c50ddd6e86438086e896af6defbe2f8e70`
> **Expected modification set**: Phase 5 container/dropdown behavior contracts, family
> specification and implementation tests, ten pages and examples, container/dropdown registry
> modules, bounded integration corrections, this execution plan, roadmap, traceability, and
> verification/review evidence.

### 5.1 Specification tests

- [x] **5.1.1** Add `test/contracts/containers.ts` and
  `test/container-components.spec.test.ts` for the container/navigation subset of ST-21, including
  its cumulative IDs and exact Dialog, list, scrolling, Tree/Tabs/SplitView, and dropdown/history
  actions/results. ✅ (completed: 2026-07-29 05:34 CEST; docs-site typecheck passes)
- [x] **5.1.2** Run RED for missing pages/examples and the old bare List Box example.
  ✅ (completed: 2026-07-29 05:34 CEST; expected RED: 30 failures covering ten page contracts,
  ten missing/non-template examples, and all ten behavior contracts; `/tmp/tmp.B6CunrgxDD`)

### 5.2 Implementation

- [x] **5.2.1** Upgrade `components/containers/dialog.md`; add
  `components/containers/list-view.md`. ✅ (completed: 2026-07-29 05:38 CEST; both focused page
  contracts pass)
- [x] **5.2.2** Add `examples/containers/dialog.ts` and `list-view.ts`.
  ✅ (completed: 2026-07-29 05:41 CEST; docs-site typecheck passes)
- [x] **5.2.3** Upgrade `components/containers/list-box.md` and rebuild
  `examples/containers/list-box.ts` as `template1`. ✅ (completed: 2026-07-29 05:44 CEST;
  typecheck and focused page contract pass)
- [x] **5.2.4** Upgrade `components/containers/scroller.md` and `scroll-bar.md`.
  ✅ (completed: 2026-07-29 05:47 CEST; both focused page contracts pass)
- [x] **5.2.5** Add `examples/containers/scroller.ts` and `scroll-bar.ts`.
  ✅ (completed: 2026-07-29 05:50 CEST; docs-site typecheck passes)
- [x] **5.2.6** Upgrade `components/containers/tree.md` and `tabs.md`.
  ✅ (completed: 2026-07-29 05:54 CEST; both focused page contracts pass)
- [x] **5.2.7** Add `examples/containers/tree.ts` and `tabs.ts`.
  ✅ (completed: 2026-07-29 05:57 CEST; docs-site typecheck passes)
- [x] **5.2.8** Add `components/containers/split-view.md` and
  `examples/containers/split-view.ts`. ✅ (completed: 2026-07-29 06:01 CEST; typecheck and focused
  page contract pass)
- [x] **5.2.9** Upgrade `components/dropdown/combo-box.md` and `history.md`.
  ✅ (completed: 2026-07-29 06:05 CEST; both focused page contracts pass)
- [x] **5.2.10** Add `examples/dropdown/combo-box.ts` and `history.ts`.
  ✅ (completed: 2026-07-29 06:08 CEST; docs-site typecheck passes)
- [x] **5.2.11** Add/update all ten lazy app entries in the container/dropdown family registry
  modules. ✅ (completed: 2026-07-29 06:10 CEST; typecheck and 4 registry cases pass)
- [x] **5.2.12** Run the container ST-21 subset and shared contracts until GREEN.
  ✅ (completed: 2026-07-29 06:15 CEST; 31 family cases and 77 shared page/template/registry cases
  pass; logs `/tmp/tmp.yoVpRPibLJ` and `/tmp/tmp.sTKyBcQE9e`)

### 5.3 Implementation tests and hardening

- [x] **5.3.1** Add `test/container-components.impl.test.ts` for scroll bounds, selection reset,
  popup/modal disposal, split constraints, and history fixture isolation.
  ✅ (completed: 2026-07-29 06:20 CEST; typecheck and 7 focused implementation cases pass)
- [x] **5.3.2** Complete source-accuracy/content review; run focused checks, then `yarn verify`.
  ✅ (completed: 2026-07-29 06:27 CEST; public exports, options/defaults, measurement, interaction,
  theme roles, composition, API targets, clipping, and cleanup reviewed; 357 docs-site cases and
  `yarn docs:check` pass; authoritative `yarn verify` passes in 119 seconds; logs
  `/tmp/tmp.WUkrgDDhWB`, `/tmp/tmp.Slymsi4zZH`, and `/tmp/tmp.STQXFLHLom`). The independent review
  found two Major issues: clipped teaching lines and an inaccurate Tabs close policy. Both were
  corrected; the one-time re-review closed clipping and prescribed one final real active-index
  assertion for the Tabs fix, which now passes all 49 focused cases (`/tmp/tmp.ytHD1829er`). The
  exact reviewed state passed `yarn verify` in 132 seconds (`/tmp/tmp.hSY9YujqG9`).

## Phase 6 — Feedback, Date, and Color

> **Phase baseline tree**: `bb1b1c61d2e34209b7afd9f417bdce71ca37293f`
> **Expected modification set**: Phase 6 feedback/date/color behavior contracts, family
> specification and implementation tests, six upgraded pages and template1 examples, family
> registry modules, bounded integration corrections, this execution plan, roadmap, traceability,
> and verification/review evidence.

### 6.1 Specification tests

- [x] **6.1.1** Add `test/contracts/value-components.ts` and
  `test/value-components.spec.test.ts` for the feedback/date/color subset of ST-21, freezing all six
  IDs and exact behavior contracts. ✅ (completed: 2026-07-29 06:16 CEST; docs-site typecheck passes)
- [x] **6.1.2** Run RED for all six Coming Soon examples.
  ✅ (completed: 2026-07-29 06:16 CEST; expected RED: 24 failures covering six richer page
  contracts, six missing template1 examples, and all six behavior contracts; `/tmp/tmp.ZJKlmTfEEr`)

### 6.2 Implementation

- [x] **6.2.1** Upgrade Progress Bar and Spinner pages.
  ✅ (completed: 2026-07-29 06:19 CEST; focused page contracts pass)
- [x] **6.2.2** Add Progress Bar and Spinner `template1` examples.
  ✅ (completed: 2026-07-29 06:18 CEST; docs-site typecheck passes)
- [x] **6.2.3** Upgrade Calendar and Date Picker pages.
  ✅ (completed: 2026-07-29 06:19 CEST; focused page contracts pass)
- [x] **6.2.4** Add Calendar and Date Picker examples.
  ✅ (completed: 2026-07-29 06:18 CEST; docs-site typecheck passes)
- [x] **6.2.5** Upgrade Color Swatch and Color Picker pages.
  ✅ (completed: 2026-07-29 06:19 CEST; focused page contracts pass)
- [x] **6.2.6** Add Color Swatch and Color Picker examples.
  ✅ (completed: 2026-07-29 06:18 CEST; docs-site typecheck passes)
- [x] **6.2.7** Register all six examples in the feedback/date/color family registry modules.
  ✅ (completed: 2026-07-29 06:18 CEST; docs-site typecheck passes)
- [x] **6.2.8** Run the family ST-21 subset and shared contracts until GREEN.
  ✅ (completed: 2026-07-29 06:20 CEST; all 25 family page, template, visibility, and behavior
  cases pass; `/tmp/tmp.o4FlDWrepE`)

### 6.3 Implementation tests and hardening

- [x] **6.3.1** Add `test/value-components.impl.test.ts` for timer cleanup, date boundaries,
  popup reset, invalid color entry, and deterministic animation.
  ✅ (completed: 2026-07-29 06:21 CEST; typecheck and all 31 family specification/implementation
  cases pass; `/tmp/tmp.Q0HklcfQZv`)
- [x] **6.3.2** Complete content review; run focused checks, then `yarn verify`.
  ✅ (completed: 2026-07-29 06:41 CEST; public exports, option defaults, localization, theme roles,
  widget-owned rendering, bounds, disabled dates, popup ownership, valid/invalid input, pointer
  gestures, timers, clipping, and cleanup reviewed; 408 docs-site cases and `yarn docs:check` 20/20
  pass; authoritative post-review `yarn verify` passes in 121 seconds; logs
  `/tmp/tmp.XRXG9J3QGx`, `/tmp/tmp.i0cDjW6b51`, and `/tmp/tmp.Oe0iEYzfsy`). The independent review
  found five Major issues and one Minor issue; all were corrected under auto-design. The one-time
  re-review closed four findings and prescribed two bounded final corrections, which now pass all
  44 focused family/contract cases (`/tmp/tmp.LRxh2GFYd9`).

## Phase 7 — Surface, General Editing, and Terminal

> **Phase baseline tree**: `ad72993e536537bf559760b195a4f8c635039c71`
> **Expected modification set**: Phase 7 surface/editor/terminal behavior contracts, family
> specification and implementation tests, seven pages and template1 examples, family registry
> modules, bounded integration corrections, this execution plan, roadmap, traceability, and
> verification/review evidence.

### 7.1 Specification tests

- [x] **7.1.1** Add `test/contracts/editing.ts` and
  `test/editing-components.spec.test.ts` for the surface/editor/output subset of ST-21, its
  cumulative IDs, exact behavior contracts, and the explicit boundary from the Code Editor hub.
  ✅ (completed: 2026-07-29 06:47 CEST; docs-site typecheck passes)
- [x] **7.1.2** Run RED for Surface/Indicator pages and the five missing examples.
  ✅ (completed: 2026-07-29 06:47 CEST; expected RED: 28 failures covering seven page contracts,
  seven absent template1 examples, and seven behavior contracts; `/tmp/tmp.Xjdf6v14vT`)

### 7.2 Implementation

- [x] **7.2.1** Add `components/surface/surface.md`; upgrade `surface-view.md`.
  ✅ (completed: 2026-07-29 06:50 CEST; focused page contracts pass)
- [x] **7.2.2** Add `examples/surface/surface.ts` and `surface-view.ts`.
  ✅ (completed: 2026-07-29 06:49 CEST; docs-site typecheck passes)
- [x] **7.2.3** Upgrade `components/editor/editor.md` and `memo.md`.
  ✅ (completed: 2026-07-29 06:50 CEST; focused page contracts pass)
- [x] **7.2.4** Add `examples/editor/editor.ts` and `memo.ts`.
  ✅ (completed: 2026-07-29 06:49 CEST; docs-site typecheck passes)
- [x] **7.2.5** Upgrade `components/editor/edit-window.md`; add
  `components/editor/indicator.md`.
  ✅ (completed: 2026-07-29 06:51 CEST; focused page contracts pass)
- [x] **7.2.6** Add `examples/editor/edit-window.ts` and `indicator.ts`.
  ✅ (completed: 2026-07-29 06:49 CEST; docs-site typecheck passes)
- [x] **7.2.7** Upgrade `components/terminal/terminal.md`; add
  `examples/terminal/terminal.ts`.
  ✅ (completed: 2026-07-29 06:51 CEST; focused page/behavior contracts pass)
- [x] **7.2.8** Register all seven examples in the surface/editing/terminal family registry modules.
  ✅ (completed: 2026-07-29 06:49 CEST; docs-site typecheck passes)
- [x] **7.2.9** Run the family ST-21 subset and shared contracts until GREEN.
  ✅ (completed: 2026-07-29 06:51 CEST; all 29 family page, template, visibility, and behavior
  cases pass; `/tmp/tmp.4wxFIfjPPa`)

### 7.3 Implementation tests and hardening

- [x] **7.3.1** Add `test/editing-components.impl.test.ts` for surface bounds, editor reset/undo,
  clipboard seams, timer/writer disposal, and safe terminal text.
  ✅ (completed: 2026-07-29 06:52 CEST; typecheck and all 36 family specification/implementation
  cases pass; `/tmp/tmp.mhCC68LNNh`)
- [x] **7.3.2** Complete content review; run focused checks, then `yarn verify`.
  ✅ (completed: 2026-07-29 07:10 CEST; independent review closed RV-701 through RV-707 after
  one correction pass; 39/39 focused cases, 454/454 docs-site cases, 20/20 documentation checks,
  and post-review `yarn verify` passed in 134.60 seconds)

## Phase 8 — Forms and Files

> **Phase baseline tree**: `360c645f8d410764d81b34f73453b2034da1cd35`
> **Expected modification set**: Phase 8 forms/files behavior contracts, deterministic virtual
> filesystem and fault fixtures, family specification and implementation tests, eight pages and
> template1 examples, family registry modules, bounded integration corrections, this execution
> plan, roadmap, traceability, and verification/review evidence.

### 8.1 Specification tests

- [x] **8.1.1** Add `test/contracts/files.ts`, a docs-test-local `FileSystem` fault adapter under
  `test/fixtures/`, and `test/file-components.spec.test.ts` for ST-22, including exact behavior
  contracts for Form Dialog and the seven-component file family over deterministic normal,
  denied, and I/O-error paths.
  ✅ (completed: 2026-07-29 07:17 CEST; docs-site typecheck passes)
- [x] **8.1.2** Run RED for missing pages/examples and non-template existing examples.
  ✅ (completed: 2026-07-29 07:17 CEST; expected RED: 32 failures covering eight page contracts,
  six absent examples, two non-template examples, visible teaching lines, and behavior contracts)

### 8.2 Implementation

- [x] **8.2.1** Upgrade `components/controls/form-dialog.md` and rebuild
  `examples/controls/form-dialog.ts`.
  ✅ (completed: 2026-07-29 07:22 CEST; page and template1 behavior contracts pass)
- [x] **8.2.2** Upgrade `components/files/file-dialog.md` and rebuild
  `examples/files/file-dialog.ts`.
  ✅ (completed: 2026-07-29 07:22 CEST; page and template1 behavior contracts pass)
- [x] **8.2.3** Add Change Directory Dialog and File List pages.
  ✅ (completed: 2026-07-29 07:22 CEST; focused page contracts pass)
- [x] **8.2.4** Add Change Directory Dialog and File List examples.
  ✅ (completed: 2026-07-29 07:22 CEST; focused behavior contracts pass)
- [x] **8.2.5** Add Directory List and File Input pages.
  ✅ (completed: 2026-07-29 07:24 CEST; focused page contracts pass)
- [x] **8.2.6** Add Directory List and File Input examples.
  ✅ (completed: 2026-07-29 07:24 CEST; focused behavior contracts pass)
- [x] **8.2.7** Add File Info Pane and File Editor pages.
  ✅ (completed: 2026-07-29 07:22 CEST; focused page contracts pass)
- [x] **8.2.8** Add File Info Pane and File Editor examples.
  ✅ (completed: 2026-07-29 07:22 CEST; focused behavior contracts pass)
- [x] **8.2.9** Add/update all eight entries in the forms/files family registry modules.
  ✅ (completed: 2026-07-29 07:22 CEST; registry parity and architecture pass)
- [x] **8.2.10** Run ST-22 and shared contracts until GREEN.
  ✅ (completed: 2026-07-29 07:24 CEST; all 33 family page, template, visibility, and behavior
  cases pass)

### 8.3 Implementation tests and hardening

- [x] **8.3.1** Add `test/file-components.impl.test.ts` for virtual-path validation, empty/error
  states, dialog cancellation, fixture reset, file-editor save seams, and disposal.
  ✅ (completed: 2026-07-29 07:25 CEST; 41/41 family specification/implementation cases pass)
- [x] **8.3.2** Complete security/content review; run focused checks, then `yarn verify`.
  ✅ (completed: 2026-07-29 07:53 CEST; independent review corrected 5 Major and 2 Minor
  findings; focused 46/46, docs-site 506/506, docs integrity 20/20, and final `yarn verify` pass)

## Phase 9 — Data Grid Specialist Hub

> **Phase baseline tree**: `1ab0abe500117be6b8300acddbd6f56a21bf1a02`
> **Expected modification set**: Phase 9 Data Grid topology/objective/trust contracts, deterministic
> bounded fixtures, sharded specification and implementation tests, 12 specialist pages and 24
> template1 examples, Data Grid registry/catalog/API/sidebar migration, deletion of obsolete
> Data Grid docs sources, bounded integration corrections, this execution plan, feature roadmap,
> traceability, and verification/review evidence.

### 9.1 Specification tests

- [x] **9.1.1** Add sharded `test/data-grid-docs.{topology,interaction,trust}.spec.test.ts` files and
  `test/contracts/data-grid/` for ST-23, ST-24, ST-25, page profiles, exact behavior contracts, and
  the Data Grid half of ST-31.
  ✅ (completed: 2026-07-29 08:05 CEST; 12-topic topology, 24 typed behavior contracts, lazy
  registry, bounded windowed-source, hostile export, and obsolete-route oracles typecheck)
- [x] **9.1.2** Run RED for hub routes/sidebar/examples and record the obsolete page/module evidence.
  ✅ (completed: 2026-07-29 08:06 CEST; expected RED: 43 failed and 2 passed across 45 focused
  cases, covering all 12 absent hub pages, all 24 absent examples, missing fixtures/registry/sidebar,
  and retained obsolete page/module; log `/tmp/phase9-red-final.log`)

### 9.2 Hub pages

- [x] **9.2.1** Add Overview and Data & Columns pages.
  ✅ (completed: 2026-07-29 08:09 CEST; landing/capability page contracts pass)
- [x] **9.2.2** Add Layout & Rendering and Sorting & Filtering pages.
  ✅ (completed: 2026-07-29 08:09 CEST; both capability page contracts pass)
- [x] **9.2.3** Add Rows/Selection/Navigation and Editing/Editors pages.
  ✅ (completed: 2026-07-29 08:09 CEST; both capability page contracts pass)
- [x] **9.2.4** Add Validation/Lifecycle and Footer/Aggregation/Detail pages.
  ✅ (completed: 2026-07-29 08:09 CEST; both capability page contracts pass)
- [x] **9.2.5** Add Data at Scale and Export/Personalization pages.
  ✅ (completed: 2026-07-29 08:09 CEST; both capability page contracts pass)
- [x] **9.2.6** Add Theming/Accessibility/Performance and API pages.
  ✅ (completed: 2026-07-29 08:09 CEST; capability/API page contracts pass; all 13 topology
  catalog/page cases green)

### 9.3 Focused examples

- [x] **9.3.1** Add `quick-start`, `data-sources`, and `typed-columns` examples.
- [x] **9.3.2** Add `layout-freezing` and `rendering` examples.
- [x] **9.3.3** Add `sorting`, `quick-filter`, and `advanced-filter` examples.
- [x] **9.3.4** Add `selection-navigation` and `row-mutations` examples.
- [x] **9.3.5** Add `editing-lifecycle` and `editor-types` examples.
- [x] **9.3.6** Add `custom-editor` and `dirty-commit` examples.
- [x] **9.3.7** Add `validation` and `lifecycle-states` examples.
- [x] **9.3.8** Add `aggregates` and `master-detail` examples.
- [x] **9.3.9** Add `windowed` and `large-memory` examples.
- [x] **9.3.10** Add `export` and `variants-personalization` examples.
- [x] **9.3.11** Add `theming-accessibility` and `performance-boundaries` examples.
- [x] **9.3.12** Register all 24 examples in the Data Grid family registry module with lazy app
  imports.
  ✅ (completed: 2026-07-29 08:17 CEST; all twelve example groups use real public DataGrid or
  EditableDataGrid surfaces through a shared scenario fixture; docs-site typecheck and all 24
  template1 live paint cases pass)

### 9.4 Route/sidebar migration

- [x] **9.4.1** Add the `/components/data-grid/` prefix sidebar and replace the global Data Grid link
  in `.vitepress/config.ts`.
  ✅ (completed: 2026-07-29 08:19 CEST; exact 12-link specialist sidebar is active)
- [x] **9.4.2** Add exact catalog-parity Data Grid rows to the checked-in `src/api/api-map.mjs` and
  update current docs links.
  ✅ (completed: 2026-07-29 08:19 CEST; all 11 catalog-owned visual symbols map to topic anchors)
- [x] **9.4.3** Delete `components/table/data-grid.md` and `examples/table/data-grid.ts`; remove the
  obsolete registry entry.
  ✅ (completed: 2026-07-29 08:19 CEST; obsolete page, example, and registry shard removed)
- [x] **9.4.4** Run ST-23/ST-24/ST-25/Data Grid ST-31 and shared contracts until GREEN.
  ✅ (completed: 2026-07-29 08:19 CEST; docs-site typecheck and all 45 focused topology,
  interaction, trust, route, registry, fixture, and live paint specification cases pass)

### 9.5 Implementation tests and hardening

- [x] **9.5.1** Add sharded `test/data-grid-docs.{lifecycle,data-scale,export}.impl.test.ts` files for
  async reset/disposal, windowed-source guard failures, export edge cases, editor/popup cleanup, and
  deterministic variant state.
  ✅ (completed: 2026-07-29 08:24 CEST; 13 lifecycle, overlay/popup cleanup, guarded scale,
  export safety, and variant determinism cases pass)
- [x] **9.5.2** Complete all 12 topic content reviews and source/API spot checks.
  ✅ (completed: 2026-07-29 08:24 CEST; verified public entry imports, generated API targets,
  source/identity/interaction/edit/validation/scale/export/theme boundaries, exact example
  populations, and absence of stale or placeholder content)
- [x] **9.5.3** Run docs-site and Data Grid focused checks, then `yarn verify`.
  ✅ (completed: 2026-07-29 09:03 CEST; 100 focused Data Grid checks, docs-site typecheck,
  629 docs-site unit tests, and authoritative `yarn verify` pass; final verify 143.39 seconds)

## Phase 10 — Code Editor Specialist Hub

> **Phase baseline tree**: `21a756f3dbbdd32f87c99497ca3313a3bbd036f6`
> **Expected modification set**: Phase 10 Code Editor topology/objective/safety contracts,
> deterministic bounded editor/LSP/host fixtures, sharded specification and implementation tests,
> 11 specialist pages and 21 responsive `template1` examples using the shared `Template1Dialog`,
> Code Editor registry/catalog/API/sidebar migration, deletion of the obsolete guide, bounded
> integration corrections, this execution plan, feature roadmap, traceability, and
> verification/review evidence.

### 10.1 Specification tests

- [x] **10.1.1** Add sharded `test/code-editor-docs.{topology,interaction,safety}.spec.test.ts` files
  and `test/contracts/code-editor/` for ST-26, ST-27, ST-28, page profiles, exact behavior
  contracts, and the Code Editor half of ST-31.
  ✅ (completed: 2026-07-29 11:48 CEST; docs-site typecheck passes; 21 typed contracts and exact
  11-topic topology compile)
- [x] **10.1.2** Run RED for hub routes/sidebar/examples and record the obsolete guide evidence.
  ✅ (completed: 2026-07-29 11:48 CEST; expected RED: 60 failed and 2 passed across 62 focused
  cases, covering absent hub pages, registry/examples, safety fixtures/sidebar, and retained
  obsolete guide; log `/tmp/phase10-red.log`)

### 10.2 Hub pages

- [x] **10.2.1** Add Overview and Documents/Lifecycle pages.
  ✅ (completed: 2026-07-29 11:51 CEST; landing and capability page contracts pass)
- [x] **10.2.2** Add Editing/Navigation/Clipboard and Languages/Syntax pages.
  ✅ (completed: 2026-07-29 11:51 CEST; both capability page contracts pass)
- [x] **10.2.3** Add Folding and Search/Replace pages.
  ✅ (completed: 2026-07-29 11:51 CEST; both capability page contracts pass)
- [x] **10.2.4** Add Language Intelligence and Viewport/Large Documents pages.
  ✅ (completed: 2026-07-29 11:51 CEST; both capability page contracts pass)
- [x] **10.2.5** Add Themes/Fallbacks and Host Safety/Recovery pages.
  ✅ (completed: 2026-07-29 11:51 CEST; both capability page contracts pass)
- [x] **10.2.6** Add the Code Editor API page.
  ✅ (completed: 2026-07-29 11:51 CEST; API profile contract passes; all 11 page checks green)

### 10.3 Focused examples

- [x] **10.3.1** Add `quick-start`, `document-controller`, and `external-changes`.
  ✅ (completed: 2026-07-29 12:00 CEST; template and behavior contracts pass)
- [x] **10.3.2** Add `editing-navigation` and `readonly-clipboard`.
  ✅ (completed: 2026-07-29 12:00 CEST; template and behavior contracts pass)
- [x] **10.3.3** Add `language-gallery`, `syntax-fallback`, and `invisibles-line-endings`.
  ✅ (completed: 2026-07-29 12:00 CEST; template and behavior contracts pass)
- [x] **10.3.4** Add `language-folding` and `structural-folding`.
  ✅ (completed: 2026-07-29 12:00 CEST; validated fold-state contracts pass)
- [x] **10.3.5** Add `search` and `replace`.
  ✅ (completed: 2026-07-29 12:00 CEST; query, selection, and revision contracts pass)
- [x] **10.3.6** Add `lsp-completion`, `lsp-diagnostics`, and `lsp-navigation`.
  ✅ (completed: 2026-07-29 12:00 CEST; bounded in-process service contracts pass)
- [x] **10.3.7** Add `viewport-mouse` and `large-document-tiers`.
  ✅ (completed: 2026-07-29 12:00 CEST; responsive and bounded-tier contracts pass)
- [x] **10.3.8** Add `themes` and `theme-fallback`.
  ✅ (completed: 2026-07-29 12:00 CEST; theme and fallback contracts pass)
- [x] **10.3.9** Add `safe-terminal-text` and `host-recovery`.
  ✅ (completed: 2026-07-29 12:00 CEST; sanitization and recovery contracts pass)
- [x] **10.3.10** Register all 21 examples in the Code Editor family registry module with lazy app
  imports.
  ✅ (completed: 2026-07-29 12:00 CEST; exact ordered population, lazy imports, and 48 focused
  interaction/safety cases pass)

### 10.4 Route/sidebar migration

- [x] **10.4.1** Add the `/components/code-editor/` prefix sidebar and global hub link.
  ✅ (completed: 2026-07-29 12:02 CEST; exact 11-link specialist sidebar passes)
- [x] **10.4.2** Extend the checked-in `src/api/api-map.mjs` with exact catalog-parity
  `code-editor` rows and update current docs links using the shared target parser.
  ✅ (completed: 2026-07-29 12:02 CEST; CodeEditor and CodeEditorWindow rows target overview anchors)
- [x] **10.4.3** Move the guide's i18n lesson to Languages & syntax; make
  `test/i18n-docs.spec.test.ts` resolve and guard that catalog target; delete
  `guide/code-editor.md` and remove its guide-sidebar entry in the same verified task.
  ✅ (completed: 2026-07-29 12:02 CEST; catalog-resolved i18n contract passes and obsolete guide is absent)
- [x] **10.4.4** Run ST-26/ST-27/ST-28/Code Editor ST-31 and shared contracts until GREEN.
  ✅ (completed: 2026-07-29 12:02 CEST; docs-site typecheck and all 65 focused topology,
  interaction, safety, removal, and i18n cases pass)

### 10.5 Implementation tests and hardening

- [x] **10.5.1** Add sharded
  `test/code-editor-docs.{document-lifecycle,language-lsp,host-recovery}.impl.test.ts` files for
  session/controller disposal, bounded protocol arrays/text, host-effect denial, failure/recovery,
  and large-fixture guards.
  ✅ (completed: 2026-07-29 12:10 CEST; 13 lifecycle isolation, bounded LSP, recovery authority,
  sanitization, terminal-safety, and fixture-ceiling cases pass)
- [x] **10.5.2** Complete all 11 topic content/security reviews and source/API spot checks.
  ✅ (completed: 2026-07-29 12:17 CEST; reviewed all 11 pages and 21 examples for public-entry
  imports, bounded fixtures, real controller/LSP/host seams, Template1 responsiveness, generated
  API targets, stale-guide references, placeholders, and terminal-safe presentation)
- [x] **10.5.3** Run docs-site and Code Editor focused checks, then `yarn verify`.
  ✅ (completed: 2026-07-29 12:45 CEST; 82 focused Code Editor checks and docs-site typecheck pass;
  independent review corrections close real-input, host-recovery, sanitizer, shared-controller, and
  objective-fidelity gaps; authoritative `yarn verify` passes in 142.49 seconds)

## Phase 10.6 — Code Editor Flagship Presentation Pilots

> **Phase baseline tree**: `40efd1dab7b28999a3dc6c515903284af4ecbe90`
> **Expected modification set**: Code Editor flagship specification and implementation tests,
> completion/diagnostics/language-folding example modules, shared flagship fixture/layout modules,
> the Code Editor example registry only if module wiring changes, the owning Code Editor
> specification/testing/decision artifacts, this execution plan, roadmaps, traceability, and
> verification/review evidence.

### 10.6.1 Specification tests

- [x] **10.6.1** Add immutable flagship pilot specifications for maximized responsive startup,
  meaningful multi-line source, non-empty real built-in syntax, capability-specific actions,
  reset behavior, and visible human-readable result evidence. ✅ (completed: 2026-07-29 14:46
  CEST; docs-site typecheck passes)
- [x] **10.6.2** Run the focused pilot specification and record RED against the generic laboratory.
  ✅ (completed: 2026-07-29 14:50 CEST; expected RED: 30 failed and 23 passed across the flagship
  and maximized-startup specifications; log `/tmp/tmp.v4CG4UfqTt/red-10.6.2.log`)

### 10.6.2 Implementation

- [x] **10.6.3** Add bounded flagship source fixtures and a shared syntax-aware responsive teaching
  layout that uses the public language registry/scheduler/controller path. ✅ (completed:
  2026-07-29 14:51 CEST; docs-site typecheck and all 44 existing Code Editor interaction cases
  pass with maximized startup)
- [x] **10.6.4** Rebuild `lsp-completion` as an inviting TypeScript assistance lesson with a staged
  caret, named completion action, visible suggestions/details, and reset. ✅ (completed:
  2026-07-29 14:53 CEST; seven focused flagship, behavior, and LSP implementation cases pass)
- [x] **10.6.5** Rebuild `lsp-diagnostics` as an understandable TypeScript error lesson with visible
  severity/message evidence and reset. ✅ (completed: 2026-07-29 14:53 CEST; seven focused
  flagship, behavior, and LSP implementation cases pass)
- [x] **10.6.6** Rebuild `language-folding` around a substantial foldable TypeScript module with a
  named fold action, visible before/after evidence, and reset. ✅ (completed: 2026-07-29 14:55
  CEST; five focused flagship and behavior-contract cases pass)

### 10.6.3 Implementation tests and hardening

- [x] **10.6.7** Add implementation coverage for adapter failure/stale-result safety, repeated
  action/reset, maximize/restore/reflow, disposal, and deterministic fixture bounds; run focused
  docs-site checks, the independent quality review, and `yarn verify`. ✅ (completed:
  2026-07-29 15:15 CEST; 67 focused flagship/interaction/language checks pass; independent review
  corrections align real LSP request positions, prove native projected states, and guard stale,
  aborted, reset, and disposal continuations; the landing page exposes all three flagship pilots
  before the composition lab; authoritative `yarn verify` passes)

## Phase 10.7 — Complete Code Editor Flagship Migration

> **Phase baseline tree**: `e4933eb2cbc89f029f11f1092fbf20cc4f1e0617`
> **Expected modification set**: remaining Code Editor example presentation specifications and
> implementation tests, the shared Code Editor lesson shell and scenario content modules, all
> non-pilot Code Editor example wrappers only if their definitions require richer metadata, owning
> Code Editor specification/testing/decision artifacts, this execution plan, roadmaps,
> traceability, and verification/review evidence.

### 10.7.1 Specification tests

- [x] **10.7.1** Extend immutable flagship presentation specifications to all 18 non-pilot Code
  Editor examples: substantial bounded source, language-appropriate syntax, capability-named
  actions, Try/Result/Look-for guidance, independent reset, maximized responsive geometry, and
  capability-specific native editor evidence. ✅ (completed: 2026-07-29 16:09 CEST; docs-site
  typecheck passes)
- [x] **10.7.2** Run the focused presentation specifications and record RED against the remaining
  generic laboratory. ✅ (completed: 2026-07-29 16:09 CEST; expected RED: all 37 presentation
  cases fail against tiny shared source, generic controls/copy, absent syntax, and absent reset;
  log `/tmp/red-10.7.2.log`)

### 10.7.2 Implementation

- [x] **10.7.3** Extract one shared responsive lesson shell and migrate all eighteen remaining
  examples in the foundation, language/search, and platform/safety cohorts. Each scenario must
  retain its own substantial source, named action, teaching rail, reset path, and native editor
  evidence. ✅ (completed: 2026-07-29 16:38 CEST; one shared responsive shell now presents 18
  distinct substantial fixtures, real built-in syntax analysis, capability-named actions, complete
  restored/maximized teaching rails, and independent reset)
- [x] **10.7.4** Run the immutable presentation specification and correct implementation defects
  until all eighteen migrated examples pass. ✅ (completed: 2026-07-29 16:38 CEST; 37/37
  presentation specifications pass, including post-action native-state change and compact
  Look-for-tail visibility for every lesson)
- [x] **10.7.5** Run the existing Code Editor interaction, lifecycle, language, and recovery
  contract suites and correct any regression without weakening their assertions. ✅ (completed:
  2026-07-29 16:38 CEST; focused Code Editor verification passes 108/108 after preserving public
  interaction, lifecycle, language/LSP, safety, and recovery contracts)

### 10.7.3 Implementation tests and hardening

- [x] **10.7.6** Add cohort hardening coverage for repeated action/reset, async cancellation,
  language switching, bounded fixtures, responsive reflow, and disposal; run focused checks,
  independent quality review, and `yarn verify`. ✅ (completed: 2026-07-29 16:38 CEST; cohort
  hardening proves adapter-specific repaint, parser-independent structural folds, reset/action race
  serialization, host evidence reset, disposal, and responsive restore; reviewer and auditor report
  zero residual findings; docs-site 73 files/900 tests pass; authoritative `yarn verify` passes)

## Phase 11 — Overview and Full Integration

> **Phase baseline tree**: `6142311148f9484cd715892ea1c63f9d31639a7a`
> **Expected modification set**: Phase 11 catalog/page specification and implementation tests,
> focused Vue DOM test infrastructure and Play runtime seams, Components overview, catalog-backed
> sidebar/API projections, rendered-doc validation, bounded link/anchor repairs, package manifests
> and lockfile, this execution plan, roadmap, traceability, and verification/review evidence.

### 11.1 Specification tests

- [x] **11.1.1** Extend `component-catalog.spec.test.ts` with ST-4 through ST-7. ✅
  (completed: 2026-07-29 16:53 CEST; docs-site typecheck passed)
- [x] **11.1.2** Extend `component-pages.spec.test.ts` with ST-29 and full ST-31. ✅
  (completed: 2026-07-29 16:54 CEST; docs-site typecheck passed)
- [x] **11.1.3** Add explicit `@vitejs/plugin-vue`, `happy-dom`, and Vue Test Utils dev
  dependencies and update `yarn.lock`; add a `dom` Vitest project, a focused DOM test script, and
  make the normal docs `test` script run `unit` + `dom` under `yarn verify`; add
  `test-dom/play-example.spec.test.ts` for ST-30 using deterministic xterm/ResizeObserver seams;
  extend build specifications for ST-32. ✅ (completed: 2026-07-29 16:59 CEST; typecheck passed;
  expected DOM RED: both cases fail because the injectable Play runtime seam does not yet exist;
  log `/tmp/tmp.xBdL5Lkko3/red-11.1.3.log`)
- [x] **11.1.4** Run RED for the old overview, unconsolidated API/sidebar mapping, any unresolved
  links/anchors, or eager loading. ✅ (completed: 2026-07-29 17:01 CEST; expected RED: missing
  Editable Data Grid heading anchor, 20 catalog/API parity rows, and both DOM cases awaiting the
  injectable Play runtime seam; catalog/page log `/tmp/tmp.vjFNvN3sEb/red-11.1.4-corrected.log`)

### 11.2 Implementation

- [x] **11.2.1** Rewrite `components/index.md` as the catalog-backed family/composition overview.
  ✅ (completed: 2026-07-29 17:02 CEST; docs-site typecheck passed)
- [x] **11.2.2** Complete catalog-backed standard/sidebar projection in `.vitepress/config.ts`.
  ✅ (completed: 2026-07-29 17:05 CEST; production VitePress build passed)
- [x] **11.2.3** Consolidate or strictly validate `src/api/api-map.mjs` against catalog API targets.
  ✅ (completed: 2026-07-29 17:08 CEST; exact catalog parity and focused API backlink tests pass)
- [x] **11.2.4** Repair related links and API anchors in bounded family batches of at most three pages.
  ✅ (completed: 2026-07-29 17:09 CEST; catalog page/anchor and API backlink suites pass)
- [x] **11.2.5** Remove every remaining `PlayComingSoon` from cataloged targets and every current-source
  stale specialist route. ✅ (completed: 2026-07-29 17:10 CEST; global catalog-page and stale-route
  specifications pass; unused placeholder component removed)
- [x] **11.2.6** Add the minimal injectable Play terminal/resize runtime seam required by the DOM
  oracle; extend `scripts/check-docs-build.mjs` for rendered catalog targets, specialist sidebar
  resolution, fragment-aware anchors, within-hub label uniqueness, and stale-route absence. ✅
  (completed: 2026-07-29 17:20 CEST; typecheck, two DOM cases, production build, and all 21
  rendered-doc checks pass)
- [x] **11.2.7** Prove the union of immutable family/hub `catalogEntryIds` equals every catalog row
  ID and the `exampleIds` union equals every distinct catalog example ID, then run
  ST-4…ST-7/ST-9…ST-17/ST-29…ST-32 globally until GREEN. ✅
  (completed: 2026-07-29 17:26 CEST; typecheck, 64 global integration/DOM cases, and the
  production build contract pass)

### 11.3 Implementation tests and hardening

- [x] **11.3.1** Extend catalog/page implementation tests for rendered heading slugs,
  representative route-prefix resolution, duplicate navigation, profile diagnostics, fixed
  adversarial catalog permutations, and API target/projection diagnostics. ✅
  (completed: 2026-07-29 17:29 CEST; typecheck and 34 focused implementation cases pass; duplicate
  generic “Overview” labels were corrected to their specialist workspace names)
- [x] **11.3.2** Run registry parity, snippet drift, paint smoke, accessibility, security, API
  generation/backlinks, docs build, and link validation. ✅ (completed: 2026-07-29 17:36 CEST;
  917 unit and 2 DOM tests, docs/API build, and 21/21 production checks pass; log
  `/tmp/tmp.KRJP8QBIZI/verify-11.3.2.log`)
- [x] **11.3.3** Run `yarn plugin:check`; if impact mapping reports owned generated content, run
  `yarn plugin:update` and recheck. ✅ (completed: 2026-07-29 17:37 CEST; plugin integrity passes
  with no generated update required)
- [x] **11.3.4** Run `yarn verify`. ✅ (completed: 2026-07-29 17:43 CEST; authoritative full gate
  passes; log `/tmp/tmp.gYhfiGFCiw/verify-11.3.4-retry.log`)

### Phase 11 quality review

Independent correctness and risk review accepted and closed five Major and two Minor findings.
Startup cancellation now spans both Vue session ownership and the plain-TS controller's pending
module-load terminal; the final reviewed state passes 48 focused integration cases, 12 DOM cases,
12 Play controller cases, the production build, and 21/21 rendered-document checks. Full evidence
is recorded in `16-phase-11-quality-review.md`.

## Phase 12 — Final Review and Handoff

> **Phase baseline tree**: `f819cd13e54772d22e1318b5143cc5b366408b88`
> **Expected modification set**: final component catalog/content/interaction audit evidence,
> bounded documentation corrections discovered by the audit, this execution plan, docs-website
> traceability, and the docs-website plus portfolio roadmaps.

- [x] **12.1** Review the catalog against current public barrels and record every included/excluded
  visual-surface classification. ✅ (completed: 2026-07-30 21:27 CEST; all five current public
  barrels were classified in `17-phase-12-final-review.md`; 61 explicitly owned visual symbols and
  openers resolve through 51 component rows, with coupled and non-visual exports recorded)
- [x] **12.2** Review every standard page and hub topic against the content-quality checklist in
  03-06; repair in tasks of at most three files. ✅ (completed: 2026-07-30 21:37 CEST; all 71
  unique routes passed the eight-part content review and 682 focused assertions; authoritative
  verification passes with Turbo concurrency bounded to two after the i18n wall-clock benchmark
  proved sensitive to preceding host contention; logs
  `/tmp/tmp.sZHLhG2yHh/component-final-audit.log` and `/tmp/tmp.iBnMIycuhM`)
- [x] **12.3** Paint-smoke every example at 80×24 and sample keyboard/mouse interaction for every
  family and every specialist topic. ✅ (completed: 2026-07-30 21:40 CEST; all 96 component
  laboratories have independently named 80×24 paint coverage; family and specialist suites sample
  keyboard and mouse paths across standard components, all 12 Data Grid topics, and all 11 Code
  Editor topics; 682 focused assertions and authoritative verification pass; logs
  `/tmp/tmp.sZHLhG2yHh/component-final-audit.log` and `/tmp/tmp.OHXRPzhprH`)
- [x] **12.4** Run docs production build and inspect Components, Data Grid, and Code Editor sidebar
  transitions and representative pages in the built output. ✅ (completed: 2026-07-30 21:53 CEST;
  the first scan exposed two broken Crash safety artifact links, which were corrected
  specification-first under AR-92; the rebuilt 1,026-page site passes all 21 output checks,
  including 74 catalog routes/sidebars/anchors and 61 API backlinks; logs
  `/tmp/tmp.faVYAQNQew` and `/tmp/tmp.MVs7PjCrLm`)
- [x] **12.5** Run final `yarn verify`. ✅ (completed: 2026-07-30 21:56 CEST;
  authoritative repository verification passes with Turbo concurrency bounded to two; log
  `/tmp/tmp.Zt6LZG4kwR`)
- [x] **12.6** Update execution evidence, traceability status, and roadmap only after all gates pass.
  ✅ (completed: 2026-07-30 21:58 CEST; final task/test evidence, RD-05 lifecycle state, and
  feature-roadmap progress synchronized after the production build and authoritative repository
  verification passed)

### Phase 12 quality review

Independent docs-only review found one Major artifact-link defect: the Crash safety course's
repository links targeted files not yet present on `master`. AR-92 pinned both links to their
already-pushed immutable commit and strengthened the course oracle with repository-object checks.
The permitted fix-scoped re-review cleared RV-012-001 with no correction-introduced findings.
Focused verification passes 16/16, the rebuilt output passes 21/21 checks, and the reviewed-state
authoritative gate passes (`/tmp/tmp.Tx5wRe9c3p`).

## Completion Definition

The plan is complete only when every task is checked, ST-1…ST-32 are green, the content review is
recorded, old specialist pages/routes are absent, all cataloged examples paint and interact as
specified, plugin drift checks pass when applicable, and `yarn verify` succeeds.
