# 07 — Testing Strategy: plugin-self-sync

> Spec tests are immutable oracles derived from [01-requirements.md](01-requirements.md) + the AR
> decisions — never from imagined implementation. New specs live in
> `packages/examples/test/plugin-sync.spec.test.ts` (unit project), importing `scripts/*.mjs` by the
> cross-root relative path (the `check-plugin.spec.test.ts` precedent, AR-16). Impl tests may add
> edge cases in `plugin-sync.impl.test.ts`. **No test calls a real model or network** (AR-10).

## Specification Test Cases

| ST | Given | Expect | Trace |
|----|-------|--------|-------|
| **ST-1** | the real (clean) plugin tree | `detectDrift()` returns `[]` | SC-1, FR-1 |
| **ST-2** | a temp-dir `roots` object whose catalog omits one **real** widget's bullet and whose recipe `.md` drifts from its module region | `detectDrift(roots)` returns exactly `[{kind:'undocumented-widget',name}, {kind:'snippet-drift',module}]` (order-independent), writing/mutating no repo file | SC-1, FR-1 |
| **ST-3** | a recipe `.md` whose embedded block differs from its module region | `replaceFencedBlock(md, region)` yields text for which `checkDrift(result, region) === []` | SC-2, FR-2 |
| **ST-4** | the clean tree | `fixSnippetDrift(detectDrift())` returns `[]` and writes nothing (no-op) | SC-2, FR-2 |
| **ST-5** | a known widget name (e.g. `Button`) | `buildCatalogEntryRequest(name)` returns a request whose `user` text contains the widget's real JSDoc lead + `@example`, and whose `target.afterHeading` is the deterministic `New — needs categorization` holding heading; it invents no behavior | SC-3, FR-3, AR-14 |
| **ST-6** | an `undocumented-widget` finding for a **real** widget (e.g. `Button`) + a temp-dir `roots` catalog omitting its bullet + a **fake** `DraftClient` | `fixUndocumentedWidgets([f], fake, roots)` awaits `fake.draft` with the built request, writes the bullet to the **temp** catalog (not the repo), and makes no network call | SC-4, FR-3b, AR-10 |
| **ST-7** | the catalog text + a drafted bullet for `name` | `applyCatalogEntry(...)` inserts it under the `New — needs categorization` heading (creating it if absent), and `checkBarrelCoverage([name,...], result, denylist)` no longer reports `name` | SC-4, FR-3 |
| **ST-8** | the repo tree | `tools/claude-plugin/skills/jsvision-plugin-sync/SKILL.md` exists with valid frontmatter (`name`, `description`, `disable-model-invocation: true`) and `claude plugin validate` passes | SC-5, FR-3a |
| **ST-9** | `.github/workflows/plugin-self-sync.yml` | it declares `workflow_dispatch` and **no** other trigger, references no `secrets.*`, and the README documents the enable steps | SC-6, FR-5, AR-8 |
| **ST-10** | the repo after adding `@anthropic-ai/sdk` | it appears only in the **root** `devDependencies` (no `packages/*/package.json`), and `yarn check:deps` stays green | SC-6, AR-9 |
| **ST-11** | the real tree after `detectDrift` is added | `runAllChecks().ok === true` (PL-01's gate is unregressed; `detectDrift` is additive) | SC-7, AR-6 |

## Acceptance (end-to-end, fake client)

- **A-1**: seed an undocumented widget + a drifted snippet in a temp copy → `yarn plugin:sync --fix`
  clears the snippet; the AI path with the **fake** client drafts + writes the catalog entry →
  `node scripts/check-plugin.mjs` returns PASS. Proves the full detect → fix → gate loop without a
  network call. (Manual/e2e; documents the real-key path is identical bar the client.)
- **A-2**: `yarn verify` green (incl. the new specs + `check-plugin: PASS`); `claude plugin validate`
  passes with both skills present.

## Notes on non-determinism

The model output itself is never asserted (it is drafted, then **checked** by barrel-coverage + a
human). Tests pin the deterministic scaffolding: detection, the mechanical fix, the request shape, the
write/apply, the injected-seam call, and the governance guarantees (no secret, no native dep, no
auto-commit).
