# ADR-010: Headless parser and document architecture for the code editor

> **Date**: 2026-07-24
> **Status**: Accepted

## Context

The terminal-native code editor needs an efficient text model, JavaScript, TypeScript, and
PostgreSQL parsing, and Language Server Protocol types without a browser, DOM, or IDE runtime.
Library documentation alone cannot prove import isolation, dependency closure, scheduling
behavior, or interactive latency.

The architecture probe evaluated built public package entry points in separate Node 22 processes,
exercised representative edits and parsers, inspected every installed production dependency
instance and license, and measured document edit-plus-viewport projection for one-mebibyte and
fifty-thousand-line fixtures.

## Options Considered

### Option A: CodeMirror state and language packages

- **Pros**: Cohesive APIs and mature parsers.
- **Cons**: The language wrappers ship `@codemirror/view`, introducing a DOM-oriented runtime
  dependency even when the editor does not import a browser view.

### Option B: Public headless packages behind editor-owned contracts

- **Pros**: Keeps the dependency closure terminal-safe and makes each parser replaceable.
- **Cons**: PostgreSQL and Lezer results require separate adapter implementations.

### Option C: Custom text model and grammars

- **Pros**: Complete control over behavior and dependencies.
- **Cons**: Substantially larger correctness, security, performance, and maintenance burden.

## Decision

Use `@codemirror/state` `Text` and `ChangeSet` internally for document storage and mapping.
Use `@lezer/javascript` directly for JavaScript and TypeScript. Use `pgsql-ast-parser` behind the
PostgreSQL adapter, with revision-stamped cancellable background work and bounded lexical
presentation while a parse is pending. Use official `vscode-languageserver-protocol` types behind
an editor-owned transport-neutral session.

Do not ship CodeMirror language or view packages. Parser-specific types remain internal to their
adapters. The indexed piece-tree document model remains the fallback if later document or memory
probes breach their hard limits.

## Evidence

On Node 22.23.1 for Linux x64 on an Intel Core i7-7820HQ, the committed
`yarn workspace @jsvision/code-editor bench:architecture` run recorded 20 samples after five
warmups:

| Fixture      | Edit + viewport p50 | Edit + viewport p95 |
| ------------ | ------------------- | ------------------- |
| 1 MiB        | 0.176 ms            | 0.337 ms            |
| 50,000 lines | 0.129 ms            | 0.190 ms            |

The isolated process used `--expose-gc`: baseline heap was 6,065,984 bytes, peak working heap was
11,429,560 bytes, and post-disposal heap was 6,183,184 bytes, for 117,200 peak retained bytes above
baseline. Raw samples and the complete environment record are committed with the benchmark.

All supported built entry points imported in separate processes without DOM globals, process
imports, or unrelated parser imports. A deterministic priority scheduler interleaved interactive
updates with bounded parser, diagnostic, and completion slices; generation-cancelled results did
not reach its presentation sink. The complete versioned production dependency closure contained
only explicitly reviewed runtime packages, no DOM/browser/IDE runtime, and MIT-compatible declared
licenses.

These measurements are environment evidence, not universal timing constants. Regression checks
must retain deterministic fixtures and record runtime and platform alongside latency and memory.

## Consequences

### Positive

- Root and optional entry points remain usable in a clean terminal Node runtime.
- JavaScript, TypeScript, PostgreSQL, and LSP support do not require browser or IDE internals.
- The document model and each parser remain replaceable behind editor-owned contracts.

### Negative

- PostgreSQL cannot reuse Lezer incremental fragments and needs its own bounded scheduling path.
- Adapter code must normalize different parser outputs into one syntax and structure model.

### Risks

- Reopen the PostgreSQL parser choice if measured synchronous calls breach the interaction budget.
- Reopen the document model if later transaction, mapping, or retained-memory probes fail.
- Re-run dependency and license closure checks whenever runtime dependencies change.
