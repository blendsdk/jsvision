# Code editor

`@jsvision/code-editor` is a terminal-native source editor for JSVision applications. It provides
focused editing and source comprehension rather than project-wide IDE features.

```ts
import { CodeEditorWindow, createCodeEditorController, createDocumentModel } from '@jsvision/code-editor';

const document = createDocumentModel({
  text: 'const answer: number = 42;\n',
  languageId: 'typescript',
  uri: 'file:///workspace/main.ts',
});
const controller = createCodeEditorController({ document });
const editorWindow = new CodeEditorWindow({ controller, title: 'main.ts' });
```

## Architecture

The document model owns exact text, positions, revisions, selection, history, and size tiers. Local
language adapters add syntax, structure, indentation, comments, folds, and brackets. The
transport-neutral Language Server Protocol boundary adds completion, snippets, hover, signatures,
diagnostics, definitions, symbols, and formatting. Host-owned effects such as saving, navigation,
commands, and cross-document edits require explicit application approval.

The UI projects sanitized terminal cells and supports application-derived themes, editor
overrides, independent palettes, monochrome output, and ASCII fallbacks. Bounded limits,
degradation notices, and content-free observations keep malformed or excessive input contained.

## Keyboard editing

The focused editor supports the modern single-selection actions most useful in a terminal:

| Keys                                 | Action                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `Tab` / `Shift+Tab`                  | Indent or dedent selected lines; without a selection, advance to the next tab stop or dedent the current line |
| `Enter`                              | Insert a newline and preserve the current leading indentation                                                 |
| `Ctrl+A`                             | Select the document                                                                                           |
| `Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z` | Undo or redo                                                                                                  |
| `Ctrl+Left` / `Ctrl+Right`           | Move by source-code word boundary; add `Shift` to extend the selection                                        |
| `Ctrl+Home` / `Ctrl+End`             | Move to the document boundary; add `Shift` to extend the selection                                            |
| `Ctrl+C` / `Ctrl+X` / `Ctrl+V`       | Copy, cut, or paste through JSVision's shared clipboard channel                                               |
| `Ctrl+/`                             | Toggle JavaScript, TypeScript, or PostgreSQL line comments                                                    |

Completion and snippet navigation retain priority over indentation. Multiple carets, column
selection, and browser or DOM clipboard dependencies are intentionally outside this editor's
single-selection terminal contract.

## Structural folding and window geometry

Local language results provide source-offset fold ranges. The controller validates them as
properly nested, current-revision, multi-line structures before allowing `fold`, `unfold`,
`foldAll`, `unfoldAll`, or `toggleFold`. A collapsed range changes presentation only. The visible
row mapping is shared by projection, keyboard navigation, mouse placement, caret following, line
numbers, and both scrollbar ranges.

Set `lineNumbers: true` on `CodeEditor` or `CodeEditorWindow` to expose clickable fold markers.
Unicode terminals use triangle markers; ASCII and monochrome profiles retain distinct expanded and
collapsed characters. A narrow viewport suppresses the entire gutter so source text remains
usable.

`CodeEditorWindow` re-fits its editor, scrollbars, and line/column status immediately after
drag-resize, maximize, restore, terminal resize while maximized, cascade, or tile. JSVision does
not currently provide a taskbar-style minimized window state.

## Standalone kitchen sink

Run `yarn workspace @jsvision/examples demo:code-editor`. The demo is deterministic and uses a
simulated in-process language-service boundary; it is not a compiler, PostgreSQL connection, or
production language server.

The navigation list contains dedicated direct-editor, windowed-editor, structural-folding,
read-only, viewport, language, LSP, theme/fallback, hostile-text, and document-size scenarios. A
visible capability inventory classifies each entry as `interactive`, `automated-only`, or
`unsupported`; the latter two include a reason and never claim a live scenario.

Interactive capability claims are executable. Each one identifies a reachable scenario control,
key, or native window action and a changed frame, public state, or host effect. The simulated
language service answers completion, hover, signature, symbols, diagnostics, navigation,
formatting, cancellation, and recovery requests without retaining source-bearing request payloads.
Host controls separately demonstrate accepted, rejected, and revision-conflicted saves.

Manual QA uses dedicated scenarios whose names start with `QA:`. Select one to see its purpose,
step-by-step interaction, expected result, and current evidence in the lower panel. Press `F5` or
choose **Actions → Run current QA check**. Each scenario exercises one behavior through the live
application command path and reports `PASS` only when its public completion/overlay state,
document revision, or bounded host event matches the stated expectation. Changing or resetting the
scenario returns the check to `READY`, preventing evidence from a previous test from carrying over.
Completion and other assistance popups are framed at the rendered caret position. Their placement
accounts for gutters and scrolling, flips above the caret when needed, and remains within the
current editor viewport after resize.

The two-editor scenario shares one in-process protocol transport while preserving distinct
document URIs, revisions, selections, presentations, cancellation, diagnostics, and host effects.
It uses two ordinary `CodeEditor` instances rather than tabs or an editor manager, and `Ctrl+Tab`
moves keyboard focus between them. Additional fixtures cover extension and explicit language
selection, missing adapters, invalid/incomplete
source, LF/CRLF/CR line endings, invisible/hostile Unicode, lifecycle decisions, live theme and
degradation changes, resize, and all size tiers.

Its stable high-level navigation facets are:

- `editor-and-window`
- `editing-lifecycle`
- `languages-sql-javascript-typescript-plain`
- `local-language-features`
- `lsp-intelligence`
- `host-authorization`
- `hostile-and-unicode-text`
- `themes-and-capabilities`
- `accessibility-and-resize`
- `full-document-tier`
- `large-document-tier`
- `confirmation-document-tier`

Add a scenario by defining a stable ID, title, description, immutable fixture factory, facet list,
and mount function in `packages/examples/code-editor-demo/scenarios.ts`. Keep demonstrations
self-contained and import only public package entry points.

The concise repository kitchen-sink story intentionally advertises fewer capabilities. Every item
in its blurb is enabled on the mounted editor, including line numbers, parser-backed folding,
completion, and diagnostics.

## Internationalization

Import one explicit Code Editor locale and pass the application-owned `i18n` service to either
`CodeEditor` or `CodeEditorWindow`:

```ts
import { CodeEditorWindow } from '@jsvision/code-editor';
import { codeEditorNl } from '@jsvision/code-editor/locales/nl';
import { createI18n, defineCatalog } from '@jsvision/i18n';

const overrides = defineCatalog({
  schema: 1,
  locale: 'nl',
  messages: { 'code-editor.window.title': 'Broneditor' },
});
const i18n = createI18n({ locale: 'nl', catalogs: [codeEditorNl, overrides] });
const editorWindow = new CodeEditorWindow({ controller, i18n });
```

Application catalogs come last and may override editor-owned messages. Query/replacement text,
source, language IDs, filenames, paths, command tokens, and LSP or host detail are never translated.
Without injection, every editor instance uses an isolated English fallback service.
