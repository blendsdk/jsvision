---
title: Code Editor API map
description: Map Code Editor visual surfaces, document and controller APIs, languages, folding, search, LSP coordination, limits, observability, and themes.
---

# Code Editor API map

The package exposes two visual surfaces plus supporting document, controller, language, protocol,
degradation, observability, and theme APIs. Import from `@jsvision/code-editor` unless a documented
language or locale subpath is the explicit subject.

## Visual surfaces

| Surface                                                         | Role                                      |
| --------------------------------------------------------------- | ----------------------------------------- |
| [`CodeEditor`](/api/code-editor/classes/CodeEditor)             | Embeddable focusable editor               |
| [`CodeEditorWindow`](/api/code-editor/classes/CodeEditorWindow) | Editor with title, scrollbars, and status |

Supporting public entry points include `createDocumentModel`, `createCodeEditorController`,
`LanguageRegistry`, `createLanguageScheduler`, `searchDocument`, `createInProcessLspSession`,
`createCodeEditorLspCoordinator`, `classifyDocumentSize`, `createDegradationState`,
`createObservabilityChannel`, and `resolveCodeEditorTheme`.

## Ownership boundaries

The document owns source identity and revisions. The controller owns mutation coordination. The
editor owns terminal interaction and viewport presentation. Language adapters and LSP sessions
produce bounded analysis; the host owns authorization, persistence, process/network policy,
external-change decisions, and final disposal.

Node-only transports, if used by an application, belong behind the separately documented Node
entry point. Browser documentation examples intentionally use bounded in-process seams.

## Related

- [Overview](/components/code-editor/) — choose the visual surface.
- [Documents & lifecycle](/components/code-editor/documents-and-lifecycle) — understand ownership.
- [Language intelligence](/components/code-editor/language-intelligence) — compose protocol services.
- [Host safety & recovery](/components/code-editor/host-safety-and-recovery) — enforce trust boundaries.
