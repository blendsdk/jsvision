# Architecture and Package: Code Editor

> **Document**: 03-01-architecture-and-package.md
> **Parent**: [Index](00-index.md)

## Overview

The feature is a dedicated public package whose root remains transport-neutral and whose optional
language and Node integrations are explicit exports (AR-P02, AR-P09, AR-P25).

## Architecture

```text
CodeEditor / CodeEditorWindow / CodeEditorTheme
                 │
        Controller + priority scheduler
          ┌──────┼───────────┐
          │      │           │
 Document engine│       LSP coordinator
          │      │           │
          └─ LanguageAdapter ┘
                 │
        Lezer built-in adapters
```

Only validated internal DTOs cross layer boundaries. The package root exports contracts, component,
window, theme, plain mode, and host effects. Language adapters use explicit subpaths; `/node`
exports the optional process/JSON-RPC adapter (AR-P08–AR-P10, AR-P25).

## Public contracts

```ts
export interface CodeEditorOptions {
  readonly document: CodeEditorDocumentInput;
  readonly languages?: readonly LanguageAdapter[];
  readonly lspSession?: CodeEditorLspSession;
  readonly theme?: CodeEditorThemeInput;
  readonly limits?: CodeEditorLimitsInput;
  readonly readOnly?: boolean;
  readonly onHostEffect?: (effect: CodeEditorHostEffect) => void | Promise<void>;
}

export class CodeEditor extends View {
  constructor(options: CodeEditorOptions);
  readonly state: ReadonlySignal<CodeEditorPublicState>;
  dispatch(command: CodeEditorCommand): CodeEditorCommandResult;
  replaceDocument(input: CodeEditorDocumentInput): void;
  dispose(): void;
}
```

Exact subordinate shapes are finalized in their owning component specs; no third-party type is
exposed from the root document API (AR-P04, AR-P16).

## Scheduling and ownership

- Input, caret, selection, scrolling, and dismissal run at interactive priority.
- Parse, decoration, diagnostics, and completion ingestion run as bounded cooperative work.
- Every queued item owns a cancellation handle and full generation stamp.
- Disposal cancels work before releasing bounded retained state.
- A single controller coordinates layers but does not implement their algorithms (AR-P07, AR-P10).

## Dependency gates

The feasibility executable must prove:

1. root and each subpath import in Node 22 without DOM/browser globals;
2. package dependency closure contains no IDE/browser runtime;
3. all shipped licenses are compatible;
4. language subpaths do not initialize unrelated parsers;
5. Node process behavior is unreachable unless `/node` is imported and invoked;
6. public UI seams suffice without internal imports;
7. package artifacts build under strict NodeNext and clean-process consumption.

## Error handling

| Error case | Strategy | AR Ref |
|------------|----------|--------|
| Contract major mismatch | Reject configuration with bounded actionable error | AR-P14, AR-P24 |
| Optional subsystem throws | Isolate, cancel its work, expose degraded state | AR-P07, AR-P10 |
| Host callback throws or stalls | Catch asynchronously, rate-limit status, preserve editing | AR-P24 |
| Probe fails | Activate documented fallback and update ADR/spec before production phase | AR-P04, AR-P17 |

## Testing requirements

- Clean-process packaging tests for root and every export.
- Scheduler priority/cancellation/race tests with a deterministic clock.
- Existing `Editor` API and behavioral suite remains unchanged.
- Dependency, license, module, and side-effect checks.
