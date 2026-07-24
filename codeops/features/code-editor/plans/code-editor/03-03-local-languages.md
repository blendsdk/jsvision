# Local Languages: Code Editor

> **Document**: 03-03-local-languages.md
> **Parent**: [Index](00-index.md)

## Overview

The language layer is an open, versioned contract. Built-in JavaScript and TypeScript use the
direct public `@lezer/javascript` parser. PostgreSQL uses the public headless
`pgsql-ast-parser` package after the dependency probe rejected CodeMirror's DOM-bearing language
wrapper. Plain mode has no parser dependency (AR-P05–AR-P07, AR-P25, AR-P27).

## Contracts

```ts
interface LanguageAdapter {
  readonly contractVersion: 1;
  readonly id: string;
  readonly extensions: readonly string[];
  createLocalService?(context: LocalLanguageContext): LocalLanguageService;
  readonly lsp?: LanguageLspMetadata;
}

interface LocalLanguageResult {
  readonly identity: DocumentIdentity;
  readonly syntax: readonly SyntaxSpan[];
  readonly folds: readonly FoldRange[];
  readonly brackets: readonly BracketPair[];
}
```

Every result must be finite, ordered, bounded, forward-progressing, and stamped for the current
lineage/revision/adapter generation before it enters presentation (AR-P06, AR-P10, AR-P14).

## Parser integration

JavaScript and TypeScript adapters own Lezer parser configuration and incremental `TreeFragment`
retention. Highlight tags map to stable `SyntaxCategory` values; parser library types do not leak
through public contracts. PostgreSQL uses revision-stamped cancellable background parses with a
bounded lexical presentation while parsing is pending. Queries cover the viewport and bounded
look-around. The scheduler may bound work between parser calls but cannot falsely claim to preempt
a synchronous call; the probe measures worst-case call duration and reopens worker/region strategy
when needed (AR-P05–AR-P07, AR-P27).

PostgreSQL uses the selected PostgreSQL grammar and proves incomplete/invalid SQL recovery.
JavaScript and TypeScript share only parser configuration that preserves their distinct IDs,
extensions, comment rules, and language behavior.

## Structural commands

Indent, outdent, newline indentation, comment toggling, fold toggling, bracket matching, and
invisible warnings consume adapter metadata and validated document transactions. Missing, failed,
or suspended parser capabilities disable only their dependent presentation/commands and preserve
plain editing.

## Error handling

| Error case | Strategy | AR Ref |
|------------|----------|--------|
| Parser throws or makes no progress | Cancel generation, mark local service degraded, retain editing | AR-P07, AR-P14 |
| Invalid adapter range/category | Drop bounded result and expose sanitized latest failure | AR-P06, AR-P13 |
| Stale tree/result | Discard without repaint or state mutation | AR-P10 |
| Parse budget exceeded | Suspend expensive local features visibly for the active tier | AR-P07, AR-P14 |

## Testing requirements

- Headless valid/incomplete/invalid fixtures for all launch languages and plain mode.
- Incremental-edit tree equivalence against a clean parse.
- Stable category, fold, bracket, indentation, comment, and invisible-warning frames.
- Failure, cancellation, size-tier, and no-DOM clean-process tests.
