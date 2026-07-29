---
title: Code Editor
description: Compose JSVision's terminal-native CodeEditor and CodeEditorWindow with document controllers, languages, search, folding, LSP services, themes, and explicit host-effect policy.
---

# Code Editor

`CodeEditor` is the embeddable editing surface; `CodeEditorWindow` adds a title, status line, and
scrollbars for desktop-style applications. Both are backed by the same document/controller model,
so an application can choose its chrome without changing document ownership, commands, language
services, or lifecycle policy.

## Quick start

Start with these guided workspaces. Each opens maximized with substantial TypeScript source, real
syntax highlighting, one named action, and a side rail that explains what changed inside the
editor.

<PlayExample id="code-editor/lsp-completion"
  title="Explore intelligent TypeScript completion"
  blurb="Place the lesson at a real member-expression caret, request bounded completion, hover, and signature help, then inspect the native suggestion popup."
/>

<PlayExample id="code-editor/lsp-diagnostics"
  title="Find and explain a TypeScript error"
  blurb="Reveal a parser-aligned diagnostic, inspect its severity marker and terminal-safe explanation, then reset the lesson."
/>

<PlayExample id="code-editor/language-folding"
  title="Navigate a structured TypeScript module"
  blurb="Collapse parser-provided regions, inspect the gutter markers and shortened document, then restore the complete source."
/>

### Composition basics

Create the document and controller first, then give the controller to either surface. Stable
`memory:` or application-owned URIs make document identity explicit without implying filesystem
access.

```ts
import { CodeEditorWindow, createCodeEditorController, createDocumentModel } from '@jsvision/code-editor';

const document = createDocumentModel({
  uri: 'memory://workspace/main.ts',
  languageId: 'typescript',
  text: 'export const answer = 42;\n',
});
const controller = createCodeEditorController({ document });
const editor = new CodeEditorWindow({ controller, title: 'main.ts', lineNumbers: true });
```

<PlayExample id="code-editor/quick-start"
  title="Embedded surface or complete window"
  blurb="Compare direct CodeEditor composition with CodeEditorWindow chrome, edit the real document, and maximize or resize the responsive lab."
/>

## Capability map

| Goal                                                    | Guide                                                                                                                                                                                  |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Own identity, revisions, external changes, and disposal | [Documents & lifecycle](/components/code-editor/documents-and-lifecycle)                                                                                                               |
| Edit, select, navigate, and copy safely                 | [Editing, navigation & clipboard](/components/code-editor/editing-navigation-clipboard)                                                                                                |
| Select adapters and handle incomplete source            | [Languages & syntax](/components/code-editor/languages-and-syntax)                                                                                                                     |
| Add local structure, search, or protocol intelligence   | [Folding](/components/code-editor/folding), [Search & replace](/components/code-editor/search-and-replace), and [Language intelligence](/components/code-editor/language-intelligence) |
| Bound rendering cost and recover from host failures     | [Viewport & large documents](/components/code-editor/viewport-and-large-documents) and [Host safety & recovery](/components/code-editor/host-safety-and-recovery)                      |

## Cross-cutting practices

- Keep the document model authoritative; do not mirror source text in widget-local state.
- Treat save, close, navigation, and external-change decisions as host effects requiring policy.
- Use bounded in-process services in demos and tests. A rendered editor must not imply network or
  process authority.
- Dispose controllers, schedulers, coordinators, sessions, and editor surfaces when their owning
  workspace closes.
- Preserve non-color indicators for focus, selection, diagnostics, read-only state, and degradation.

## CodeEditor

Choose the direct surface inside an existing pane, tab, split view, or dialog. The host supplies
surrounding status and scrollbar presentation when it needs a custom layout.

## CodeEditorWindow

Choose the window when the conventional title, horizontal and vertical scrollbars, and line/column
status are useful as one unit. Its editor remains available as `window.editor`.

## Standalone showcase

Run the complete terminal showcase when you want to explore the component outside the browser
documentation:

```sh
yarn workspace @jsvision/examples demo:code-editor
```

The showcase is deterministic and uses bounded in-process language services—no compiler,
PostgreSQL connection, external language server, or implicit host authority. Its stable scenario
facets make the full teaching inventory visible to both readers and release checks:

| Scenario family                          | Stable facet key                            |
| ---------------------------------------- | ------------------------------------------- |
| Embedded editor and desktop window       | `editor-and-window`                         |
| Editing, history, and document lifecycle | `editing-lifecycle`                         |
| SQL, JavaScript, TypeScript, and plain   | `languages-sql-javascript-typescript-plain` |
| Syntax, brackets, comments, and folding  | `local-language-features`                   |
| Completion, hover, diagnostics, and LSP  | `lsp-intelligence`                          |
| Explicit save/navigation approval        | `host-authorization`                        |
| Hostile and invisible Unicode            | `hostile-and-unicode-text`                  |
| Theme roles and terminal fallbacks       | `themes-and-capabilities`                   |
| Keyboard access and responsive resize    | `accessibility-and-resize`                  |
| Normal full-document behavior            | `full-document-tier`                        |
| Bounded large-document behavior          | `large-document-tier`                       |
| Confirmation-required document behavior  | `confirmation-document-tier`                |

Choose a scenario to see its purpose, interaction steps, expected result, and current evidence.
Resetting or switching scenarios clears prior evidence so a previous result cannot be mistaken for
the current run.

## Related

- [Themes & fallbacks](/components/code-editor/themes-and-fallbacks) — resolve editor colors against
  application roles.
- [Code Editor API map](/components/code-editor/api) — find visual and supporting public APIs.
- [`CodeEditor` API](/api/code-editor/classes/CodeEditor) and
  [`CodeEditorWindow` API](/api/code-editor/classes/CodeEditorWindow) — generated signatures.
