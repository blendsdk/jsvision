# Execution Plan: Code Editor

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-24 01:02
> **Progress**: 11/61 tasks (18%)
> **CodeOps Artifact Schema**: 1

## Overview

Execute one integrated, probe-first implementation of RD-01 through RD-06. Production phases obey
the shared specification-first ordering. The branch-drift prerequisite is intentionally first:
the user authorizes any synchronization; execution then revalidates paths and decisions (AR-P22).

**🚨 Update this document after EACH completed task.**

| Phase | Title | Tasks |
|-------|-------|-------|
| 0 | Integration baseline | 3 |
| 1 | Architecture probes and package skeleton | 8 |
| 2 | Document engine and lifecycle | 8 |
| 3 | Local language features | 8 |
| 4 | LSP intelligence | 8 |
| 5 | Terminal UI and theme | 8 |
| 6 | Quality and security closure | 8 |
| 7 | Showcase, docs, and release | 10 |

**Total: 61 tasks across 8 phases.**

> **Execution rule:** mark an implemented task `[~]` with the real timestamp, promote it to `[x]`
> only after its verification passes, and update this header after every task. Resume the first
> `[~]`, otherwise the first `[ ]`. Task checkboxes below are the single progress source.

## Phase 0: Integration baseline

> **Phase baseline tree**: _(phase completed before execution snapshots were introduced)_

- [x] 0.1.1 Obtain user authorization for the branch synchronization strategy; do not rebase, merge, reset, or discard changes without it — AR-P22 ✅ (completed: 2026-07-24 00:15)
- [x] 0.1.2 Synchronize using the authorized non-destructive workflow, resolve only in-scope conflicts, and record the new base — repository branch ✅ (completed: 2026-07-24 00:15)
- [x] 0.1.3 Revalidate current-state file targets, public UI seams, requirements readiness, architecture decisions, and `yarn verify`; reopen affected ARs before continuing — `02-current-state.md`, `00-ambiguity-register.md` ✅ (completed: 2026-07-24 00:15)

**Verify**: `yarn verify`

## Phase 1: Architecture probes and package skeleton

> **Phase baseline tree**: dd8a1e2086fbe01609b4a72d2a6252abdce2c5ec

- [x] 1.1.1 [spec-author] Write ST-01–ST-04 specification tests — `packages/code-editor/test/code-editor-architecture.spec.test.ts` ✅ (completed: 2026-07-24 00:27)
- [x] 1.1.2 Run the architecture specification suite and record the expected red result — ST-01–ST-04 ✅ expected red: probe modules absent (completed: 2026-07-24 00:27)
- [x] 1.2.1 Add workspace/package/strict TypeScript skeleton and explicit exports — `packages/code-editor/package.json`, `packages/code-editor/tsconfig.json`, `packages/code-editor/src/index.ts` ✅ (completed: 2026-07-24 00:28)
- [x] 1.2.2 Implement headless document/parser/protocol/subpath feasibility probes — `packages/code-editor/src/architecture/feasibility.ts`, `packages/code-editor/src/architecture/feasibility-runner.ts` ✅ (completed: 2026-07-24 00:31)
- [x] 1.2.3 Implement reference latency/memory/dependency/license probe and fixtures — `packages/code-editor/bench/reference.ts`, `packages/code-editor/bench/fixtures.ts`, `packages/code-editor/README.md` ✅ (completed: 2026-07-24 00:36)
- [x] 1.2.4 Run ST-01–ST-04 green; select primary/fallback paths strictly from recorded thresholds and update ADR evidence — `packages/docs-site/reference/decisions/` ✅ (completed: 2026-07-24 00:38)
- [x] 1.3.1 Add implementation tests for import isolation, probe determinism, failure reporting, and package closure — `packages/code-editor/test/code-editor-architecture.impl.test.ts` ✅ (completed: 2026-07-24 00:39)
- [x] 1.3.2 Run focused package checks and `yarn verify` ✅ quality re-review clean (completed: 2026-07-24 01:02)

**Verify**: `yarn workspace @jsvision/code-editor test && yarn verify`

## Phase 2: Document engine and lifecycle

> **Phase baseline tree**: _(recorded by exec-plan)_

- [ ] 2.1.1 [spec-author] Write ST-05–ST-11 specification tests — `packages/code-editor/src/document/document.spec.test.ts`
- [ ] 2.1.2 Run document specifications and record the expected red result — ST-05–ST-11
- [ ] 2.2.1 Implement typed identities, snapshot/storage adapter, line index, and position conversion — `packages/code-editor/src/document/types.ts`, `packages/code-editor/src/document/storage.ts`, `packages/code-editor/src/document/positions.ts`
- [ ] 2.2.2 Implement validated atomic transactions, selection mapping, read-only, and limits — `packages/code-editor/src/document/transaction.ts`, `packages/code-editor/src/document/limits.ts`
- [ ] 2.2.3 Implement bounded undo/redo, save checkpoints, replacement, search, and size modes — `packages/code-editor/src/document/history.ts`, `packages/code-editor/src/document/model.ts`, `packages/code-editor/src/document/search.ts`
- [ ] 2.2.4 Run ST-05–ST-11 green; fix implementation only
- [ ] 2.3.1 Add model/property/edge/performance implementation tests — `packages/code-editor/src/document/document.impl.test.ts`, `packages/code-editor/src/document/document.property.test.ts`
- [ ] 2.3.2 Run focused document benchmarks/tests and `yarn verify`

