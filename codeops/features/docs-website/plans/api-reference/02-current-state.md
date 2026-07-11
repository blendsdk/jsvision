# Current State: API Reference (TypeDoc)

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The VitePress site (RD-01) and the live-example system (RD-03) ship. There is **no TypeDoc anywhere
in the repo** (`grep typedoc packages/ scripts/` is empty). The API section is a routed skeleton
awaiting generated content:

- `packages/docs-site/api/index.md` — a **committed placeholder** ("The API reference is generated
  from the source and lands in a later milestone. This page exists so the navigation skeleton has no
  dead links.").
- `packages/docs-site/.vitepress/config.ts` — a top-nav item `{ text: 'API', link: '/api/' }`
  (`:113`) and a **static** sidebar object with `'/api/': [{ text: 'API Reference', items: [{ text:
  'Overview', link: '/api/' }] }]` (`:193`). The whole sidebar is a hand-authored object literal
  (`:118`), not generated.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/docs-site/package.json` | docs-site scripts + devDeps | Add `docs:api` (`typedoc`); add TypeDoc + plugin + theme devDeps |
| root `package.json` | `verify` (`:23`), `docs:build` (`:29` = docs-site `vp:build`) | Add root `docs:api`; chain `docs:build` = `docs:api && … vp:build` |
| `packages/docs-site/.vitepress/config.ts` | nav (`:113`) + static sidebar (`:118`, `/api/` at `:193`) | Import the generated `typedoc-sidebar.json` for the `/api/` route |
| `packages/docs-site/api/index.md` | placeholder preface | Rewrite as the hand-written "how to read this" preface (kept committed) |
| `packages/docs-site/.gitignore` (or root `.gitignore`) | build-output ignores | Ignore the generated `api/<pkg>/**` trees |
| `packages/docs-site/scripts/check-docs-build.mjs` | 14-check build-output gate | Add the API coverage / leakage / link-resolution / determinism checks |
| `.github/workflows/docs.yml` | runs `yarn docs:build` (`:55`, `:91`) | **No edit** — picks up `docs:api` via the chained root `docs:build` |
| RD-05 component pages (`packages/docs-site/components/**/*.md`) | hand-written pages with a `## Related` section | Add a forward "API reference →" link per mapped component |

### Code Analysis — the public barrels TypeDoc will read

Entry points differ per package (the one non-obvious grounding fact):

| Package | Public entry | `private`? | Scale |
| ------- | ------------ | ---------- | ----- |
| `@jsvision/core` | `packages/core/src/engine/index.ts` | no | 14 re-export lines fanning out to the engine subsystems (the largest surface) |
| `@jsvision/ui` | `packages/ui/src/index.ts` | **yes** | 55 export lines |
| `@jsvision/files` | `packages/files/src/index.ts` | **yes** | 25 export lines |
| `@jsvision/web` | `packages/web/src/index.ts` (+ a `browser-stubs` subpath to **exclude**) | **yes** | 6 export lines |

Every public export already carries JSDoc with an `@example` (enforced repo-wide by
`scripts/check-jsdoc.mjs`), so every generated reference entry will have runnable usage without
new authoring.

The docs-site vitest project is `unit` (`vitest run --project unit`), and it participates in
`yarn verify`'s test + typecheck phases; only its **build** is isolated (the `vp:build` script name
keeps turbo's `build`/`check:deps` off it). This is the seam the pure-helper spec tests plug into.

## Gaps Identified

### Gap 1: No generation pipeline
**Current:** the API section is a static placeholder; types are documented only inline in `src`.
**Required:** a deterministic `yarn docs:api` that emits per-symbol markdown for the four barrels.
**Fix:** `03-01-generation-pipeline.md`.

### Gap 2: No site integration or cross-links
**Current:** a one-item static `/api/` sidebar; component pages link only to GitHub source (post-rollout).
**Required:** a generated sidebar the config imports; bidirectional component↔reference links.
**Fix:** `03-02-integration-cross-linking.md`.

### Gap 3: No drift/leakage guard
**Current:** nothing asserts the reference matches the barrels or excludes internals.
**Required:** coverage + leakage + link-resolution + determinism gates.
**Fix:** `03-03-gating-anti-drift.md` + `07-testing-strategy.md`.

## Dependencies

### Internal Dependencies
- RD-01 (site shell + nav + the `/api/` route) — **done**.
- RD-05 component pages — **present** (the rich-template rollout); the forward-link targets.

### External Dependencies
- `typedoc`, `typedoc-plugin-markdown`, `typedoc-vitepress-theme` — **new docs-site devDeps** (pinned
  to a mutually-compatible set at install; must not enter any shipped package's graph — `check:deps`).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Plugin/theme path scheme differs from hand-authored forward links → dead-link build failure (AC-5) | Med | High | Single symbol↔page map as the source of truth; the gate asserts every mapped `api` path exists in the generated tree before links can 404 |
| TypeDoc emits a timestamp/date footer → non-deterministic (AC-4) | Med | Med | Configure page-header/footer options off; source links pinned to the built commit; determinism check re-runs and diffs |
| Version skew between `typedoc` and the plugin/theme (major-version coupling) | Med | Med | Pin a known-compatible trio at install; a smoke generation task in Phase 1 proves the trio before wiring |
| Generated tree is large (core fans out to many subsystems) → slow build | Low | Low | Generation reads source once; output is gitignored, cached by turbo's docs pipeline is N/A (build isolated) — measured in Phase 1 |
| Private-package API published while unreleased | Low | Low | Intentional (AR-6); pre-release badge on ui/files/web |
