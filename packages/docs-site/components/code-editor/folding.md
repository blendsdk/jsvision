---
title: Code Editor folding
description: Add language-provided and structure-derived Code Editor fold regions with stable navigation, viewport projection, and explicit expand/collapse commands.
---

# Folding

Folding is a presentation over document ranges. The source remains unchanged while the viewport
projects collapsed headers, hidden lines, and stable navigation targets.

## Focused usage

```ts
import { CodeEditor } from '@jsvision/code-editor';

const editor = new CodeEditor({ controller, lineNumbers: true });
editor.execute('fold.toggle');
```

## Language-provided folds

A language adapter can return ranges that understand constructs such as functions, queries, and
nested blocks. Apply only results produced for the current document revision.

<PlayExample id="code-editor/language-folding"
  title="Language fold regions"
  blurb="Collapse a parser-informed TypeScript region, inspect the visible header, and navigate without changing source text."
/>

## Structural folds

Structure-derived folds are useful when a dedicated language parser is unavailable. Keep them
separate from language ranges so the host can explain their origin and choose a predictable
precedence.

<PlayExample id="code-editor/structural-folding"
  title="Structure-derived folding"
  blurb="Create a bounded structural region, collapse it, and verify that selection and revision remain stable."
/>

## Limits and practices

- Normalize overlapping regions before publishing them to the controller.
- Reject stale fold results after document revision changes.
- Preserve a visible collapsed header and keyboard route; color alone is not sufficient.
- Expand or remap folds when an edit invalidates their range.

## Related

- [Languages & syntax](/components/code-editor/languages-and-syntax) — produce parser-backed ranges.
- [Viewport & large documents](/components/code-editor/viewport-and-large-documents) — understand
  visible-row projection.
- [`CodeEditor` API](/api/code-editor/classes/CodeEditor) — folding commands.
