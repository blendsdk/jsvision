# Ambiguity Register: API Reference (TypeDoc)

> **Document**: 00-ambiguity-register.md
> **Parent**: [Index](00-index.md)
> **Plan**: api-reference (feature: docs-website)
> **Gate status**: ✅ GATE PASSED — 2026-07-10 22:54
> **CodeOps Skills Version**: 3.3.2

The Zero-Ambiguity Gate for the `api-reference` plan. Every semantically-weighty decision the plan
commits to is recorded here with the user's explicit resolution. `AR-N` in this file is **plan-local**
to `api-reference`; RD-06's own `AR-7`/`AR-18` cited by the requirements doc live in the separate
docs-website *requirements* register and are imported below as pre-resolved context (not re-confirmed).

## Legend

Status: ✅ Resolved · ⏳ Open · ⏸️ Deferred. Source: `RD-06` = inherited from the requirements doc;
`session` = resolved with the user during this planning session; `preflight` = resolved during the
post-creation preflight audit (see [00-preflight-report.md](00-preflight-report.md)).

## Register

| # | Category | Question / Ambiguity | Options | Resolution | Status | Source |
|---|----------|----------------------|---------|------------|--------|--------|
| AR-1 | Technical approach | Reference tool & integration | TypeDoc→md→VitePress / TypeDoc HTML / hand-written | **TypeDoc → markdown → VitePress** — unified theme/nav/search, CI-regenerated | ✅ | RD-06 (AR-7) |
| AR-2 | Scope | Which symbols are documented | All internals / public entry only | **Public entry surface only** (each package's barrel) — matches the "public surface = index.ts" contract | ✅ | RD-06 (AR-7) |
| AR-3 | Scope | Versioning | Multi-version now / single "latest" | **Single "latest"** — pre-1.0; versioning deferred | ✅ | RD-06 (AR-18) |
| AR-4 | Behavior / integration | Depth of component↔reference cross-linking (RD-06 Must-Have is bidirectional) | Forward-only / bidirectional via a symbol↔page map / full automation over every symbol | **Bidirectional via a symbol↔page map**: component pages get a forward "API reference →" link (link-checked); a post-generation step injects a "Documented in →" back-link into matching generated pages. Seeded on the components that already have pages; the map is extensible | ✅ | session |
| AR-5 | File structure / workflow | Are generated API pages committed or regenerated? | Commit generated md / gitignore + regen before build | **Gitignore `api/<pkg>/**` + regenerate before every build**; root `docs:build` runs `docs:api` first so `docs.yml` is unchanged; an anti-drift check asserts regen is clean. The hand-written `api/index.md` preface stays committed | ✅ | session |
| AR-6 | Scope | Which packages does the reference cover, given ui/files/web are `private: true`? | All four / core only | **All four** (`@jsvision/core`, `@jsvision/ui`, `@jsvision/files`, `@jsvision/web`); the three private packages carry a "pre-release" note | ✅ | session |
| AR-7 | Technical approach | Markdown/VitePress plugin stack | plugin-markdown + typedoc-vitepress-theme / plugin-markdown + hand-wired sidebar | **`typedoc-plugin-markdown` + `typedoc-vitepress-theme`** — the companion emits VitePress-frontmatter `.md` plus a `typedoc-sidebar.json` the config imports; least hand-wiring, deterministic paths | ✅ | session |
| AR-8 | File structure / config | TypeDoc config location & entry-point source | Per-package configs / one workspace config; source vs `.d.ts` | **One `packages/docs-site/typedoc.json`** with four explicit entry points reading **TS source** (`core` → `src/engine/index.ts`; `ui`/`files`/`web` → `src/index.ts`) so there is no build-ordering dependency; `excludeInternal`, `excludePrivate`, `readme: none` | ✅ | session |
| AR-9 | Technical / testability | Determinism (AC-4 byte-identical) | Accept tool defaults / configure for determinism | **Configure for byte-identical output** — no timestamps/date footer in content; source links pinned to the built commit (same checkout ⇒ identical bytes) | ✅ | session |
| AR-10 | Naming / structure | Generated URL/path scheme + subpath handling | Scoped `@jsvision/*` paths / unscoped; include browser-stubs? | **`/api/<pkg>/…` using unscoped names** (`core`/`ui`/`files`/`web`); **exclude** the `@jsvision/web/browser-stubs` subpath (throwing placeholders) — main barrels only | ✅ | session |
| AR-11 | Scope (Should-Have) | GitHub source links per symbol | In / out | **In** — link each symbol to its definition on GitHub at the built commit | ✅ | session |
| AR-12 | Scope (Should-Have) | Grouping of the generated tree | Flat / by package + kind | **By package + kind** (classes / functions / types) — native to the theme | ✅ | session |
| AR-13 | Scope (Should-Have) | The API section preface page | Generated overview / hand-written preface | **Keep `api/index.md` as a hand-written "how to read this" preface**; generated trees live under `api/<pkg>/` | ✅ | session |
| AR-14 | File structure / wiring | `docs:api` script placement & build chaining | Separate CI step / chain into `docs:build` | **Add `docs:api` (typedoc) to docs-site + a root passthrough; root `docs:build` chains `docs:api && vp:build`** so CI's existing `yarn docs:build` picks it up with no `docs.yml` edit | ✅ | session |
| AR-15 | Testability | Where the drift/coverage gate lives | All in vitest / all in build-gate / split | **Split**: unit-**spec** the *pure helpers* in the docs-site vitest `unit` project (fast, no TypeDoc, runs in `yarn verify`) — barrel-export extraction, symbol→path mapping, back-link injection; the **end-to-end** coverage/leakage/link-resolution + determinism assertions (AC-1/4/5/7) live in `check-docs-build.mjs` (post-`docs:build`) | ✅ | session |
| AR-16 | Process | Verify command(s) | — | Code/tests: **`yarn verify`**. API build gate: **`yarn docs:api && yarn docs:build && node packages/docs-site/scripts/check-docs-build.mjs`** | ✅ | session |
| AR-17 | Naming | Plan folder name | — | **`api-reference`** (`codeops/features/docs-website/plans/api-reference/`) | ✅ | session |
| AR-18 | Technical approach | Pure-helper language — the helpers are consumed by both the vitest `.ts` specs and the plain-`node` scripts | `.ts` (needs a loader for `node`) / `.mjs` plain ESM | **`.mjs`/`.js` plain ESM** — ONE implementation shared by the vitest specs AND `node`'s `gen-api.mjs`/`check-docs-build.mjs` (which cannot `import` a `.ts` file); `barrelExports` uses the `typescript` package; `ApiLink` becomes a JSDoc `@typedef`. Trade-off accepted: helpers self-typecheck lost (they are pure + fully spec-covered) | ✅ | preflight (PF-001) |
| AR-19 | Feasibility / DX | Sidebar import when the generated `typedoc-sidebar.json` is absent (gitignored; `docs:dev` does not run `docs:api`) | static `import … with { type: 'json' }` / defensive fs-read | **Defensive fs-read in `config.ts`** — `existsSync(p) ? JSON.parse(readFileSync(p)) : []` so `yarn docs:dev` and a direct `vp:build` work with or without a prior `docs:api`; the anti-drift gate still guarantees real content in the shipped build | ✅ | preflight (PF-002) |
| AR-20 | File structure | `api-map` location | package root / under `src/api/` | **`src/api/api-map.mjs`** — co-located with the other pure helpers (a package-root file was also outside the docs-site typecheck `include`) | ✅ | preflight (PF-003) |
| AR-21 | Consistency | RD-06 AC-1 says "`src/index.ts`", but `@jsvision/core` has none | — | Read AC-1's "`src/index.ts`" as "each package's **public entry point**" — `src/engine/index.ts` for core. The ST-3/ST-4 oracle is scoped to the public entry, not a literal `src/index.ts` | ✅ | preflight (PF-004) |
| AR-22 | Technical / structure | How to invoke TypeDoc to hit the AR-10 `/api/<pkg>/…` URL scheme | single config, 4 entryPoints (as 03-01 illustrates) / one TypeDoc run **per package** | **Per-package invocation** (`gen-api.mjs` runs TypeDoc 4×, each `--entryPoints <barrel> --tsconfig <pkg>/tsconfig.json --out api/<pkg>`, shared flags in `typedoc.json`; the 4 sidebars merged into `api/typedoc-sidebar.json`). Empirically forced: a single run with 4 entry points names the modules by their differing paths → `/api/core/src/engine/…`, `/api/ui/src/…` (violates AR-10's `/api/<pkg>/…`). Per-package gives clean `/api/<pkg>/<kind>/<Symbol>` and resolves each package with its **own** `tsconfig.json` (no extra shared typedoc tsconfig needed). The plan's authoring note delegated exact config to the Phase-1 smoke task; this is that resolution. | ✅ | runtime |

## Gate confirmation

- Every row above is `✅ Resolved` with an explicit user decision (AR-4…AR-17 confirmed this session;
  AR-1…AR-3 inherited from RD-06 and not re-litigated; AR-18…AR-21 resolved and accepted during
  the preflight audit — the user accepted all recommendations 2026-07-10).
- Zero items deferred within this plan's scope. Multi-version docs stay out per AR-3 (RD-06 AR-18).
- The user confirmed the complete register ("proceed", 2026-07-10 22:54) and the preflight resolutions
  ("accept", 2026-07-10).

**✅ GATE PASSED** — plan documents written; preflight-audited and updated (AR-18…AR-21).
