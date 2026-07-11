# Generation Pipeline: API Reference

> **Document**: 03-01-generation-pipeline.md
> **Parent**: [Index](00-index.md)

## Overview

The generation pipeline turns the four packages' public entry points into deterministic VitePress
markdown under `packages/docs-site/api/<pkg>/`, driven by one command (`yarn docs:api`). This document
owns the TypeDoc configuration, the plugin stack, the output structure, determinism, and the script
wiring (AR-1/2/6/7/8/9/10/11/12/14).

## Architecture

### Proposed pipeline

```
yarn docs:api
  └─ node packages/docs-site/scripts/gen-api.mjs
       ├─ typedoc  (packages/docs-site/typedoc.json)          → api/<pkg>/**.md + api/typedoc-sidebar.json
       │                                                        (TypeDoc cleans `out` first — cleanOutputDir)
       └─ injectBackLinks(src/api/api-map.mjs, generated tree) → back-links merged into matching pages
```

`gen-api.mjs` is a thin wrapper: it invokes TypeDoc programmatically (or via the CLI), then runs the
back-link injection pass (owned by [03-02](03-02-integration-cross-linking.md)). It `import`s the pure
`injectBackLink` + `API_MAP` from `src/api/*.mjs` directly — those helpers are plain ESM (AR-18) so this
plain-`node` script needs no loader. Keeping it one script means `docs:api` is the single entry point
the root `docs:build` chains and CI calls.

## Implementation Details

### TypeDoc config — `packages/docs-site/typedoc.json`

Scoped to the **public entry** of each package, reading **TS source** (AR-8) so generation needs no
prior build:

```jsonc
{
  "$schema": "https://typedoc.org/schema.json",
  "plugin": ["typedoc-plugin-markdown", "typedoc-vitepress-theme"],
  "entryPointStrategy": "resolve",
  "entryPoints": [
    "../core/src/engine/index.ts",   // @jsvision/core — NOT src/index.ts
    "../ui/src/index.ts",
    "../files/src/index.ts",
    "../web/src/index.ts"            // main barrel only — browser-stubs excluded (AR-10)
  ],
  "out": "api",
  "excludeInternal": true,
  "excludePrivate": true,
  "excludeExternals": true,
  "readme": "none",
  "githubPages": false,
  "gitRevision": "<built commit>",   // pinned for deterministic source links (AR-9/11)
  "hidePageHeader": true,
  "hideBreadcrumbs": false
}
```

> **Authoring note (not shipped-code):** exact option names for suppressing the generated footer /
> "Generated using TypeDoc" line and any date are verified against the installed plugin version during
> the Phase-1 smoke task (AR-9). The determinism check (ST-6) is the objective gate — whatever flags
> produce byte-identical output are the correct ones.

**Package labelling (AR-6/10):** the four entry points are grouped under unscoped names
`core`/`ui`/`files`/`web` (via `entryPointStrategy: resolve` + per-entry naming or a `packageOptions`
map). The three `private` packages get a "pre-release" note surfaced in the API preface
([03-02](03-02-integration-cross-linking.md)) rather than per-page banners.

### Output structure

```
packages/docs-site/api/
├── index.md                 # hand-written preface (committed — 03-02)
├── typedoc-sidebar.json     # generated; imported by config.ts (03-02)   [gitignored]
├── core/                    # generated tree, grouped by kind (AR-12)     [gitignored]
│   ├── classes/…  functions/…  types/…  interfaces/…
├── ui/      …               [gitignored]
├── files/   …               [gitignored]
└── web/     …               [gitignored]
```

`api/index.md` is the only committed file under `api/`. Everything TypeDoc writes is gitignored (AR-5)
via a `packages/docs-site/.gitignore` rule (`api/*/` + `api/typedoc-sidebar.json`, keeping `api/index.md`).

### Determinism (AR-9 / AC-4)

- No timestamps or run-dependent strings in generated content (plugin footer/header suppressed).
- Source links use a **pinned `gitRevision`** resolved once per run to the built commit SHA — two runs
  on the same checkout embed the same SHA, so output is byte-identical (ST-6).
- Generation is a pure function of the source tree + config; no network, no ordering nondeterminism
  (TypeDoc sorts deterministically by default).
- **Clean-then-generate-then-inject order:** TypeDoc wipes `out` before each run (`cleanOutputDir`
  defaults `true`), so a second `docs:api` regenerates every page from scratch and re-injects the
  idempotent back-links — no accumulation of stale files or double-injected notes across runs. ST-6
  (re-run + diff) therefore holds.

### Scripts (AR-14)

- `packages/docs-site/package.json` → `"docs:api": "node scripts/gen-api.mjs"`.
- root `package.json` → `"docs:api": "yarn workspace @jsvision/docs-site docs:api"` and
  `"docs:build": "yarn docs:api && yarn workspace @jsvision/docs-site vp:build"`.
- `.github/workflows/docs.yml` is **unchanged** — its `yarn docs:build` now runs generation first.

### Dependencies (devDeps, docs-site only — AC-6)

`typedoc`, `typedoc-plugin-markdown`, `typedoc-vitepress-theme`, pinned to a mutually-compatible set,
plus an explicit `typescript` entry (the `barrelExports` `.mjs` helper imports it; it is already a
hoisted repo devDep, pinned here so the isolated install still resolves). They live only in
`packages/docs-site/package.json` devDependencies, so `yarn check:deps` (which guards each **shipped**
package) is unaffected (ST-13).

## Integration Points

- **Emits** `api/typedoc-sidebar.json` and the per-package trees consumed by
  [03-02](03-02-integration-cross-linking.md).
- **Invokes** the back-link injector owned by 03-02 as its second stage.
- **Gated by** [03-03](03-03-gating-anti-drift.md) (coverage/leakage/determinism run against this output).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| TypeDoc entry point fails to resolve (moved barrel) | `gen-api.mjs` exits non-zero with the failing path; `docs:build` aborts (fail-loud, no stale output) | AR-8 |
| Plugin/theme version mismatch | Phase-1 smoke task pins a compatible trio before any wiring; a broken trio fails generation immediately | AR-7 |
| Non-deterministic output slips in | ST-6 determinism check (re-run + diff) fails the build gate | AR-9 |

## Testing Requirements

- Determinism: `yarn docs:api` twice ⇒ byte-identical `api/<pkg>/` (ST-6).
- Coverage/leakage: generated tree ⇔ barrel exports (ST-3, ST-4) — asserted in 03-03.
- A representative symbol (`createApplication`) shows signature/params/return/description/`@example` (ST-5).
