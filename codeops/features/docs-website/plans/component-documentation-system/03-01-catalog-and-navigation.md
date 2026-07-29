# Specification: Component Catalog and Navigation

> **Requirements**: PR-1, PR-4, PR-7, PR-8
> **Decisions**: AR-2, AR-10, AR-11, AR-12, AR-13, AR-14, AR-17, AR-18, AR-19

## Objective

Create one machine-readable inventory that answers:

- Which public visual surfaces are component documentation?
- Where is each symbol taught?
- Which live examples prove it?
- Where does it appear in navigation?
- Which related and generated API targets must resolve?
- Is it a standard page or part of a specialist hub?

The catalog is the source for coverage validation and should drive sidebar rows where doing so keeps
the VitePress config readable. It is not a replacement for the lazy example registry.

## Files

| File | Change |
|---|---|
| `packages/docs-site/components.json` | New checked-in catalog data. |
| `packages/docs-site/src/components/component-catalog.mjs` | New pure loader, schema validator, index builder, and navigation projection. |
| `packages/docs-site/.vitepress/config.ts` | Consume projected standard navigation and install more-specific specialist sidebars. |
| `packages/docs-site/src/api/api-map.mjs` | Remain checked in; exact rows are validated against catalog component ownership. |
| `packages/docs-site/src/api/component-target.mjs` | New shared parser that separates a component route from its optional heading fragment, derives a fragment-free label, and resolves plain-page or directory-landing build keys. |
| `packages/docs-site/src/api/validate-api-map.mjs` and declarations | Derive the package allowlist from `PACKAGES` and validate fragment-aware component targets. |
| `packages/docs-site/scripts/check-docs-build.mjs` and API backlink consumers | Resolve the parsed route to built HTML and preserve the fragment only for heading/backlink validation. |
| `packages/docs-site/test/component-catalog.spec.test.ts` | Requirement-derived catalog/parity oracle. |
| `packages/docs-site/test/component-catalog.impl.test.ts` | Parser/index edge cases and diagnostic quality. |

## Catalog Schema

The JSON document is an object with `schemaVersion: 1` and `entries: []`. Every row has the common
fields `kind`, `id`, `title`, `family`, `page`, `related`, and `sidebarOrder`, then satisfies exactly
one union branch:

| Entry kind | Required fields | Ownership and example rule |
|---|---|---|
| `component` | `package`, non-empty `symbols`, `complexity`, non-empty `examples`, `apiSymbols`, `primary` | Owns public visual symbols. `complexity` is `standard`, `data-grid-hub`, or `code-editor-hub`. Exactly one primary component row owns each standard page; coupled symbols may target stable anchors. |
| `topic` | `hub`, `profile`, `examples` | Owns a specialist route and navigation position, never a public symbol. `hub` is `data-grid` or `code-editor`; `profile` is `landing`, `capability`, or `api`. Only an `api` topic may have an empty example list. |

`page` is a site-absolute component route with an optional `#kebab-case-anchor`. `related` contains
catalog IDs, never raw URLs. `apiSymbols` contains `{ package, symbol }` targets that resolve in
generated TypeDoc. Fields belonging to the other union branch are rejected.

There is deliberately no `status`, `maturity`, or badge field.

## Validation Rules

1. Parse failures identify the file and JSON/schema path.
2. IDs are globally unique. `(package,symbol)` ownership is unique across component entries.
   `(family,sidebarOrder)` is unique for standard components and `(hub,sidebarOrder)` is unique for
   specialist topics.
3. Page paths are component routes and anchors use stable kebab-case.
4. Every declared runtime symbol is exported by its package public barrel.
5. Every catalog page exists; every declared anchor exists as a rendered Markdown heading.
6. Every declared example exists exactly once in `EXAMPLES`.
7. Every component entry and every non-API topic has at least one example.
8. Coupled component rows may share examples but cannot have an empty mapping; topic entries never
   claim symbols.
9. Every `related` ID resolves and is not self-referential.
10. Every API symbol resolves through generated API metadata/map. Component target tests cover plain
    pages, directory landings (`index.html`), and both forms with fragments.
11. Standard navigation contains every primary `standard` component page exactly once.
12. Data Grid and Code Editor topic entries appear exactly once in their prefix sidebar and satisfy
    their selected `landing`, `capability`, or `api` page profile.
13. No page target or API-map row uses `/components/table/data-grid` or `/guide/code-editor`.
14. No cataloged component Markdown page contains `<PlayComingSoon`.

## Navigation Projection

| Prefix | Source | Behavior |
|---|---|---|
| `/components/data-grid/` | Topic entries with `hub=data-grid` | Dedicated Data Grid topic menu. Representative URLs must resolve this menu under VitePress's most-specific-prefix behavior. |
| `/components/code-editor/` | Topic entries with `hub=code-editor` | Dedicated Code Editor topic menu. Representative URLs must resolve this menu under VitePress's most-specific-prefix behavior. |
| `/components/` | Primary `standard` component entries grouped by `family` plus hub landing links | Complete standard catalog without manually duplicated page lists. |

Source order keeps specialist prefixes near `/components/` for readability, but tests assert the
resolved sidebar for representative URLs rather than relying on object insertion order.

The theming gallery/designer may remain supporting links, but they are not cataloged as component
pages and cannot satisfy component coverage.

## Public-Surface Classification

The initial catalog is seeded from RD-05's coverage matrix. Validation compares only explicitly
declared visual exports, not all barrel exports, because helper/type/engine exports are intentionally
out of scope. The classification list itself is tested as a requirements fixture so an implementation
cannot silently shrink it to match whatever data happens to be present.

## Failure Diagnostics

Errors are grouped by component ID and state the expected repair:

- missing export → fix catalog package/symbol or document newly exported visual surface;
- missing page/anchor → add the target or correct the catalog;
- missing example → implement/register the required example;
- sidebar mismatch → regenerate/reorder the projection;
- stale route → replace the internal link;
- API mismatch → correct `apiSymbols`, the checked-in map, or the shared component-target parser.

## Verification

- Specification: ST-1 through ST-8, ST-31, ST-32.
- Focused: `yarn workspace @jsvision/docs-site test component-catalog`
- Final: `yarn verify`
