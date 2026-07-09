# Requirements & Scope — Site Foundation

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-01](../../requirements/RD-01-site-foundation.md)
> **CodeOps Skills Version**: 3.3.2

## In Scope

1. A private workspace `packages/docs-site` (`@jsvision/docs-site`, `private:true`) running VitePress,
   joined to yarn workspaces + a turbo `docs-site#build`/`docs-site#dev`, with root `yarn docs:build`
   / `yarn docs:dev` scripts. **Isolated** from `yarn verify` (AR-3).
2. Production build with `base:'/jsvision/'` → static `dist`, deployed to
   `https://blendsdk.github.io/jsvision/` on merge to `master`.
3. A GitHub Actions pipeline: production `gh-pages` deploy on `master`, and a **live preview URL per
   PR** (`/pr-preview/pr-N/`), auto-cleaned on close (AR-1).
4. The IA nav + sidebar skeleton: Home · Guide · Components · Apps · API · Reference (placeholder
   pages allowed; later RDs fill them).
5. VitePress **local search**; dark/light; code-block **copy button** + **Shiki** TS highlighting.
6. SEO surface: per-page title/description, OG/Twitter cards (placeholder OG image, AR-11),
   `sitemap.xml`, `robots.txt`, favicon, branded 404; a `<meta>` **CSP** (AR-9).
7. Absorb the existing root `docs/` website content (`architecture/`, `decisions/`, `guides/`,
   `index.md`, `.vitepress/`) into the site as the Reference/Architecture/ADR/Guides sections, with a
   checked-in redirect/mapping table; **keep `docs/acceptance-gate.md` in place** (AR-2).

## Out of Scope (later RDs)

- Live demos / Play button / xterm / `@jsvision/web` — RD-02, RD-03.
- Landing/marketing copy, Core Concepts — RD-04. Component pages — RD-05. API reference — RD-06.
- The `check:docs-site` gate, screenshot/OG generation, README rewrite, `llms.txt` — RD-09.
- Versioned docs / version switcher — deferred (requirements AR-18).

## Success Criteria (Definition of Done)

- `yarn docs:build` produces a `dist` whose asset URLs are all `/jsvision/`-prefixed.
- Merge to `master` publishes the live site (HTTP 200, correct `<title>`); a PR yields a live preview URL.
- Nav/sidebar skeleton renders with **no dead links**; local search returns results with no third-party request.
- Dark/light works; a TS code block highlights + copies.
- Every page carries a unique title/description, OG meta, and a meta-CSP; `sitemap.xml`/`robots.txt`/`404` exist.
- Every former `docs/` website page renders in the new site (mapping checked in); `docs/acceptance-gate.md`
  untouched and `packages/core/test/gate.spec.test.ts` still passes.
- `yarn check:deps` green for all shipped packages (no docs toolchain leak); `yarn verify` unaffected by
  the docs-site addition.

## Required Tests

Specification tests ST-1…ST-14 in [07-testing-strategy.md](07-testing-strategy.md) — build-output and
structural assertions (base prefixing, nav link-check, CSP/SEO presence, search index, migration
completeness, spec-oracle integrity).
