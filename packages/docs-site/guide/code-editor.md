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
