# Current State — Site Foundation

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.3.2

Verified against the repo on 2026-07-09.

## Monorepo wiring

- Root `package.json`: `@jsvision/monorepo`, `yarn@1.22.22`, `workspaces: ["packages/*"]` → a new
  `packages/docs-site` auto-joins the workspace.
- Root scripts: `verify = yarn lint && turbo run typecheck build test check:docs`; `build/typecheck/
  test/test:e2e/check:deps/check:docs` fan out via turbo; `lint = eslint . && prettier --check .`.
- `turbo.json` tasks: `build` (outputs `dist/**`, `dependsOn ^build`), `typecheck`, `test`,
  `test:e2e`, `check:deps`, `check:docs`. → A `docs-site#build` with `outputs:['.vitepress/dist/**']`
  can be added **without** a `^build` dep (RD-01 has no live demos); it stays out of the default
  `build` fan-out per AR-3 (isolated) — driven only by `yarn docs:build` + the docs CI job.
- Existing dev tooling already in the tree: **Vite 6 + `@xterm/*` + `@xterm/addon-webgl`** are
  devDependencies of `packages/examples` (`demo:web`) — proof the browser/live stack builds here
  (relevant to RD-02/03, not RD-01).

## Existing `docs/` (authored, never built)

`docs/` is VitePress-shaped but VitePress is **not installed**:

```
docs/index.md                      (techdocs:true frontmatter)
docs/.vitepress/config.ts          (title, nav: Architecture/Decisions/Guides, sidebar)
docs/architecture/{system-overview,api-design,security}.md
docs/decisions/{index, ADR-001…ADR-009}.md
docs/guides/{getting-started,development}.md
docs/acceptance-gate.md            ← LOAD-BEARING (see below)
```

**`docs/acceptance-gate.md` is load-bearing** and must NOT move (AR-2):
- `packages/core/test/gate.spec.test.ts` uses it as a **spec-test oracle** (immutable).
- `scripts/gate.mjs` maps criteria against it; README (L15, L395) and AGENTS.md (L46) link it.

The other `docs/` files are pure website content and are referenced only by the (ephemeral)
`JSDOC-CLEANUP-PLAN.md` — safe to `git mv` into `packages/docs-site`.

## CI

- Single workflow `.github/workflows/ci.yml` (3 OS × Node 20/22/24 verify + e2e + check:deps +
  sync-versions + audit + pack). The docs deploy is a **new** workflow `docs.yml` (this plan) — it
  does not modify `ci.yml`.
- GitHub Pages must be enabled in repo settings to serve from the **`gh-pages` branch** (a one-time
  manual prerequisite, consequence of AR-1) — noted as a deploy-phase checklist item.

## Constraints carried into the plan

- Zero-runtime-dep guarantee of shipped packages is sacred → docs toolchain is dev-only; `check:deps`
  must stay green (ST-13).
- ESM-only repo, NodeNext, strict TS — the VitePress config is TS (`.vitepress/config.ts`).
- No raw git in plan docs; commits via `/gitcm` / `/gitcmp`.