**Verify**: `yarn workspace @jsvision/code-editor test && yarn verify`

## Phase 3: Local language features

> **Phase baseline tree**: _(recorded by exec-plan)_

- [ ] 3.1.1 [spec-author] Write ST-12–ST-18 specification tests — `packages/code-editor/src/languages/languages.spec.test.ts`
- [ ] 3.1.2 Run language specifications and record the expected red result — ST-12–ST-18
- [ ] 3.2.1 Implement versioned adapters, registry, result validators, scheduler, and generation cancellation — `packages/code-editor/src/languages/contracts.ts`, `packages/code-editor/src/languages/registry.ts`, `packages/code-editor/src/languages/scheduler.ts`
- [ ] 3.2.2 Implement Lezer bridge, categories, fragments, viewport queries, folds, and brackets — `packages/code-editor/src/languages/lezer.ts`, `packages/code-editor/src/languages/syntax.ts`, `packages/code-editor/src/languages/structure.ts`
- [ ] 3.2.3 Implement JavaScript, TypeScript, PostgreSQL and plain adapters plus indentation/comments/invisibles — `packages/code-editor/src/languages/builtins.ts`, `packages/code-editor/src/languages/editing.ts`, `packages/code-editor/src/languages/invisibles.ts`
- [ ] 3.2.4 Run ST-12–ST-18 green; fix implementation only
- [ ] 3.3.1 Add incremental-equivalence, invalid-parser, Unicode, tier, and timing implementation tests — `packages/code-editor/src/languages/languages.impl.test.ts`, `packages/code-editor/src/languages/languages.perf.test.ts`
- [ ] 3.3.2 Run focused language tests/benchmarks and `yarn verify`

**Verify**: `yarn workspace @jsvision/code-editor test && yarn verify`

## Phase 4: LSP intelligence

> **Phase baseline tree**: _(recorded by exec-plan)_

- [ ] 4.1.1 [spec-author] Write ST-19–ST-31 specification tests — `packages/code-editor/src/lsp/lsp.spec.test.ts`
- [ ] 4.1.2 Run LSP specifications and record the expected red result — ST-19–ST-31
- [ ] 4.2.1 Implement session contract, protocol DTO validation, lifecycle/sync coordinator, capabilities, timeouts, and races — `packages/code-editor/src/lsp/session.ts`, `packages/code-editor/src/lsp/validation.ts`, `packages/code-editor/src/lsp/coordinator.ts`
- [ ] 4.2.2 Implement completion/snippets, hover/signatures, diagnostics, and safe Markdown — `packages/code-editor/src/lsp/completion.ts`, `packages/code-editor/src/lsp/hover.ts`, `packages/code-editor/src/lsp/diagnostics.ts`
- [ ] 4.2.3 Implement navigation/symbols, formatting/save flow, host effects, and optional Node adapter — `packages/code-editor/src/lsp/navigation.ts`, `packages/code-editor/src/lsp/formatting.ts`, `packages/code-editor/src/node/session-adapter.ts`
- [ ] 4.2.4 Run ST-19–ST-31 green; fix implementation only
- [ ] 4.3.1 Add shared-session races, protocol/snippet/Markdown fuzz, flood, and inert-process implementation tests — `packages/code-editor/src/lsp/lsp.impl.test.ts`, `packages/code-editor/src/node/session-adapter.impl.test.ts`
- [ ] 4.3.2 Run focused LSP/Node tests and `yarn verify`

**Verify**: `yarn workspace @jsvision/code-editor test && yarn verify`

## Phase 5: Terminal UI and theme

> **Phase baseline tree**: _(recorded by exec-plan)_

- [ ] 5.1.1 [spec-author] Write ST-32–ST-38 specification tests — `packages/code-editor/src/ui/code-editor.spec.test.ts`
- [ ] 5.1.2 Run UI/theme specifications and record the expected red result — ST-32–ST-38
- [ ] 5.2.1 Implement controller, public state/commands, `CodeEditor`, and `CodeEditorWindow` — `packages/code-editor/src/controller.ts`, `packages/code-editor/src/ui/code-editor.ts`, `packages/code-editor/src/ui/code-editor-window.ts`
- [ ] 5.2.2 Implement viewport projection, gutter/status, input routing, popup/chooser focus, and terminal-safe rendering — `packages/code-editor/src/ui/projection.ts`, `packages/code-editor/src/ui/input.ts`, `packages/code-editor/src/ui/assistance.ts`
- [ ] 5.2.3 Implement theme schema/resolver/presets/inspection, precedence, contrast, and capability fallback — `packages/code-editor/src/theme/theme.ts`, `packages/code-editor/src/theme/resolve.ts`, `packages/code-editor/src/theme/presets.ts`
- [ ] 5.2.4 Run ST-32–ST-38 green; fix implementation only
- [ ] 5.3.1 Add golden-frame, focus, command, theme fuzz, contrast, resize, and terminal-serialization implementation tests — `packages/code-editor/src/ui/code-editor.impl.test.ts`, `packages/code-editor/src/theme/theme.impl.test.ts`
- [ ] 5.3.2 Run focused UI/theme tests and `yarn verify`

