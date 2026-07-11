# Execution Plan: plugin-self-sync (PL-02)

> **Feature**: jsvision-plugin · **CodeOps Skills Version**: 3.3.2
> **Progress**: 24/30 tasks (80%) · **Last Updated**: 2026-07-11
> **Branch**: `feat/plugin-self-sync` (off `master`, PL-01 merged) · **Verify**: `yarn verify`

Spec-first per phase: spec tests → red → implement → green → impl tests → full verify. A task is
`[~]` when implemented, `[x]` only after its verify passes. Do **not** stage the pre-existing WIP
(`packages/examples/package.json`, `packages/examples/playground/`) into any commit.

Legend: `[ ]` todo · `[~]` implemented, unverified · `[x]` done.

## Phase 1 — Structured detector + deterministic snippet fix (03-01)

- [x] 1.1 Spec: add `plugin-sync.spec.test.ts` with ST-1, ST-2, ST-3, ST-4, ST-11 (red)
- [x] 1.2 Impl: add exported `detectDrift(roots = DEFAULT_ROOTS)` to `check-plugin.mjs` (reuse `checkBarrelCoverage` for the undocumented-widget set — one predicate); export `extractRegion`/`readRegion`, `DEFAULT_ROOTS` + needed path consts (no change to `runAllChecks`)
- [x] 1.3 Impl: `scripts/plugin-sync.mjs` — pure `replaceFencedBlock`, `fixSnippetDrift(findings, roots = DEFAULT_ROOTS)`, guarded `main()` handling `--fix`
- [x] 1.4 Impl: add `"plugin:sync": "node scripts/plugin-sync.mjs"` to root `package.json`
- [x] 1.5 Green: ST-1…ST-4, ST-11 pass; `node scripts/check-plugin.mjs` still PASS
- [x] 1.6 Impl tests: `plugin-sync.impl.test.ts` — multi-drift, absent-region skip, idempotent `--fix` (hardened `fixSnippetDrift` to guard unknown modules before any fs read)
- [x] 1.7 Full `yarn verify` green (22/22 turbo, check-plugin: PASS)

## Phase 2 — Catalog-entry request builder + the `jsvision-plugin-sync` skill (03-02)

- [x] 2.1 Spec: add ST-5 (request builder) + ST-8 (skill exists/validates) to the spec file (red)
- [x] 2.2 Impl: `scripts/plugin-sync-request.mjs` — `readWidgetDoc` (lead + `@example` via `extractUiClassDoc`, a new `getDocumentationComment`/`getJsDocTags` extractor added to `check-plugin.mjs` sharing one `buildUiProgram()`), `buildCatalogEntryRequest` (targets the `New — needs categorization` holding heading), pure `applyCatalogEntry`
- [x] 2.3 Impl: `--detect` JSON mode in `plugin-sync.mjs` (read-only `detectDrift()` dump)
- [x] 2.4 Impl: `tools/claude-plugin/skills/jsvision-plugin-sync/SKILL.md` (manual, `disable-model-invocation`, the detect→draft→review→verify loop; grounded-only drafting)
- [x] 2.5 Impl: skill registration = directory presence (plugin.json has no skills array; matches `jsvision-new-app`) — no manifest edit
- [x] 2.6 Green: ST-5, ST-8 pass; `claude plugin validate` passed with both skills
- [x] 2.7 Impl tests: request-builder edge cases (unknown name throws, denylisted name never requested, real widget grounds, applyCatalogEntry placement)
- [x] 2.8 Full `yarn verify` green (22/22 turbo, check-plugin: PASS)

## Phase 3 — API script + injected client + disabled CI + SDK dep (03-03)

- [x] 3.1 Spec: add ST-6, ST-7 (fake-client draft/apply) + ST-9 (workflow) + ST-10 (dep policy) (red)
- [x] 3.2 Impl: `fixUndocumentedWidgets(findings, client, roots = DEFAULT_ROOTS)` + `normalizeBullet` in `plugin-sync.mjs`; wire the AI branch into `main()` (lazy dynamic import of the adapter so tests never load the SDK)
- [x] 3.3 Impl: `scripts/plugin-sync-anthropic.mjs` — the real `DraftClient` over `@anthropic-ai/sdk` (default `claude-haiku-4-5-20251001`, override via `PLUGIN_SYNC_MODEL`; `max_tokens` 256; constructed only in `main()`, never imported by tests)
- [x] 3.4 Impl: added `@anthropic-ai/sdk@^0.111.0` to root `devDependencies` + `yarn install` updated `yarn.lock` (pure-JS, CI audits `--omit=dev`)
- [x] 3.5 Impl: `.github/workflows/plugin-self-sync.yml` — `workflow_dispatch`-only, `if: ${{ false }}`, references no secret
- [x] 3.6 Impl: `tools/claude-plugin/README.md` "Keeping the plugin in sync" + "Enabling automated sync" sections
- [x] 3.7 Green: ST-6, ST-7, ST-9, ST-10 pass; `yarn check:deps` green
- [x] 3.8 Impl tests: apply idempotence, section placement, no-op when no undocumented widgets, normalizeBullet edges
- [x] 3.9 Verify green for PL-02 scope: eslint clean · turbo typecheck/build/test/check:docs 22/22 (run serially) · check-plugin PASS. NOTE: a single `yarn verify` run is currently blocked only by (a) prettier on an unrelated untracked spike file `packages/spike-data-studio/src/editor-spec.ts` (external WIP, not PL-02 — not staged/modified) and (b) a flaky concurrent-vitest segfault in `core#test` (passes standalone + serially). Neither is introduced by PL-02.

## Phase 4 — Integration, acceptance, governance, roadmap

- [ ] 4.1 Acceptance A-1: seeded undocumented widget + drifted snippet → `--fix` + fake-client AI path → `check-plugin: PASS` (fixture-scoped, no network)
- [ ] 4.2 Acceptance A-2: full `yarn verify` green; `claude plugin validate` passes
- [ ] 4.3 Docs: cross-link the new skill from the `jsvision` router/README; note `yarn plugin:sync` in the plugin README
- [ ] 4.4 Governance check: confirm no secret referenced, no native dep, no auto-commit path; `ci.yml` untouched
- [ ] 4.5 Roadmap: set jsvision-plugin PL-02 → Done; cascade to the portfolio roadmap
- [ ] 4.6 Final full `yarn verify` + `node scripts/check-plugin.mjs` PASS

## Notes

- Reuse PL-01 machinery — no duplicate barrel/region logic (AR-6).
- The model client is always injected in tests; the real adapter is constructed only in `main()` (AR-10).
- Commit mode is chosen at `exec_plan` time; keep the pre-existing WIP out of every commit.
