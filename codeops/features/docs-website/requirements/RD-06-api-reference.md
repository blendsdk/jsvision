# RD-06: API Reference (TypeDoc)

> **Document**: RD-06-api-reference.md
> **Status**: Draft
> **Created**: 2026-07-09
> **Project**: jsvision
> **Feature-Set**: docs-website
> **Depends On**: RD-01 (site shell + nav)
> **CodeOps Skills Version**: 3.3.2

---

## Feature Overview

The **generated API reference**: complete, always-accurate, symbol-level documentation produced by
**TypeDoc** from the packages' source and emitted as **markdown into the VitePress site**
(`typedoc-plugin-markdown`), so it shares one theme, one navigation, one search box, and one
dark/light mode with the rest of the docs. It is **regenerated in CI** from the public `index.ts`
surface, so it can never drift from the shipped types. The hand-written component pages (RD-05) link
into it for exhaustive signatures; this RD owns the exhaustive, mechanical reference.

---

## Functional Requirements

### Must Have

- [ ] **TypeDoc + `typedoc-plugin-markdown`** wired for the documented packages (`@jsvision/core`,
      `@jsvision/ui`, `@jsvision/files`, `@jsvision/web`), scoped to each package's **public entry
      point** (`src/index.ts`) — internals (deep `src/**` modules) are excluded, matching the project's
      "public surface = index.ts" contract.
- [ ] Output is written into a VitePress content dir (e.g. `packages/docs-site/api/`) that RD-01's
      nav/sidebar already routes to, and renders inside the site's theme with working links.
- [ ] A generation command (`yarn docs:api`) produces the markdown deterministically from the built
      `.d.ts` / source; the CI docs build runs it before the VitePress build so the API pages are
      always current.
- [ ] The reference covers, per symbol: signature, type parameters, parameters, return type,
      the JSDoc description, and the `@example` block (the repo already requires `@example` on public
      exports, enforced by `check-jsdoc.mjs`) — so every reference entry carries runnable usage.
- [ ] **Cross-linking**: component pages (RD-05) link to the corresponding reference symbol, and
      reference entries link back to the component page where one exists (via a mapping or TypeDoc
      link resolution).

### Should Have

- [ ] The generated API tree is grouped by package and by kind (classes, functions, types) for
      navigability.
- [ ] Source links from each symbol to its definition on GitHub at the built commit.
- [ ] A short "how to read this" preface page for the API section.

### Won't Have (Out of Scope)

- Hand-written narrative/component docs — RD-05.
- Documenting non-public internals — deliberately excluded (public surface = `index.ts`).
- Versioned/multi-version API docs — deferred (AR-18); a single "latest" reference for now.

---

## Technical Requirements

- TypeDoc config per package (or one workspace config with entry points) pointing at each
  `src/index.ts`; `excludeInternal`, `excluderivate`, and entry-point strategy set so only the public
  surface is emitted.
- `typedoc-plugin-markdown` (+ the VitePress-oriented frontmatter/plugin) so output is `.md` with the
  right sidebar frontmatter; a post-step generates the API sidebar entries consumed by RD-01's config.
- Determinism: generation from the checked-in source yields identical output across runs (no
  timestamps in content) so diffs are meaningful and CI is stable.
- TypeDoc + plugin are **devDependencies of `docs-site` only** — they must not enter any shipped
  package's dependency graph (`check:deps` unaffected).

---

## Integration Points

### With RD-01 (site shell)
- Emits into the routed `api/` dir; contributes generated sidebar entries to the VitePress config.

### With RD-05 (component docs)
- Bidirectional links: component page ↔ reference symbol; props tables reference the `*Options` types.

### With RD-09 (anti-drift)
- `yarn docs:api` runs in the CI docs pipeline; a stale/failed generation fails the build, keeping the
  reference in lockstep with the code.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Reference tool/integration | TypeDoc→md→VitePress / TypeDoc HTML / hand-written | TypeDoc → markdown → VitePress | Unified theme/nav/search; CI-regenerated | AR-7 |
| Scope of symbols | All internals / public `index.ts` only | Public `index.ts` surface only | Matches the project's public-API contract | AR-7 |
| Versioning | Multi-version now / single latest | Single "latest" | Pre-1.0; versioning deferred | AR-18 |

---

## Security Considerations

> **🚨 MANDATORY section.**

- **Data sensitivity**: none — reference is generated from source; no secrets are in the public source.
- **Input validation / injection**: output is static generated markdown rendered by VitePress
  (escaped/highlighted); no user input.
- **Authentication / rate limiting / encryption / infra**: N/A beyond RD-01. TypeDoc/plugin are pinned
  build deps covered by `npm audit`; they never enter a shipped package.
- **Leakage**: generation is scoped to `index.ts` public surface, so private internals and any
  incidental internal notes are not published.

---

## Acceptance Criteria

1. [ ] `yarn docs:api` generates markdown under `packages/docs-site/api/` for `@jsvision/core`,
       `@jsvision/ui`, `@jsvision/files`, and `@jsvision/web`, covering **every** symbol exported from
       each package's `src/index.ts` and **no** symbol that is not exported there (spot-checked against
       the barrels).
2. [ ] The generated API pages render inside the VitePress site (site theme, working sidebar, included
       in local search) — not as a separate standalone site.
3. [ ] A reference entry for a representative symbol (e.g. `createApplication`) shows its signature,
       parameters, return type, description, and its `@example`.
4. [ ] Running `yarn docs:api` twice on the same source produces byte-identical output (deterministic).
5. [ ] The CI docs build runs `yarn docs:api` before the VitePress build; a component page's "API"
       link resolves to the correct generated symbol page (link-check passes).
6. [ ] `yarn check:deps` still passes for all shipped packages — TypeDoc/plugin did not leak into any
       runtime dependency graph.
7. [ ] Security requirements verified: no symbol outside the public `index.ts` surface appears in the
       generated reference (internal leakage check).
