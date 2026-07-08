# Packaging & Integration: Theme Designer

> **Document**: 03-04-packaging.md
> **Parent**: [Index](00-index.md)

## Overview

Stand up the new private `@jsvision/theme-designer` package cleanly, wire the two name-hardcoded CI
touch-points, and retire the redundant half of `demo:themes` (AR-6, AR-10, AR-22). The monorepo's
workspace glob, turbo pipeline, `sync-versions`, and `check:*` scripts are all auto-discovering, so most of
the wiring is just creating the package with the right scripts.

## Implementation Details

### New package `packages/theme-designer/`

**`package.json`** (mirrors the `core`/`ui` template, but private + not published):
```json
{
  "name": "@jsvision/theme-designer",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "license": "MIT",
  "scripts": {
    "start": "tsx src/main.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --project unit",
    "test:e2e": "vitest run --project e2e",
    "check:deps": "node ../../scripts/check-no-native-deps.mjs ."
  },
  "dependencies": { "@jsvision/core": "*", "@jsvision/ui": "*", "@jsvision/files": "*" },
  "devDependencies": { "@types/node": "^22.10", "tsx": "^4.19.2", "vitest": "^4.1.9" }
}
```
- **Private** (AR-10): exempt from lockstep `sync-versions`; no `exports`/`types`/`files`/`bin` yet.
- **No `build` script** and **no `src/index.ts` public barrel** — it is an app run via `tsx`, so
  `check-jsdoc.mjs` **skips the package entirely** (it returns early for any package with no barrel — the
  same reason `examples` is skipped; AR-23). Consequently the banned-reference rule (no CodeOps IDs / TV
  provenance) is **not tool-enforced** here; it is upheld by the same manual/lint discipline `examples` uses.
  A `check:docs` script is therefore intentionally **omitted** (adding one would be a dead no-op, not
  enforcement). (PF-010)
- `check:deps` is declared so the native-dep guard runs (all deps are pure-JS workspace packages).

**`tsconfig.json`** — `extends ../../tsconfig.base.json`, `noEmit:true`, `rootDir:"."`, `include:["src"]`.

**`vitest.config.ts`** — the repo's two-project template (`unit` = `test/**/*.{spec,impl}.test.ts`, `e2e` =
`test/**/*.e2e.test.ts`, single-fork).

**`README.md`** — what it is + `yarn workspace @jsvision/theme-designer start`.

### Root `package.json`

Add a convenience passthrough alongside the existing demos, e.g.
`"theme-designer": "yarn workspace @jsvision/theme-designer start"` (optional; the workspace script is the
canonical entry).

### CI — `.github/workflows/ci.yml` (AR-22)

The e2e step is name-hardcoded (turbo does not cover it). Add:
```yaml
    yarn workspace @jsvision/theme-designer test:e2e
```
to the existing POSIX e2e run block. The `npm pack --dry-run` step stays core-only (the package is private —
no pack check until it graduates to published; noted for the future publish task, AR-10).

### Retire the `demo:themes` live-TTY branch (AR-6)

In `packages/examples/themes-demo/main.ts`: remove `runLive()` (the `createApplication` designer) and the
`start`-on-TTY path; keep `runWalkthrough()` as the sole behavior (so `demo:themes` is now a pure headless
narrated walkthrough) and keep its e2e. Lift any still-needed contrast/preset helpers into the new app's
model (they mostly already live in `designer.ts`, which stays for the walkthrough). Update the `demo:themes`
description in `CLAUDE.md` and the kitchen-sink `theming/presets` story stays untouched.

### CHANGELOG

Add an `[Unreleased]` entry: the new `Slider` control + `sliderTrack`/`sliderThumb` roles (`@jsvision/ui` /
`@jsvision/core`), and the new `@jsvision/theme-designer` app.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| New package accidentally published while `ui` is private | keep `private:true`; documented publish-later path only removes it once `ui` is public | AR-10 |
| CI misses the new e2e (name-hardcoded step) | the plan explicitly edits `ci.yml`; a task verifies the step runs | AR-22 |

> **Traceability:** see `00-ambiguity-register.md`.

## Testing Requirements

- `yarn verify` picks up the new package's `typecheck`/`test`/`check:deps` automatically (turbo).
- Confirm `sync-versions --check` still passes (private package is skipped).
- Confirm `demo:themes` (now walkthrough-only) e2e still passes.
