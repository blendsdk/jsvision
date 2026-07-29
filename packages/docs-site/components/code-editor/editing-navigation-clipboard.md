---
title: Code Editor editing, navigation, and clipboard
description: Teach Code Editor keyboard and mouse editing, selection, history, navigation, read-only behavior, and safe clipboard routing.
---

# Editing, navigation, and clipboard

`CodeEditor` routes terminal keys through dismissal, assistance, snippet, editor-command, and text
layers in a deterministic order. The document remains the authority for edits and selections, while
the host owns the clipboard boundary.

## Focused usage

```ts
import { CodeEditor } from '@jsvision/code-editor';

const editor = new CodeEditor({ controller, lineNumbers: true });
editor.focus();
editor.execute('cursor.documentEnd');
```

## Editing and navigation

Keyboard commands and mouse gestures update the same selection model. Keep line numbers optional:
they consume viewport width but do not change document positions. Selection-aware indentation,
history, comment toggling, and caret-follow scrolling all remain transactions over the controller.

<PlayExample id="code-editor/editing-navigation"
  title="Editing and navigation workbench"
  blurb="Edit, select, move, and inspect revision/caret feedback through the real terminal event path."
/>

## Read-only clipboard

Read-only means mutations are rejected; focus, navigation, selection, search, and copy can remain
available. Route copied text through the application clipboard seam and present only content-free
confirmation in logs or status surfaces.

<PlayExample id="code-editor/readonly-clipboard"
  title="Read-only copy contract"
  blurb="Select source in a locked document, copy it safely, and verify that the document revision never changes."
/>

## Limits and practices

- Register custom bindings through the public key-binding API and resolve collisions explicitly.
- Do not turn read-only into disabled; users still need focus, selection, navigation, and copy.
- Keep source-bearing clipboard data out of observability messages.
- Test keys through the real application loop so menu and shell accelerators cannot mask conflicts.

## Related

- [Search & replace](/components/code-editor/search-and-replace) — use the editor-owned query flow.
- [Viewport & large documents](/components/code-editor/viewport-and-large-documents) — understand
  pointer projection and scrolling.
- [`CodeEditor` API](/api/code-editor/classes/CodeEditor) — commands and options.
