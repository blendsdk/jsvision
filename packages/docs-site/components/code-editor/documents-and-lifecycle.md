---
title: Code Editor documents and lifecycle
description: Own Code Editor document identity, revisions, selections, controller mutations, external-change decisions, save formatting, and deterministic disposal.
---

# Documents and lifecycle

The document model owns text, identity, revision, selection, line endings, history, and size mode.
The controller coordinates mutations and host-facing lifecycle events. Keeping those responsibilities
outside the view makes resets, tests, multiple views, and external changes predictable.

## Focused usage

```ts
import { createCodeEditorController, createDocumentModel } from '@jsvision/code-editor';

const document = createDocumentModel({
  uri: 'memory://notes/today',
  languageId: 'plain',
  text: 'one deliberate source of truth\n',
});
const controller = createCodeEditorController({ document });
```

## Model and controller ownership

Read `document.snapshot`, `document.selection`, and `document.identity.revision` when the host needs
a stable observation. Mutate through controller/document commands so history, selection, viewport,
and subscribers see one transaction rather than unrelated assignments.

<PlayExample id="code-editor/document-controller"
  title="Document and controller inspector"
  blurb="Apply a real transaction and inspect revision, selection, language, and controller state from one authoritative document."
/>

## External changes and saves

External content can race with local edits. Decide explicitly whether to accept, reject, or report
a version conflict, and show the save-formatting outcome separately from the host write decision.
The editor can request a host effect; it does not silently claim file authority.

<PlayExample id="code-editor/external-changes"
  title="External-change decision lab"
  blurb="Simulate a bounded external revision, accept it through an explicit host decision, and inspect the resulting save outcome."
/>

## Limits and practices

- Give every document a stable URI; do not use display titles as identity.
- Compare expected revisions before accepting external content or save completion.
- Keep line-ending conversion visible in the save result instead of mutating source unexpectedly.
- Dispose the controller and any attached services once, after the final view releases ownership.

## Related

- [Editing, navigation & clipboard](/components/code-editor/editing-navigation-clipboard) — drive
  document transactions through user input.
- [Host safety & recovery](/components/code-editor/host-safety-and-recovery) — authorize effects
  and recover failed services.
- [`createDocumentModel` API](/api/code-editor/functions/createDocumentModel) — generated options.
