# Tooling, documentation, and plugin: Code Editor internationalization

> **Document**: 03-03-tooling-docs-plugin.md
> **Parent**: [Index](00-index.md)

## Overview

This component registers Code Editor with every existing package-locale quality surface, documents
the public workflow, and synchronizes the supported Codex plugin SDK surface per FR-8, FR-9, and
FR-11. *(AR-9, AR-12, AR-13)*

## Shared locale configuration

Add `{ "name": "code-editor", "symbolPrefix": "codeEditor" }` to
`tools/i18n-locale-exports.json`. Refactor consumers so package counts and output totals derive from
the validated configuration instead of literals such as four packages, forty entry points, or
thirty-six reviews. Configuration validation still allowlists package/locale path segments and
rejects duplicates. *(AR-9, AR-11)*

The locale generator owns all ten `src/locales/*.ts` modules and the package export map. No
handwritten per-locale entry pattern is added. Generated output messages report the derived count.

## Validation and review tooling

- Locale specification tests load Code Editor subpaths, compare every locale with English, validate
  plural kinds/placeholders/safety, inspect its public accelerator manifest, and prove no eager
  catalog registry.
- Accelerator collision tests run only for declared scopes; an empty manifest is valid and does not
  weaken validation for packages that own scopes. *(AR-10)*
- Literal auditing includes `packages/code-editor/src`, recognizes Code Editor projector calls, and
  classifies every candidate in `tools/i18n-literals.json`.
- Review tooling loads every configured non-English package catalog and derives the expected total.
  `tools/i18n-translation-reviews.json` is changed only when real proficient reviewers provide
  current digest attestations. *(AR-12)*
- Cross-package examples/layout checks recognize the fifth catalog where their purpose is catalog
  completeness. The comprehensive viewport expansion stays in #185. *(AR-8, AR-13)*

## Documentation

Update:

- `packages/code-editor/README.md` with service injection, isolated fallback, locale subpaths, and
  external-content ownership.
- `packages/docs-site/guide/code-editor.md` with an application-owned service and override example.
- i18n guide/reference/entry-point pages and their tests to include Code Editor.
- API generation inputs through normal public exports; generated output is never hand-edited.

Examples use explicit imports and show application catalog precedence. They state that source,
query/replacement values, language IDs, filenames/paths, key tokens, and LSP/host content remain
caller data. *(AR-5, AR-15)*

## Canonical skill and generated plugin

Update canonical sources only:

- `tools/jsvision-skill/references/i18n.md`
- `tools/jsvision-skill/references/recipes/i18n-app.md`
- Code Editor API/component references as reported by the impact checker
- `tools/jsvision-plugin-impact.json`

The internationalization impact area gains `packages/code-editor/src`; the existing Code Editor area
continues covering component/API references. Run `yarn plugin:update`, inspect every reported
reference, and commit the generated `plugins/jsvision-plugin/skills/jsvision/` changes with the
source changes. Run `yarn plugin:check`. *(AR-9)*

## External review handoff

Once catalog bytes stabilize:

1. build locale outputs;
2. derive the nine Code Editor catalog digests through the existing review tooling;
3. provide catalogs/digests to proficient speakers;
4. add attestations only from the named reviewers;
5. rerun `yarn i18n:reviews:check`.

This execution may prepare steps 1–3 but cannot claim steps 4–5 without external authority.
*(AR-12)*

## Error handling

| Error case | Strategy | AR Ref |
|---|---|---|
| Invalid/duplicate package config | Generator/check fails before resolving paths | AR-9, AR-11 |
| Generated entry drift | `i18n:locales:check` fails with exact paths | AR-9 |
| Literal unclassified or stale | `check:i18n-literals` fails until ownership manifest matches source | AR-9 |
| Missing/stale human review | Review check reports package/locale; no synthetic approval | AR-12 |
| Canonical/plugin drift | `plugin:check` fails; rerun generator from canonical sources | AR-9 |
| #185 registry absent | No duplicate harness; report later integration dependency | AR-13 |

## Testing requirements

- Configuration validation and derived package/entry/review counts.
- All ten Code Editor subpath imports and declarations after build.
- Literal ownership completeness and stale-entry rejection.
- Docs entry-point and example compilation tests.
- Canonical skill recipe import coverage and plugin drift check.
- Full `yarn verify`, with external review status reported separately.
