# Execution Plan: plugin-self-sync (PL-02)

> **Feature**: jsvision-plugin · **CodeOps Skills Version**: 3.3.2
> **Progress**: 0/30 tasks (0%) · **Last Updated**: 2026-07-11
> **Branch**: `feat/plugin-self-sync` (off `master`, PL-01 merged) · **Verify**: `yarn verify`

Spec-first per phase: spec tests → red → implement → green → impl tests → full verify. A task is
`[~]` when implemented, `[x]` only after its verify passes. Do **not** stage the pre-existing WIP
(`packages/examples/package.json`, `packages/examples/playground/`) into any commit.

Legend: `[ ]` todo · `[~]` implemented, unverified · `[x]` done.

## Phase 1 — Structured detector + deterministic snippet fix (03-01)

- [ ] 1.1 Spec: add `plugin-sync.spec.test.ts` with ST-1, ST-2, ST-3, ST-4, ST-11 (red)
- [ ] 1.2 Impl: add exported `detectDrift()` to `check-plugin.mjs`; export `extractRegion`/`readRegion` + needed path consts (no change to `runAllChecks`)
- [ ] 1.3 Impl: `scripts/plugin-sync.mjs` — pure `replaceFencedBlock`, `fixSnippetDrift`, guarded `main()` handling `--fix`
- [ ] 1.4 Impl: add `"plugin:sync": "node scripts/plugin-sync.mjs"` to root `package.json`
- [ ] 1.5 Green: ST-1…ST-4, ST-11 pass; `node scripts/check-plugin.mjs` still PASS
- [ ] 1.6 Impl tests: `plugin-sync.impl.test.ts` — multi-drift, absent-region skip, idempotent `--fix`
- [ ] 1.7 Full `yarn verify` green

## Phase 2 — Catalog-entry request builder + the `jsvision-plugin-sync` skill (03-02)

- [ ] 2.1 Spec: add ST-5 (request builder) + ST-8 (skill exists/validates) to the spec file (red)
- [ ] 2.2 Impl: `scripts/plugin-sync-request.mjs` — `readWidgetDoc` (JSDoc lead + `@example` via the TS extractor), `buildCatalogEntryRequest`, pure `applyCatalogEntry` + `sectionFor`
- [ ] 2.3 Impl: `--detect` JSON mode in `plugin-sync.mjs` (read-only `detectDrift()` dump)
- [ ] 2.4 Impl: `tools/claude-plugin/skills/jsvision-plugin-sync/SKILL.md` (manual, `disable-model-invocation`, the detect→draft→review→verify loop; grounded-only drafting per AR-14)
- [ ] 2.5 Impl: register the skill in `plugin.json`/marketplace as needed (match `jsvision-new-app`)
- [ ] 2.6 Green: ST-5, ST-8 pass; `claude plugin validate` passes with both skills
- [ ] 2.7 Impl tests: request-builder edge cases (missing `@example`, denylisted name never requested)
- [ ] 2.8 Full `yarn verify` green

## Phase 3 — API script + injected client + disabled CI + SDK dep (03-03)

- [ ] 3.1 Spec: add ST-6, ST-7 (fake-client draft/apply) + ST-9 (workflow) + ST-10 (dep policy) (red)
- [ ] 3.2 Impl: `fixUndocumentedWidgets(findings, client)` + `normalizeBullet` in `plugin-sync.mjs`; wire the AI branch into `main()`
- [ ] 3.3 Impl: `scripts/plugin-sync-anthropic.mjs` — the real `DraftClient` over `@anthropic-ai/sdk` (constructed only in `main()`, never imported by tests)
- [ ] 3.4 Impl: add `@anthropic-ai/sdk` to root `devDependencies` (tooling only, AR-9)
- [ ] 3.5 Impl: `.github/workflows/plugin-self-sync.yml` — `workflow_dispatch`-only, `if: false`, no secret referenced
- [ ] 3.6 Impl: `tools/claude-plugin/README.md` "Enabling automated sync" section (the enable path)
- [ ] 3.7 Green: ST-6, ST-7, ST-9, ST-10 pass; `yarn check:deps` green
- [ ] 3.8 Impl tests: apply idempotence, section placement, no-op when no undocumented widgets
- [ ] 3.9 Full `yarn verify` green

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
