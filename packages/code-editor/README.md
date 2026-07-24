# @jsvision/code-editor

A terminal-native source-code editor for JSVision applications. It provides an editor window—not
an IDE—and has no browser or DOM dependency.

## Quick start

```ts
import { CodeEditorWindow, createCodeEditorController, createDocumentModel } from '@jsvision/code-editor';

const document = createDocumentModel({
  uri: 'file:///workspace/main.ts',
  languageId: 'typescript',
  text: 'const answer: number = 42;\n',
});
const controller = createCodeEditorController({
  document,
  host: async (effect) => {
    // Save, close, navigation, commands, and cross-document edits stay host-owned.
    console.log(effect.kind);
    return true;
  },
});
const window = new CodeEditorWindow({ controller, title: 'main.ts' });
```

The root entry point includes the document model, controller, `CodeEditor`, `CodeEditorWindow`,
themes, protocol-neutral LSP coordination, safety limits, degradation state, and observability.
Built-in adapters are separate public imports:

- `@jsvision/code-editor/languages/javascript`
- `@jsvision/code-editor/languages/typescript`
- `@jsvision/code-editor/languages/postgresql`
- `@jsvision/code-editor/node` for the optional Node JSON-RPC process transport

## Language services and safety

The editor uses the industry-standard Language Server Protocol through a transport-neutral
`CodeEditorLspSession`. Applications may provide an in-process session or use the Node transport.
Filesystem writes, commands, cross-document edits, navigation, save, and close remain explicit
host effects; the editor never silently owns those operations.

All document, protocol, completion, diagnostic, decoration, history, and telemetry collections
have hard limits. Oversized or malformed results are rejected or truncated and reported through
the degradation and observability APIs. Source text is projected into terminal cells, so terminal
control bytes are displayed safely instead of being written to the terminal.

## Themes and terminal capabilities

The hybrid theme model supports application-derived colors, editor overrides, and independent
dark, light, and classic palettes. Semantic roles remain stable while colors change. Monochrome,
ASCII, narrow-terminal, diagnostic, selection, pending, read-only, and degraded states retain
non-color indicators.

## Standalone kitchen sink

Run the comprehensive, deterministic example:

```sh
yarn workspace @jsvision/examples demo:code-editor
```

It covers editor/window composition, editing lifecycle, SQL/JavaScript/TypeScript/plain text,
local parsing, simulated LSP intelligence, host authorization, hostile Unicode, themes,
accessibility, resizing, and all document-size tiers without a network, database, workspace,
credentials, external language server, or arbitrary file access.
