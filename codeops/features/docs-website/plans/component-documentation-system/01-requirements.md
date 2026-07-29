# Requirements Delta: Component Documentation System

> **Source requirement**: [RD-05](../../requirements/RD-05-component-docs.md)
> **Plan**: component-documentation-system
> **Scope rule**: RD-05 is authoritative; this file records planning clarifications only.

## In Scope

| ID | Planning requirement | Source |
|---|---|---|
| PR-1 | Introduce a checked-in component catalog covering public visual components and major application surfaces, with deterministic validation against package barrels, pages, anchors, examples, sidebars, related links, and API symbols. | RD-05 AC-1 |
| PR-2 | Keep Button, Input, and Text as the reference implementations; integrate them into catalog/structural checks without redesigning their teaching intent. | RD-05 AC-3 · AR-3 |
| PR-3 | Upgrade every other existing standard component page to `component-page-template1` and rebuild every other existing component live example to `template1`. | RD-05 AC-2/3/4 · AR-3/4/5 |
| PR-4 | Add standard pages, navigation, API links, and examples for every missing primary visual/application surface in the RD-05 coverage matrix. | RD-05 AC-1/2/5 · AR-2/12 |
| PR-5 | Replace the old Data Grid page with a dedicated `/components/data-grid/` hub, specialist sidebar, required topic pages, and focused examples derived from showcase capabilities. | RD-05 AC-6/8 · AR-6/7/9/17 |
| PR-6 | Replace the old Code Editor guide with a dedicated `/components/code-editor/` hub, specialist sidebar, required topic pages, and focused examples derived from the scenario catalog. | RD-05 AC-7/8 · AR-6/8/9/17 |
| PR-7 | Rewrite the Components overview as a linked family and application-composition map driven or validated by the catalog. | RD-05 AC-5 |
| PR-8 | Extend hard-fail specification coverage for catalog parity, page structure, template examples, hub topology, stale routes, links, compile/smoke, accessibility, sanitization, and lazy loading. | RD-05 AC-9/10/11/12 · AR-14/15/16 |

## Clarified Constraints

| Constraint | Meaning |
|---|---|
| Catalog granularity | A primary standard component gets its own page. A tightly coupled public visual symbol may point to an anchored section in an owning page/hub. |
| Example granularity | Every primary standard page owns at least one registered live example. Coupled symbols can share a focused example; specialist pages can host several. |
| Specialist examples | Docs examples are purpose-built modules. They may adapt data and behavior from kitchen-sink/showcase scenarios but do not import those registries at runtime. |
| Runnable source vs snippets | Registry `sourcePath` identifies the compiled runnable module. Markdown snippets are separate essence-only teaching artifacts and never paste or extract a complete live-example module. |
| Route migration | Remove `components/table/data-grid.md` and `guide/code-editor.md`; update all repository-internal links. No compatibility pages are added. |
| Maturity | The catalog has no maturity/status field and pages display no maturity badge. |
| Verification | Focused docs-site checks during implementation; `yarn verify` is the final authority. |

## Out of Scope

- Generated TypeDoc generation internals.
- Runtime component or SDK behavior changes.
- Playground/REPL work.
- Direct migration of all 67 Data Grid stories or all 31 Code Editor source scenarios; the hub's
  21 docs examples are separately selected by capability coverage.
- Pages for non-visual helper/type/algorithm/controller/engine symbols.
- Public-route redirects for the removed, broken specialist pages.
- A component maturity/stability policy.

## Acceptance Mapping

| RD-05 criterion | Plan requirement |
|---|---|
| AC-1 | PR-1, PR-4 |
| AC-2 | PR-3, PR-4 |
| AC-3 | PR-2, PR-3 |
| AC-4 | PR-3, PR-8 |
| AC-5 | PR-4, PR-7 |
| AC-6 | PR-5, PR-8 |
| AC-7 | PR-6, PR-8 |
| AC-8 | PR-5, PR-6, PR-8 |
| AC-9 | PR-1, PR-3, PR-4, PR-5, PR-6 |
| AC-10 | PR-8 |
| AC-11 | PR-3, PR-5, PR-6, PR-8 |
| AC-12 | PR-8 |
