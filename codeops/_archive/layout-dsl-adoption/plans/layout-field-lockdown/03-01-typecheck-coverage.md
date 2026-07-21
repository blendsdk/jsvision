# 03-01 — Typecheck Coverage (#132 + the repo-wide test gap)

> **Document**: 03-01-typecheck-coverage.md
> **Parent**: [Index](00-index.md)
> **Implements**: FR-1…FR-4 · AR-5, AR-13, AR-14

## Objective

Make the compiler able to see the code this plan is about to change. Phase 2 is compiler-driven;
without this phase it drives off a map with 58% of the territory missing.

## Part A — replicate the `tsconfig.typecheck.json` pattern

`packages/datagrid` already solves this. Copy its shape to the 8 packages that lack it:

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": true, "rootDir": "." },
  "include": ["src", "test"]
}
```

and point the package's script at it: `"typecheck": "tsc --noEmit -p tsconfig.typecheck.json"`.

**`rootDir: "."` is load-bearing.** Widening `include` while `rootDir` stays `"src"` emits
`TS6059` for every test file — 606 of them, all artifacts. Omitting `rootDir` entirely is worse:
`TS2209` ("project root is ambiguous") aborts resolution and `ui` reports **1** error instead of
**80**.

Where a test imports across package boundaries, follow datagrid's precedent — an `exclude` entry
with a comment saying why, rather than loosening the config for everyone.

**Turn each package on and clear it in the same task.** The packages are independent, so there is no
reason for one task to redden five of them and leave the next four unable to verify. One task per
package that both adds the config *and* clears that package's errors keeps every task committable on
its own, which is what the execution rules require.

| Package | Errors to clear | Files |
|---|---|---|
| `ui` | 80 | 50 |
| `core` | 65 | 32 |
| `docs-site` | **18** | tbd at execution |
| `forms` | 5 | 3 |
| `theme-designer` | **5** | tbd at execution |
| `files` | 3 | 3 |
| `web` | 0 | 0 |

`theme-designer` **does** have a `test/` — `packages/theme-designer/test/inspector-panel.spec.test.ts`,
which also holds a write site at line 40. It gets the same `tsconfig.typecheck.json` as everyone else.
`docs-site` only needs `test/**/*.ts` added to its existing `include` (its `rootDir` is already `"."`).

## Part B — `packages/examples`

Two separate problems in one package.

**B1 — the include.** Six directories named; 107 of 255 files reached. Replace with
`"include": ["**/*.ts"]`, covering `vitest.config.ts` too. `rootDir` is already `"."` here, so this
is a one-line edit with no trap.

**B2 — the 53 errors.** 28 share one root cause: TS tests importing untyped `.mjs` tooling
(`scripts/*.mjs`, `tools/claude-plugin/**`). Per AR-5, add a hand-written `.d.mts` beside each of
the **11** imported scripts — 8 reached from `packages/examples`, and 3 more that only appear once
`docs-site/test` is typechecked:

| Script | Imported by |
|---|---|
| `scripts/check-plugin.mjs` | 3 sites |
| `tools/claude-plugin/skills/jsvision-new-app/scripts/new-jsvision-app.mjs` | 3 |
| `scripts/plugin-sync-request.mjs` · `scripts/plugin-sync.mjs` | 2 each |
| `scripts/render-app.mjs` · `scripts/jsvision-doctor.mjs` · `scripts/gen-plugin-api.mjs` | 1 each |
| `packages/docs-site/src/api/barrel-exports.mjs` | 1 |
| `packages/docs-site/src/api/jsdoc-examples.mjs` | 2 (`jsdoc-examples.{spec,impl}.test.ts`) |
| `packages/docs-site/src/api/inject-back-links.mjs` · `validate-api-map.mjs` | 1 each |

Declaring the return shapes typically resolves the paired `TS7006` implicit-`any` errors in the
same callbacks, so the 14 + 14 should fall together. Declare only what the tests consume — a
declaration file that outruns its script is worse than none.

The remaining 25 are ordinary type errors, plus the latent defects below.

## Part C — the latent defects

Ten errors sit in **currently-passing** tests (eight originally listed, plus
`docs-site/test/demo-shell.spec.test.ts:82` and `docs-site/test/example-at.spec.test.ts:84`). Each gets an individual verdict recorded during
execution — *fixture was wrong* or *assertion was weaker than it read* — never a blanket non-null
assertion. These are spec oracles; a test passing by accident is worse than no test.

## Part D — prove the gate (FR-4)

Introduce a deliberate type error into a demo entry file that was previously unchecked (e.g.
`view-demo/main.ts`), confirm `yarn typecheck` **fails**, then revert. A gate nobody has watched
fail is not known to work — the same reasoning that mutation-tested the shell guard in the
preceding plan.

## Out of scope

Widening `allowJs`/`checkJs` (AR-5), and typechecking the `.mjs` tooling scripts themselves.

## Risks

| Risk | Mitigation |
|---|---|
| A `.d.mts` drifts from its script | Declare only consumed surface; the tests fail loudly if it lies |
| Test typechecking slows `turbo typecheck` | Measure at the phase close; `noEmit` runs are cheap and cached |
| A cross-package test import cannot resolve | Follow datagrid's documented `exclude` precedent |
| datagrid's own three exclusions become unjustified | Their in-file comment cites *"core never typechecks its `test/`"* — a precedent this phase removes. Re-evaluate once `core/test` is on; the `TS7016` half is fixable with the same `.d.mts` seam. They hold 0 write sites, so there is no lockdown hole either way — update the comment at minimum |
