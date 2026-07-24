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

## Standalone kitchen sink

Run `yarn workspace @jsvision/examples demo:code-editor`. The demo is deterministic and uses a
simulated in-process language-service boundary; it is not a compiler, PostgreSQL connection, or
production language server.

Its stable scenario facets are:

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
