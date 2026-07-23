# Ambiguity Register: Site Foundation & Delivery Pipeline (RD-01 plan)

> **Status**: ✅ GATE PASSED — all 11 items resolved
> **Last Updated**: 2026-07-09
> **Scope**: plan-level decisions for RD-01. Requirements-level decisions are already resolved in
> `../../requirements/00-ambiguity-register.md` (33/33) and imported here as pre-resolved context.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Technical/Integration | PR-preview delivery + the production Pages deploy model (Pages serves from one source) | Live preview URLs per PR (gh-pages branch model) / downloadable build artifact per PR (official Actions model) | **Live preview URLs**: prod deploys to the `gh-pages` branch (peaceiris/actions-gh-pages); each PR publishes to `/pr-preview/pr-N/` via `rossjrw/pr-preview-action` with a commented live URL, auto-cleaned on close | ✅ Resolved |
| 2 | Technical/Data | How to absorb the existing root `docs/` techdocs | Move website content + keep `acceptance-gate.md` / move everything incl. `acceptance-gate.md` (edit the spec-test oracle + tooling) / keep `docs/` in place + point VitePress at it | **Move website content** (`architecture/`, `decisions/`, `guides/`, `index.md`, `.vitepress/`) into `packages/docs-site`; **leave `docs/acceptance-gate.md` in place** (it is the oracle for `packages/core/test/gate.spec.test.ts` + `scripts/gate.mjs`); a checked-in redirect/mapping table covers moved pages | ✅ Resolved |
| 3 | Technical/Non-functional | Is the docs-site build part of repo-wide `yarn verify`? | Isolated (own `docs:build` + dedicated CI job) / part of `yarn verify` (turbo build) | **Isolated**: `yarn docs:build` + a dedicated CI job (+ the later `check:docs-site` gate); NOT in the default `turbo run build`/verify, so shipped-package verify stays fast and decoupled | ✅ Resolved |
| 4 | Naming/Process | The verify command that fills the plan's Verify lines | `yarn verify` (shipped-package checks) + `yarn docs:build` (site build) | Shipped-package checks = `yarn verify`; docs-specific tasks verify with `yarn docs:build` (site is isolated per AR-3) | ✅ Resolved |
| 5 | Technical | Static-site generator | VitePress / Docusaurus / Astro | VitePress | ✅ Resolved — imported (requirements AR-28) |
| 6 | Technical | Site placement + fate of `docs/` | New `packages/docs-site` absorbing `docs/` | New `packages/docs-site` workspace | ✅ Resolved — imported (requirements AR-23) |
| 7 | Technical | Deploy host + URL/base | GitHub Pages project subpath `base:'/jsvision/'` + PR previews | GitHub Pages, `base:'/jsvision/'` | ✅ Resolved — imported (requirements AR-4, AR-8) |
| 8 | Technical | Search | VitePress local search | VitePress local | ✅ Resolved — imported (requirements AR-12) |
| 9 | Security | Static-site security posture | Full posture incl. meta-CSP | Full posture (meta-CSP, HTTPS, pinned+audited build deps, no secrets) | ✅ Resolved — imported (requirements AR-26) |
| 10 | Process | Content authoring | Agents draft → user reviews | Agents draft → user reviews | ✅ Resolved — imported (requirements AR-21) |
| 11 | UX/Non-functional | Phase-A hero/OG image (real assets come from RD-09 Playwright later) | Static placeholder now / block on RD-09 | Static placeholder OG/hero image in Phase A; replaced by the generated asset in RD-09 | ✅ Resolved — obvious sequencing (RD-09 owns generation); low-stakes |

| 12 | Technical/Security (runtime) | PF-003's "hard-code the SHA-256 hashes of VitePress's inline scripts into the meta-CSP" is fragile: VitePress emits a `window.__VP_HASH_MAP__` inline script whose content (and thus its hash) changes whenever **any** page's content changes, and differs across builds — a hard-coded hash would go stale and break the site's own CSP on the next content edit and on PR-preview builds (different `base`). | (a) auto-inject per-build via a VitePress `transformHtml` hook that computes each page's inline-script hashes and writes them into that page's meta-CSP `script-src` / (b) hard-code the current build's hashes (plan literal) / (c) allow `'unsafe-inline'` for scripts | **(a) Auto-inject per build** — always self-consistent, preview-safe, and future-proof; honors PF-003's goal (strict CSP, no `'unsafe-inline'`, honest) without the staleness footgun. User-decided 2026-07-09. | ✅ Resolved (runtime) |

