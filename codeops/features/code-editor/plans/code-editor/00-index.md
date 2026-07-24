# Code Editor Implementation Plan

> **Feature**: Terminal-native source-code editor and window
> **Status**: Planning Complete
> **Created**: 2026-07-23
> **Implements**: code-editor/SET-REQUIREMENTS (RD-01 through RD-06)
> **CodeOps Artifact Schema**: 1

## Overview

This integrated plan adds a new `@jsvision/code-editor` package containing a terminal-native
`CodeEditor`, `CodeEditorWindow`, local language adapters, LSP coordination, hybrid editor themes,
and an optional Node runtime adapter. It preserves the existing `Editor` and keeps files,
workspaces, database access, cross-document effects, and service policy under host control.

Architecture commitments remain evidence-driven: the first phase proves the headless document,
Lezer, protocol, dependency, and performance assumptions and activates a predeclared indexed-piece-
tree or worker fallback if measurements invalidate them (AR-P04, AR-P07, AR-P17).

## Document Index

| # | Document | Description |
|---|----------|-------------|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate and delegated decisions |
| 00 | [Index](00-index.md) | Overview and navigation |
| 01 | [Requirements](01-requirements.md) | Six-RD delta view |
| 02 | [Current State](02-current-state.md) | Repository-grounded analysis |
| 03-01 | [Architecture and Package](03-01-architecture-and-package.md) | Layers, exports, scheduling, dependency gates |
| 03-02 | [Document Engine](03-02-document-engine.md) | Text, transactions, positions, history, projection |
| 03-03 | [Local Languages](03-03-local-languages.md) | Adapters, Lezer, syntax, structure |
| 03-04 | [LSP Intelligence](03-04-lsp-intelligence.md) | Session lifecycle, validation, assistance |
| 03-05 | [Terminal UI and Theme](03-05-terminal-ui-and-theme.md) | View, window, rendering, input, presentation |
| 03-06 | [Showcase and Release](03-06-showcase-and-release.md) | Examples, docs, packaging, plugin |
| 07 | [Testing Strategy](07-testing-strategy.md) | Specification cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Dependency-ordered task checklist |

## Quick Reference

```ts
import { CodeEditor, CodeEditorWindow } from "@jsvision/code-editor";
import { javascriptLanguage } from "@jsvision/code-editor/languages/javascript";

const editor = new CodeEditor({
  document: { text: "const answer = 42;\n", languageId: "javascript" },
  languages: [javascriptLanguage()],
});
const window = new CodeEditorWindow({ editor });
```

| Decision | Outcome |
|----------|---------|
| Product boundary | New package and component; existing `Editor` unchanged |
| Document | Internal contract backed by public CodeMirror state primitives after probe |
| Syntax | Direct public headless parsers; no DOM or CodeMirror view |
| Intelligence | Transport-neutral LSP 3.18 session; optional `/node` adapter |
| Presentation | Viewport projection and dedicated hybrid `CodeEditorTheme` |
| Verification | Specification-first phases ending in `yarn verify` |

## Related Files

- `packages/code-editor/` — new public package and tests.
- `packages/examples/code-editor-demo/` and kitchen-sink story registration.
- `packages/docs-site/` and `docs/` — public and architecture documentation/ADRs.
- `tools/claude-plugin/` — generated API and CodeEditor catalog/recipe updates.
