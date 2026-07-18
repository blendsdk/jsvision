# Package Scaffold: Foundation

> **Document**: 03-02-package-scaffold.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-01 §"Package scaffold" + §"Package wiring" · AC-1, AC-10 · req AR-01, PF-007 · AR #4/#5 (plan)

## Overview

Create `packages/datagrid` as an ESM-only, zero-runtime-dependency workspace by cloning the
`@jsvision/files` template and renaming. The package builds to a single public entry, participates in turbo
by auto-fan-out (no registration), and stays `private: true` (excluded from lockstep auto-versioning until
`@jsvision/ui` is public).

## Architecture

### Current Architecture

No `packages/datagrid`. `@jsvision/files` is the reference sibling: `package.json` (fixed `"0.2.0"`
`@jsvision/*` deps, six scripts, `sideEffects:false`, single `.` export), an 8-line `tsconfig.json`
(`extends ../../tsconfig.base.json`, `rootDir:src`, `outDir:dist`, `include:["src"]`), and a two-project
`vitest.config.ts` (`unit` = `*.{spec,impl}.test.ts`, `e2e` = `*.e2e.test.ts`, single-fork).

### Proposed Changes

Clone the three config files; rename to `@jsvision/datagrid`; keep the deps `@jsvision/core` + `@jsvision/ui`
at `"0.2.0"`. Add one deviation from the template — a `tsconfig.typecheck.json` so `test/**` is typechecked
(needed to enforce AC-5's compile-error guarantee; see below).

## Implementation Details

### Files created

| File | Content |
| ---- | ------- |
| `package.json` | `@jsvision/datagrid`, `version:"0.2.0"`, `private:true`, `type:module`, `sideEffects:false`, `.` export → `dist/index.{js,d.ts}`, deps `@jsvision/core`/`@jsvision/ui` `"0.2.0"`, devDeps `@types/node`+`vitest`. Scripts (identical names to files): `build`=`tsc`, `typecheck`=`tsc --noEmit -p tsconfig.typecheck.json`, `test`=`vitest run --project unit`, `test:e2e`=`vitest run --project e2e --passWithNoTests`, `check:deps`=`node ../../scripts/check-no-native-deps.mjs .`, `check:docs`=`node ../../scripts/check-jsdoc.mjs .`. |
| `tsconfig.json` | Clone of files' — `extends ../../tsconfig.base.json`, `rootDir:src`, `outDir:dist`, `include:["src"]`. Drives `build` (emits `src` → `dist` only). |
| `tsconfig.typecheck.json` | `extends ./tsconfig.json`, `noEmit:true`, `include:["src","test"]`, `types` covering vitest globals as ui/files' test setup does. Drives `typecheck` so the AC-5 `@ts-expect-error` type test is enforced. |
| `vitest.config.ts` | Clone of files' two-project config (`unit`/`e2e`). |
| `README.md` | Short package intro (user-facing; no CodeOps/TV refs). |
| `src/index.ts` | The public barrel — explicit named re-exports (populated across 03-03…03-05). Starts minimal so the package builds from Phase 2 on. |

### `private:true` + lockstep

`@jsvision/datagrid` is `private:true` → excluded from lockstep publish auto-versioning
(`scripts/sync-package-versions.mjs` TARGETS = core+ui only). No change to that script unless the package
later exports a `VERSION` constant (it does not in RD-01; req PF-007). `@jsvision/*` deps are the fixed
`"0.2.0"` pin (**not** `workspace:*`), matching every sibling.

### turbo

`turbo.json` fans `build`/`typecheck`/`test`/`test:e2e`/`check:deps`/`check:docs` out by task name across all
workspaces — the new package is picked up with **no** `turbo.json` edit. `build` `dependsOn ^build` so
datagrid builds after core+ui; `typecheck` `dependsOn ^build` so it typechecks against ui's promoted `.d.ts`
(03-01 must land first — see the phase dependency in 99).

### AC-10 / AC-1 security substrate

- `check:deps` (`check-no-native-deps.mjs`) fails on any native runtime dep → zero-dep enforced (AC-1).
- No `eval`, `new Function`, or dynamic `require` anywhere in `src/**` — asserted by a source-scan spec
  (07 ST-14).
- `build` emits exactly one entry point (`dist/index.js` + `dist/index.d.ts`) — asserted post-build
  (07 ST-13).

## Integration Points

- Every later component (03-03…03-06) adds a `src/*.ts` file + a barrel line here.
- The ui promotion (03-01) is a build prerequisite: datagrid's sources import promoted symbols.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `check:deps` reports a native dep | Fail the build; keep the package pure-JS | req AR-01 / AC-1 |
| A stray second entry point appears in `dist/` | The packaging assertion (ST-13) fails; keep the single `.` export | AC-1 |
| Tests reference types the build tsconfig doesn't see | `tsconfig.typecheck.json` includes `test/**` so `typecheck` covers them | AR #4/#5 (plan) |

> **Traceability:** the scaffold shape follows req AR-01 (new package) + PF-007 (dep pin, private/lockstep);
> the module layout + the `tsconfig.typecheck.json` deviation are AR #5 (plan). Cloning the files template's
> file names/structure is a convention match (one interpretation), not a semantic choice.

## Testing Requirements

- Post-build packaging assertion: one entry point (07 ST-13, an e2e running after `build`).
- Security source-scan: no `eval`/dynamic-require in `src/**` (07 ST-14).
- `yarn workspace @jsvision/datagrid check:deps` reports zero native deps.
