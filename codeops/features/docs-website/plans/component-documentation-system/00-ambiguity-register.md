# Ambiguity Register: Component Documentation System

> **Document**: 00-ambiguity-register.md
> **Plan**: component-documentation-system (feature: docs-website, RD-05)
> **Gate status**: ✅ GATE PASSED — 2026-07-29
> **Last updated**: 2026-07-29

This register records every material decision that the RD-05 refresh and implementation plan will
rely on. `AR-N` identifiers are local to this plan. Rows sourced from the requirements register or
the user's accepted five-part direction are authoritative. The repository inventory surfaced three
additional decisions, all resolved by the user on 2026-07-29.

## Legend

Status: ✅ Resolved · ⏳ Open. Source: `requirements` = inherited from the docs-website requirements
register; `accepted-five` = explicitly accepted by the user on 2026-07-29; `template directives` =
the user-approved `AGENTS.md` documentation templates; `inventory` = repository evidence that does
not require a product choice; `preflight` = a user-authorized technical remediation selected during
the formal plan audit.

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