**Verify**: `yarn workspace @jsvision/code-editor test && yarn verify`

## Phase 6: Quality and security closure

> **Phase baseline tree**: _(recorded by exec-plan)_

- [ ] 6.1.1 [spec-author] Extend immutable suites with the cross-cutting RD-04 flood, failure, accessibility, package, and retained-memory cases — existing `*.spec.test.ts`
- [ ] 6.1.2 Run the added cross-cutting specifications and record the expected red result
- [ ] 6.2.1 Harden one centralized limits/degradation/observability policy and failure containment — `packages/code-editor/src/limits.ts`, `packages/code-editor/src/degradation.ts`, `packages/code-editor/src/observability.ts`
- [ ] 6.2.2 Add terminal/protocol/theme fuzz corpora and reference p50/p95/peak-memory harness — `packages/code-editor/test/fuzz-corpus.ts`, `packages/code-editor/bench/reference.ts`
- [ ] 6.2.3 Close package API, dependency/license, no-DOM, retained-resource, and legacy `Editor` compatibility gates — `packages/code-editor/src/architecture/`, `packages/ui/src/editor/`
- [ ] 6.2.4 Run all cross-cutting specifications green; fix implementation only
- [ ] 6.3.1 Add implementation stress tests for cancellation/disposal, hostile callbacks, floods, and all size tiers — `packages/code-editor/src/quality.impl.test.ts`, `packages/code-editor/src/quality.perf.test.ts`
- [ ] 6.3.2 Run benchmark evidence, focused quality/security suites, and `yarn verify`

**Verify**: `yarn workspace @jsvision/code-editor test && yarn verify`

## Phase 7: Showcase, docs, and release

> **Phase baseline tree**: _(recorded by exec-plan)_

- [ ] 7.1.1 [spec-author] Write ST-39–ST-42 specification tests — `packages/examples/code-editor-demo/code-editor-demo.spec.test.ts`
- [ ] 7.1.2 Run showcase/release specifications and record the expected red result — ST-39–ST-42
- [ ] 7.2.1 Implement deterministic session/scenario registry and exhaustive standalone demo — `packages/examples/code-editor-demo/session.ts`, `packages/examples/code-editor-demo/scenarios.ts`, `packages/examples/code-editor-demo/main.ts`
- [ ] 7.2.2 Add `demo:code-editor`, standalone E2E, and concise global kitchen-sink story — `packages/examples/package.json`, `packages/examples/code-editor-demo/code-editor-demo.e2e.test.ts`, `packages/examples/kitchen-sink/stories/code-editor.story.ts`
- [ ] 7.2.3 Complete package README/JSDoc/examples/changelog and architecture/public docs/ADRs — `packages/code-editor/README.md`, `packages/code-editor/CHANGELOG.md`, `docs/`
- [ ] 7.2.4 Update release/package metadata and JSVision plugin catalog/recipes/generated API — `package.json`, `.github/workflows/release.yml`, `tools/claude-plugin/`
- [ ] 7.2.5 Run ST-39–ST-42 green; fix implementation only
- [ ] 7.3.1 Add scenario-completeness, demo state, packaging, docs-link, and plugin-drift implementation tests — `packages/examples/code-editor-demo/code-editor-demo.impl.test.ts`, `scripts/`
- [ ] 7.3.2 Run standalone/global demo E2E, pack/import, docs, plugin sync/check, reference benchmarks, and `yarn verify`
- [ ] 7.3.3 Record final acceptance evidence, refresh CodeOps-aware project guidance if architecture changed, and update technical docs without implementation-plan identifiers in code/comments — `AGENTS.md`, `docs/`

**Verify**: `yarn workspace @jsvision/examples test:e2e && yarn verify`

## Dependencies

```text
0 Integration baseline
  → 1 Probes/package
    → 2 Document
      → 3 Languages
        → 4 LSP
          → 5 UI/theme
            → 6 Quality/security
              → 7 Showcase/release
```

## Success Criteria

1. All 61 tasks are complete in order and every red/green transition is recorded.
2. All approved RD acceptance criteria and ST-01–ST-42 pass.
3. The legacy `Editor` API/behavior remains unchanged.
4. Reference latency, memory, size-tier, hostile-input, and terminal-only gates pass.
5. Public package/subpath, documentation, examples, plugin, and release evidence is complete.
6. `yarn verify` passes without warnings, errors, or waived failures.
