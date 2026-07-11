# Anti-Drift Gating & CI: API Reference

> **Document**: 03-03-gating-anti-drift.md
> **Parent**: [Index](00-index.md)

## Overview

This document owns how the reference is kept in lockstep with the code (AR-15). The split is
deliberate: the **pure helpers** are unit-spec'd in the docs-site vitest `unit` project (fast, no
TypeDoc, runs in `yarn verify`); the **end-to-end** coverage / leakage / link-resolution /
determinism assertions live in `check-docs-build.mjs`, which runs after the site builds. TypeDoc never
enters `yarn verify`.

## Architecture

### The pure helpers (`packages/docs-site/src/api/`)

Three small, side-effect-free functions — the unit-testable core of the gate. They are **plain ESM
(`.mjs`)**, not `.ts` (AR-18): the same functions are imported by the vitest `.ts` spec tests **and**
by the plain-`node` `gen-api.mjs` / `check-docs-build.mjs`, and `node` cannot `import` a `.ts` module
(there is no loader; `check-docs-build.mjs` runs as `node …mjs`). Authoring them once as `.mjs` keeps a
single shared implementation — the whole point of the coverage/leakage ground truth — with no loader,
no precompile step, and no forked reimplementation. Types are JSDoc `@typedef`s:

```js
// barrel-exports.mjs
/** The set of symbol names a package barrel exports, resolving `export *` transitively via the TS
 *  compiler API. Deterministic (sorted). This is the INDEPENDENT ground truth the generated tree is
 *  compared against — coverage (nothing missing) and leakage (nothing extra).
 *  @param {string} entryFilePath  @returns {string[]} */
export function barrelExports(entryFilePath) { /* … */ }

// inject-back-links.mjs   (owned by 03-02, spec'd here)
/** Insert the 'Documented in →' note into a generated page's markdown; idempotent.
 *  @param {string} markdown  @param {import('./api-map.mjs').ApiLink} link  @returns {string} */
export function injectBackLink(markdown, link) { /* … */ }

// validate-api-map.mjs
/** Structural checks on API_MAP: no duplicate `symbol`, every `apiPath` under `/api/<pkg>/`, every
 *  `componentPage` under `/components/`. Returns the list of violations (empty = valid).
 *  @param {import('./api-map.mjs').ApiLink[]} map  @returns {string[]} */
export function validateApiMap(map) { /* … */ }
```

`barrelExports` uses the TypeScript compiler API (`import ts from 'typescript'` → `ts.createProgram` +
`checker.getExportsOfModule`) so `export *` re-exports are followed exactly as the compiler sees them —
a regex over the barrel would miss star-re-exports and mis-count. `typescript` is already a repo devDep
(hoisted); add it to `packages/docs-site/package.json` devDependencies so the `.mjs` import resolves
even under isolated installs. Being `.mjs`, the helpers are outside the docs-site typecheck `include`
(`src/**/*.ts`) — an accepted trade-off (AR-18): the functions are pure and fully spec-covered.

### End-to-end gate (`check-docs-build.mjs`)

New checks appended to the existing 14-check build-output gate, each a hard fail:

| Check | Asserts | AC / ST |
| ----- | ------- | ------- |
| `API-COVERAGE` | For each entry, `barrelExports(entry)` all have a generated page — nothing missing | AC-1 / ST-3 |
| `API-LEAKAGE` | The generated symbol set ⊆ `barrelExports(entry)` — no internal/private symbol leaked | AC-7 / ST-4 |
| `API-SYMBOL` | A representative page (`createApplication`) contains its signature, parameters, return, description, and `@example` | AC-3 / ST-5 |
| `API-LINKS` | Every `API_MAP.apiPath` resolves to a built page; every mapped component page carries the forward link | AC-5 / ST-11 |
| `API-DETERMINISM` | A second `docs:api` run produces byte-identical `api/<pkg>/**` | AC-4 / ST-6 |
| `API-SEARCH` | Generated API pages are present in the built dist and the local search index | AC-2 / ST-9 |

Both `node` scripts import these `.mjs` helpers directly: `gen-api.mjs` imports `injectBackLink` +
`API_MAP` for the back-link pass; `check-docs-build.mjs` imports `barrelExports` + `validateApiMap` +
`API_MAP` for the coverage/leakage/link checks. No `tsx`, no child process, no build step.

### CI / build chain (AR-14)

- Root `docs:build` = `docs:api && … vp:build`; `.github/workflows/docs.yml` calls `yarn docs:build`
  unchanged, so both the production deploy and the PR-preview jobs regenerate first.
- The API gate is `yarn docs:api && yarn docs:build && node packages/docs-site/scripts/check-docs-build.mjs`
  (AR-16) — the same command a maintainer runs locally.
- `yarn check:deps` is unaffected: TypeDoc/plugin/theme are docs-site devDeps only (ST-13).

## Implementation Details

### Test placement

| Layer | Runs in | Files |
| ----- | ------- | ----- |
| Pure helpers | `yarn verify` (docs-site `unit` vitest) | `test/api-barrel-exports.spec.test.ts`, `test/api-back-links.spec.test.ts`, `test/api-map.spec.test.ts` (+ `.impl` as needed) |
| End-to-end | `check-docs-build.mjs` (post-build) | the six checks above |

The pure-helper specs use small **fixtures** (a fixture barrel that re-exports via `export *`, a
sample generated page) — they never invoke TypeDoc or need a built site, so they stay fast and
deterministic inside `yarn verify`.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| A new public export lacks a generated page | `API-COVERAGE` fails the build with the missing symbol names | AR-15 |
| An internal symbol leaks into the tree | `API-LEAKAGE` fails with the offending names | AR-15 |
| Generation drifts (non-deterministic) | `API-DETERMINISM` re-runs + diffs, fails on any delta | AR-9 |
| `API_MAP` malformed | `validateApiMap` (unit) + `API-LINKS` (e2e) both fail | AR-4 |

## Testing Requirements

- Pure-helper specs (ST-1, ST-2, ST-7, ST-12) — unit, in `yarn verify`.
- The six e2e checks (ST-3…ST-6, ST-9, ST-11) — in `check-docs-build.mjs`.
- `check:deps` unchanged (ST-13).
