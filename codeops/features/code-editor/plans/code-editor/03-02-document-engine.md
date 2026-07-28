# Document Engine: Code Editor

> **Document**: 03-02-document-engine.md
> **Parent**: [Index](00-index.md)

## Overview

The pure document engine owns one exact UTF-16 text state, lineage, monotonic revision, selection,
modified/save checkpoint, bounded history, search state, and atomic transactions. Third-party text
objects remain private implementation details (AR-P04, AR-P10, AR-P15).

## Core types

```ts
type DocumentOffset = number & { readonly __documentOffset: unique symbol };
type DocumentRevision = number & { readonly __documentRevision: unique symbol };

interface DocumentSnapshot {
  readonly lineage: string;
  readonly revision: DocumentRevision;
  readonly length: number;
  readonly lineCount: number;
  slice(from: DocumentOffset, to?: DocumentOffset): string;
  lineAt(offset: DocumentOffset): LogicalLine;
}

interface DocumentTransaction {
  readonly base: DocumentIdentity;
  readonly edits: readonly DocumentEdit[];
  readonly selection?: DocumentSelection;
  readonly origin: EditOrigin;
}
```

Factories validate finite integral ordered values; callers cannot manufacture trusted offsets by
casting. Transactions sort and validate edits, reject overlap or ceiling overflow before applying,
and produce exactly one revision and undo entry (AR-P13–AR-P15).

## Storage and fallback

The primary adapter wraps public `Text`/`ChangeSet` primitives after the feasibility gate. It adds
lineage, revision, limits, transactions, selection mapping, and history. The fallback is an
internal balanced piece tree augmented with UTF-16 length and line-break counts. Both implement the
same conformance suite and benchmark contract; the current gap buffer is not extended (AR-P04).

## Positions and viewport

- Document offsets and LSP line/character positions use validated UTF-16 semantics unless the
  session negotiates another encoding.
- Visual columns are derived through core grapheme/cell-width utilities and tab stops.
- Line and viewport queries are logarithmic or bounded by visible content.
- Projection emits clipped visible rows plus measured overscan; it never retains styled rows for
  the entire document (AR-P11).

## History, replacement, and modes

Document replacement creates a new lineage, clears history and document-scoped state, and cancels
old work. Save checkpoints mark a revision without hiding later edits. Read-only checks occur at
the transaction boundary, so every editing path shares enforcement. Size-tier transitions use the
resolved limits policy and never change text (AR-P10, AR-P14, AR-P15).

## Error handling

| Error case | Strategy | AR Ref |
|------------|----------|--------|
| Invalid/stale/foreign transaction | Typed rejection; no allocation or mutation | AR-P10, AR-P13 |
| Overlap or hard-ceiling violation | Reject complete transaction atomically | AR-P14, AR-P15 |
| History exceeds bound | Evict oldest complete entries; retain current state/checkpoint | AR-P14 |
| Oversized replacement | Require approved load decision or reject before full model creation | AR-P14 |

## Testing requirements

- Model-based/property tests over edits, lines, positions, graphemes, selections, and undo/redo.
- Cross-backend conformance tests if the fallback activates.
- Tiered p50/p95 and peak-memory tests, including rapid random edits.
- Security tests for invalid numbers, huge claims, controls, bidi, and hostile Unicode.