| 13 | Testing (runtime) | The migration broke `packages/core/test/docs-presence.spec.test.ts` (an RD-10 spec oracle asserting the techdocs exist under `docs/`) — the plan's current-state scan caught `gate.spec` but missed this second `docs/`-reading spec. Turbo cached `core#test` (repo-root `docs/` is not a declared input of the core package), so local `verify` gave a false pass; CI (cache-free) caught it. | (a) repoint the spec at the migrated location `packages/docs-site/reference/` / (b) retire it (docs-site's own `check-docs-build.mjs` guards presence, but that is not in `yarn verify`) | **(a) Repoint** — keeps a `yarn verify`-integrated presence guard at the docs' true home; legitimate because the requirement changed (AR-2 / PF-004 supersession, user-approved). User-directed 2026-07-09 after confirming the sibling PR's CI failures were unrelated (flaky Windows/macOS). | ✅ Resolved (runtime) |
| 14 | Security/CI (runtime) | Adding the docs site's dev tooling (VitePress → Vite/esbuild; mermaid) makes CI's `npm audit --audit-level=high` fail on dev-only advisories (the Vite path-traversal high, esbuild/launch-editor). The vulnerable Vite chain also pre-exists via `examples` (`vite ^6`), so the devDep audit is repo-wide noise. | (a) scope CI audit to production deps (`npm audit --omit=dev --audit-level=high`) / (b) yarn `resolutions` to force-patch Vite (may break VitePress) / (c) drop mermaid (doesn't fix — VitePress still pulls vulnerable Vite) | **(a) Scope to prod deps** — the shipped packages carry zero runtime deps (the whole guarantee), so prod-only audit is exactly the surface that matters and is verified clean (0 vulns); dev build tooling never ships. User-decided 2026-07-09. | ✅ Resolved (runtime) |

### Resolution Notes

**AR-12 (runtime, 2026-07-09):** discovered during Phase 4 execution. The strict-CSP DECISION (PF-003 /
AR-9) is unchanged — only the mechanism for supplying the inline-script hashes is refined from
"hard-code" to "compute at build time in `transformHtml`", because the `__VP_HASH_MAP__` inline
script's hash is content-dependent. `ST-9` asserts the end state (every inline script's hash present
in `script-src`, no `'unsafe-inline'`, no `unsafe-eval`) so it validates either mechanism; (a) makes
it pass sustainably.


**AR-1..3:** New plan-level decisions, user-chosen this session (2026-07-09) after current-state
analysis (root `@jsvision/monorepo`, yarn 1.22 `workspaces:packages/*`, `verify = yarn lint && turbo
run typecheck build test check:docs`, single `.github/workflows/ci.yml`).

**AR-2 rationale:** `docs/acceptance-gate.md` is load-bearing — the spec oracle in
`packages/core/test/gate.spec.test.ts`, plus `scripts/gate.mjs`, README, and AGENTS.md reference it.
Moving it would break an immutable spec test, so it stays; only the pure website content moves.

**AR-5..10:** Imported resolved from the requirements register; not re-confirmed (gate rule 3).

**AR-11:** The final hero/OG image is generated by RD-09 (Playwright on the live page); Phase A ships
a static placeholder so the SEO surface is complete and testable now.

**Post-creation (preflight):** the `preflight` pass (see [00-preflight-report.md](00-preflight-report.md),
✅ PASSED) added three delivery-mechanism refinements the gate had not surfaced, all user-decided
2026-07-09: docs-site build script renamed `vp:build` for true `yarn verify` isolation (PF-001);
dynamic per-PR `DOCS_BASE` for correct preview assets (PF-002); and a Phase-4 CSP-hash validation so
the strict meta-CSP survives VitePress's inline scripts (PF-003). These refine AR-1/AR-3/AR-9's
implementation without changing the decisions themselves.
