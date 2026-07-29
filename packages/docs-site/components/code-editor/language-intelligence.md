---
title: Code Editor language intelligence and LSP
description: Connect bounded in-process Code Editor language services for completion, diagnostics, hover, symbols, navigation, formatting, cancellation, and recovery.
---

# Language intelligence and LSP

`InProcessLspSession` and `CodeEditorLspCoordinator` expose protocol-shaped intelligence without
granting network or process authority. The coordinator keeps requests revision-aware, bounded,
cancellable, and projected into editor-owned presentation.

## Focused usage

```ts
import { createCodeEditorLspCoordinator, createInProcessLspSession } from '@jsvision/code-editor';

const session = createInProcessLspSession({ capabilities: { completion: true } });
const coordinator = createCodeEditorLspCoordinator({
  document,
  session,
  uri: 'file:///workspace/main.ts',
  languageId: 'typescript',
});
```

## Completion, signature, and hover

Completion arrays, labels, documentation, snippets, signatures, and hover text all cross a trust
boundary. Limit their size before presentation and discard responses for cancelled or stale
requests.

<PlayExample id="code-editor/lsp-completion"
  title="Smart TypeScript completion"
  blurb="Explore a highlighted profile formatter, request suggestions at profile., and inspect the real popup plus its bounded hover and signature evidence."
/>

## Diagnostics

Diagnostics need severity, range, and a terminal-safe message. Overlay placement must stay inside
the current viewport and use non-color severity cues.

<PlayExample id="code-editor/lsp-diagnostics"
  title="Understand TypeScript diagnostics"
  blurb="Find a realistic property mistake, reveal its editor marker, and read the safe explanation and suggested correction beside the source."
/>

## Navigation and formatting

Symbols, definitions, formatting, and host navigation are independently available capabilities.
Expose unavailable operations honestly; a service advertising completion does not imply that it
can format or navigate.

<PlayExample id="code-editor/lsp-navigation"
  title="Navigation and service availability"
  blurb="Start an in-process service, reveal one deterministic local definition, and inspect content-free caret and service state."
/>

## Limits and practices

- Validate protocol objects, ranges, array counts, and presentation text at the session boundary.
- Cancel superseded work and check document revision before applying every result.
- Keep source-bearing request data out of logs and observability snapshots.
- Dispose coordinator and session together; no pending callback may update a released editor.

## Related

- [Host safety & recovery](/components/code-editor/host-safety-and-recovery) — authorize effects and
  recover failures.
- [Languages & syntax](/components/code-editor/languages-and-syntax) — keep local adapters usable
  without a service.
- [`createCodeEditorLspCoordinator` API](/api/code-editor/functions/createCodeEditorLspCoordinator)
  — generated coordinator options.
