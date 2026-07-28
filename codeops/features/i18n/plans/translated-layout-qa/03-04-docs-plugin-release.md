# Specification: documentation, plugin, and release closure

> **Status**: Ready for implementation
> **Requirements**: RQ-4; AC-13, AC-14
> **CodeOps Artifact Schema**: 1

## Public documentation

Document the button-group API where consumers discover Button and layout:

- natural translated width and configured minima;
- equal siblings across one or several rows;
- stable row-major wrapping and vertical action columns;
- viewport negotiation versus absolute hard bounds;
- wide/combining caption behavior and accelerator markup;
- the single-parent/single-composition invariant.

API comments include junior-readable examples. Generated API pages are refreshed with the
repository command if public exports affect them.

## Example migration

Update localized documentation examples, including the i18n theme designer, to measure real Buttons
and compose them through the public helper. Do not rewrite intentionally fixed English fixtures or
test-data demos that do not consume package translations.

Document `demo:i18n`, the official locale list, fresh reconstruction behavior, story registry, and
how application overrides exercise layout without translating caller-owned data.

## Canonical and generated plugin

Review at least:

- `tools/jsvision-skill/references/layout.md`;
- `tools/jsvision-skill/references/recipes/forms-dialogs.md`;
- `tools/jsvision-skill/references/recipes/theme-designer.md`;
- package/API/demo references reported by `tools/jsvision-plugin-impact.json`.

Run `yarn plugin:update`; inspect and include its generated API pages, synchronized snippets,
impact snapshot, and assembled plugin copy. Never edit `plugins/jsvision-plugin/skills/jsvision/`
directly.

## Release gates

1. Focused UI, Forms, Files, Datagrid, Code Editor, examples, docs, and canonical-skill tests pass.
2. `yarn plugin:check` passes.
3. Locale generation/check remains clean for all five packages and ten locales.
4. Review tooling requires current digest-bound evidence with a disclosed supported method; no
   identity or approval is fabricated.
5. `yarn verify` passes.
