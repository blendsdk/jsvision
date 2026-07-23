# Requirements: Code Editor

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Sources**: [RD-01](../../requirements/RD-01-editor-surface-and-document-lifecycle.md),
> [RD-02](../../requirements/RD-02-local-language-features.md),
> [RD-03](../../requirements/RD-03-language-server-intelligence.md),
> [RD-04](../../requirements/RD-04-quality-security-and-operability.md),
> [RD-05](../../requirements/RD-05-code-editor-kitchen-sink.md), and
> [RD-06](../../requirements/RD-06-theme-and-syntax-presentation.md)

## Scope of this plan

### In this plan

- RD-01: component/window surfaces, one-document lifecycle, commands, host effects, state, read-only,
  search, undo, and compatibility.
- RD-02: open language adapter contract, plain/JavaScript/TypeScript/PostgreSQL modes, syntax,
  gutter, folding, brackets, indentation, comments, and hostile-invisible presentation.
- RD-03: LSP 3.18 session lifecycle, completion/snippets, hover/signatures, diagnostics,
  navigation/symbols, formatting, and host-mediated cross-document effects.
- RD-04: latency/size budgets, safety ceilings, terminal sanitation, degradation, accessibility,
  failure isolation, packaging, benchmarks, and release evidence.
- RD-06: hybrid theme contract, stable semantic categories, precedence, contrast, capability
  downsampling, inspection, and palettes.
- RD-05: standalone exhaustive CodeEditor demo plus concise global kitchen-sink story.

### Deferred and excluded

The owning RDs defer multiple carets, wrapping, workspace symbols, rename, code actions, semantic
tokens, and mouse-triggered hover, and exclude Bash and editor-owned workspaces/files/databases.
This plan does not advance them.

## Plan-local decisions

| Decision | Chosen | AR Ref |
|----------|--------|--------|
| Package ownership | Dedicated `@jsvision/code-editor` with optional subpaths | AR-P02, AR-P25 |
| Component relationship | Separate layered component; legacy `Editor` unchanged | AR-P03 |
| Text implementation | Probe-gated CodeMirror state primitives; indexed piece-tree fallback | AR-P04 |
| Parser integration | Direct public Lezer with bounded scheduling | AR-P05–AR-P07 |
| LSP integration | Editor-owned session/coordinator and optional Node adapter | AR-P08–AR-P10 |
| Delivery | Probes first, specification-first phases, full repository gate | AR-P17–AR-P22 |

## Plan-local acceptance criteria

1. The feasibility phase records reproducible pass/fail evidence for every conditional architecture
   choice before production implementation begins.
2. Package-root, language-subpath, and Node-subpath clean-process imports prove their declared
   dependency and side-effect boundaries.
3. After branch synchronization, current-state paths and all architecture-probe conclusions are
   revalidated before the first production task.
