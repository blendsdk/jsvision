# Current State: what PL-02 builds on

> **Feature**: jsvision-plugin · **Plan**: plugin-self-sync. All paths verified against the real tree
> on `feat/plugin-self-sync` (off `master` after the PL-01 squash-merge).

## PL-01's detector — `scripts/check-plugin.mjs`

The whole feature rests on machinery PL-01 already shipped (grounded line numbers):

- Path constants (`scripts/check-plugin.mjs:18-26`): `ROOT`, `PLUGIN_ROOT`, `SKILL_ROOT`, `MANIFEST`,
  `MARKETPLACE`, `CATALOG` (`references/component-catalog.md`), `GOTCHAS`, `RECIPE_DIR`
  (`packages/examples/recipes`), `TEMPLATES_DIR`.
- Config (`:29-43`): `PLUGIN_NAME='jsvision-plugin'`, `REQUIRED_GOTCHAS=12`,
  `CATALOG_DENYLIST=['View','ReactiveCycleError']`, `DRIFT_PAIRS` (the md ↔ recipe-module list).
- Pure checkers (all exported): `checkManifestData` (`:60`), `checkLinksInDir` (`:106`), `checkDrift`
  (`:148`), `countGotchas` (`:160`), `checkGotchas` (`:171`), `checkBarrelCoverage` (`:202`),
  `extractUiClassExports` (`:226` — the TypeScript compiler-API extractor of `@jsvision/ui`'s class
  value exports), and the aggregator `runAllChecks` (`:260` → `{ ok, errors: string[] }`).
- An internal `extractRegion(source)` pulls the text between `// #region example` and
  `// #endregion example`; `runAllChecks` uses it to compare each recipe module's region against the
  embedded block in its `.md` (the snippet-drift check, `:286-293`).

**Gap PL-02 fills:** `runAllChecks` returns *human-readable strings* (`[barrel] … "StatusItemView"`,
`[drift:data-grid] …`). There is no machine-readable delta and no fixer. PL-02 adds a structured
`detectDrift()` beside `runAllChecks` (reusing the same checkers) and a `--fix` for the mechanical
case. (AR-6)

## The content PL-02 edits

- **Catalog**: `tools/claude-plugin/skills/jsvision/references/component-catalog.md` — one bullet per
  widget (e.g. `- **StatusItemView** — …`). An undocumented class export trips barrel-coverage; the
  fix is to add its bullet.
- **Recipes**: `packages/examples/recipes/{data-grid,form-dialog,file-tools,live-dashboard,custom-widget}.ts`
  — each carries a `// #region example` … `// #endregion example` block copied verbatim into a
  recipe `.md`. Snippet drift = the copy diverged; the fix is to re-copy the region. (AR-3)

## CI and security context — `.github/workflows/`

- Only `ci.yml` (build/test matrix, 3 OS × 2 Node) and `docs.yml` (Pages) exist. `ci.yml`'s header
  states, and the file honors, **"No secrets are referenced."** There is **no AI-in-CI precedent**
  anywhere in the repo (grep confirms). This is why AR-8 keeps the new workflow `workflow_dispatch`-only
  and secret-free: adding an auto-firing, key-bearing AI bot to a deliberately secret-free CI is a
  surface the user chose to scaffold-but-not-arm in v1.
- `yarn verify` (`package.json:23`) already chains `&& node scripts/check-plugin.mjs`; `check:deps`
  (`:21`) fails on native runtime deps in public packages — `@anthropic-ai/sdk` is pure-JS and a
  tooling devDep, so it is unaffected (AR-9).

## Test precedent

`packages/examples/test/check-plugin.spec.test.ts` (PL-01) imports `scripts/check-plugin.mjs` by a
cross-root relative path and asserts the checkers — the exact pattern PL-02's `plugin-sync.spec.test.ts`
follows (AR-16). The examples `unit` vitest project (`testTimeout: 60_000` after PL-01's Windows
hardening) already tolerates the TS-compiler cost of `extractUiClassExports`.

## Live proof this is needed

During PL-01's own merge to master, `flexible-chrome-bars` added `StatusItemView` to the ui barrel;
barrel-coverage went red; the entry was written by hand. PL-02 is exactly that loop, automated.
