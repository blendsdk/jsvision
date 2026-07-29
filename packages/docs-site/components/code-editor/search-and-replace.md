---
title: Code Editor search and replace
description: Use Code Editor's bounded search session, query navigation, replacement commands, document revisions, and dismissal behavior.
---

# Search and replace

Search state belongs to the editor interaction session while matches are resolved against the
current document snapshot. Replacement is a document transaction and therefore advances revision,
history, selection, and subscribers together.

## Focused usage

```ts
import { searchDocument } from '@jsvision/code-editor';

const matches = searchDocument(document.snapshot, 'message', { maxResults: 100 });
```

## Search

Opening search exposes a focused query surface. Next and previous navigation wrap predictably and
move the real document selection to the active match.

<PlayExample id="code-editor/search"
  title="Search navigation"
  blurb="Open a query, find repeated text, and inspect selection movement without mutating the document."
/>

## Replace

Replace-current and replace-all use the same revision-aware mutation path as ordinary edits. Show
the replacement count and resulting revision so a no-op cannot be mistaken for success.

<PlayExample id="code-editor/replace"
  title="Revision-aware replacement"
  blurb="Replace a bounded match set and inspect the exact revision and visible status change."
/>

## Limits and practices

- Recompute matches from the current snapshot after edits; do not retain stale offsets.
- Keep queries bounded and avoid logging query or replacement text.
- Dismiss search through its command route before letting Escape reach surrounding dialogs.
- Treat replace-all as one explainable transaction when atomic undo is the intended behavior.

## Related

- [Documents & lifecycle](/components/code-editor/documents-and-lifecycle) — understand revisions
  and transactions.
- [Editing, navigation & clipboard](/components/code-editor/editing-navigation-clipboard) — learn
  input routing.
- [`searchDocument` API](/api/code-editor/functions/searchDocument) — generated search options.
