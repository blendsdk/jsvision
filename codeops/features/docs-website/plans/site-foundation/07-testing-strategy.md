# 07 · Testing Strategy — Site Foundation

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)
> **CodeOps Skills Version**: 3.3.2

A docs site's "spec tests" are **build-output and structural assertions** over the produced `dist`,
plus a few integrity checks against the existing repo. They run as a Node script
`packages/docs-site/scripts/check-docs-build.mjs` (repo idiom: `check-jsdoc.mjs`/`gate.mjs`),
invoked after `yarn docs:build` in the docs CI job. This script is the seed of the RD-09
`check:docs-site` gate. Deploy-only behaviors (a live URL) are **manual acceptance** steps, flagged
below (a deploy is not unit-testable).

Specification-first: write `check-docs-build.mjs` asserting ST-1…ST-13 **first** (red — no site
exists yet), then implement each phase to turn them green.

## Specification Test Cases

| ST | Assertion | Input → Expected | Source | Auto? |
|----|-----------|------------------|--------|-------|
| ST-1 | Build + base prefixing | `yarn docs:build` exits 0; `.vitepress/dist/index.html` exists; **every** `src`/`href` asset path starts with `/jsvision/` | RD-01 AC-1 · AR-7 | ✅ |
| ST-2 | Section pages build | Each nav section (Home, Guide, Components, Apps, API, Reference) has a built HTML page in `dist` | RD-01 AC-4 | ✅ |
| ST-3 | Live deploy | Merge to `master` → `https://blendsdk.github.io/jsvision/` returns 200 with the site `<title>`; a PR → a commented preview URL serves the changed page | RD-01 AC-2, AC-3 · AR-1 | ⛳ manual |
| ST-4 | No dead links | A link-check over `dist` finds zero broken internal links; the nav/sidebar skeleton is present | RD-01 AC-4 | ✅ |
| ST-5 | Local search, no 3rd-party | The local search index is emitted into `dist`; loading a page issues **no** network request to a non-`self` host for search | RD-01 AC-5 · AR-8 | ✅ (index) / ⛳ (network) |
| ST-6 | Code UX | A TS code block renders with Shiki highlight markup and a copy-button element | RD-01 AC-7 | ✅ |
| ST-7 | Dark/light + contrast | Both color schemes defined; body-text contrast ≥ 4.5:1 **computed from the brand tokens** in each (tokens-level or manual for RD-01; full axe a11y is RD-10, PF-007) | RD-01 AC-6 | ✅ (tokens) |
| ST-8 | SEO meta | Every built page has a unique `<title>` + `og:title`/`og:description`/`og:image` + `twitter:card` | RD-01 AC-8 | ✅ |
| ST-9 | CSP present, safe, honored | Every built page has `<meta http-equiv="Content-Security-Policy">` with **no** `unsafe-eval`; loading the **built** site produces **zero CSP violations** (VitePress inline scripts covered by SHA-256 hashes in `script-src`, PF-003) | RD-01 AC-8, AC-11 · AR-9 | ✅ (meta) / ⛳ (runtime) |
| ST-10 | Static SEO assets | `dist/sitemap.xml`, `dist/robots.txt`, a favicon, and a `dist/404.html` all exist | RD-01 AC-8 | ✅ |
| ST-11 | Migration completeness | Every former `docs/` website page (architecture/decisions/guides/index) has a row in `redirects.md` **and** a rendered page in `dist` | RD-01 AC-9 · AR-2 | ✅ |
| ST-12 | Spec-oracle integrity | `docs/acceptance-gate.md` is byte-unchanged; `packages/core/test/gate.spec.test.ts` passes; `yarn verify` is green | RD-01 AC-9 · AR-2 | ✅ |
| ST-13 | No dep leak | `yarn check:deps` passes for `@jsvision/core`/`ui`/`files`/`web` (docs toolchain did not leak a runtime dep) | RD-01 AC-10 · AR-3 | ✅ |
| ST-14 | Deploy workflow safety | `docs.yml` triggers on the right paths; permissions = `contents:write` + `pull-requests:write`; uses only `GITHUB_TOKEN` (no stored secret) | RD-01 AC-11 (security) | ✅ (lint/parse) |

## Notes

- ST-3 and the network half of ST-5 are verified once, manually, right after Pages is enabled
  (recorded as explicit acceptance steps in the execution plan) — everything else is automated in CI.
- `check-docs-build.mjs` is intentionally reusable: RD-09 extends it into the merge-blocking
  `check:docs-site` gate (coverage of components/examples) — here it covers only the RD-01 surface.
