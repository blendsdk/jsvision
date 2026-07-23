# Current State: Code Editor

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

`@jsvision/ui` provides a general-purpose `Editor`/`EditWindow`, reactive `View`, `DrawContext`,
popup host, theme/capability system, event dispatch, search, undo, and terminal rendering. The
editor uses a two-string UTF-16 gap buffer and tightly coupled sibling modules for input, drawing,
selection, navigation, and dialogs. It is a useful behavioral reference but not a suitable base
class for code-language state (AR-P03).

The examples package already demonstrates the required showcase pattern through DataGrid: a
standalone executable, package script, E2E child-process test, and global kitchen-sink story.

### Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `packages/ui/src/editor/editor.ts` | Existing general editor state/API | Compatibility oracle only |
| `packages/ui/src/editor/gap.ts` | Two-string gap buffer | Do not extend; reuse only proven utilities |
| `packages/ui/src/editor/editor-actions/draw.ts` | Viewport editor painting | Reference terminal clipping and selection |
| `packages/ui/src/view.ts` | Reactive mount/event/caret seams | Consume via public API |
| `packages/ui/src/draw-context.ts` | Safe cell drawing and capabilities | Consume via public API |
| `packages/ui/src/theme.ts` | Global Theme and resolver | Remains closed; editor adds separate resolver |
| `packages/ui/src/index.ts` | UI public entry point | Export only any minimal missing general seam |
| `packages/examples/table-demo/main.ts` | Standalone showcase precedent | Mirror for CodeEditor |
| `packages/examples/kitchen-sink/stories/data-grid.story.ts` | Global story precedent | Add concise CodeEditor story |
| `scripts/check-plugin.mjs` | Public UI/plugin drift gate | Extend plugin content for new package/API |
| `package.json` | Workspaces and authoritative verify | Add package/scripts; preserve `yarn verify` |

## Gaps Identified

| Gap | Current behavior | Required fix |
|-----|------------------|--------------|
| Indexed document model | Gap movement is distance-based; no persistent line/change mapping | Add independent transactional document engine (03-02) |
| Code-language state | No parser tree, adapters, folds, categories, or revision-tagged results | Add local language subsystem (03-03) |
| LSP | No session, synchronization, validation, or assistance controller | Add transport-neutral coordinator (03-04) |
| Presentation | Normal/selected editor roles only | Add viewport decoration projection and editor theme (03-05) |
| Performance evidence | Existing benchmark uses warmed minimum and skips CI gating | Add reproducible p50/p95/memory probes and reference environment |
| Package isolation | UI has only one runtime dependency | Isolate editor dependency closure in a new public package |

## Dependencies

### Internal

- Public `@jsvision/core` terminal geometry, capabilities, input, and scheduling primitives.
- Public `@jsvision/ui` View, Window, drawing, scrollbar, popup, command, and Theme primitives.
- `@jsvision/examples`, documentation site, plugin generation, and repository gates.

### External candidates

- `@codemirror/state` for public headless `Text`/`ChangeSet` only.
- Public Lezer parser/highlight packages and CodeMirror language packages where they expose
  headless `LRLanguage` parsers.
- `vscode-languageserver-protocol` and optional `vscode-jsonrpc` Node transport.
- A repository-compatible property/fuzz generator only if an existing lightweight facility cannot
  express the required invariants.

All candidates remain conditional on AR-P17/AR-P23 probes.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Branch is 349 commits behind `origin/develop` | High | High | Revalidate after user-authorized sync before implementation (AR-P22) |
| Synchronous parser call exceeds slice budget | Medium | High | Probe worst cases; region strategy, worker, or parser reopen trigger |
| New public package needs missing UI internals | Medium | High | Promote only generally useful minimal seams; otherwise revise boundary |
| Immutable text/history retains excess memory | Medium | High | Tier fixtures, peak-memory gate, bounded history, indexed-tree fallback |
| Protocol/terminal hostile data escapes validation | Medium | Critical | Ingress DTO validation plus final presentation sanitation |
| Showcase or docs drift from API | Medium | Medium | Compile imports, deterministic fixtures, E2E, plugin/doc gates |
