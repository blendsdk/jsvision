import {
  CodeEditor,
  createCodeEditorController,
  createCodeEditorLspCoordinator,
  createDocumentModel,
  createInProcessLspSession,
  createLanguageScheduler,
} from '@jsvision/code-editor';
import { typescriptLanguageAdapter } from '@jsvision/code-editor/languages/typescript';
import { Group, Text, onCleanup } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

/** Representative capabilities demonstrated by the concise repository-wide story. */
const representativeCapabilities = Object.freeze([
  'syntax-highlighting',
  'line-numbers',
  'status',
  'editing',
  'selection',
  'search',
  'folding',
  'completion',
  'diagnostics',
]);

/** Concise Code Editor story; the standalone demo owns the exhaustive scenario catalog. */
export const codeEditorStory: Story & {
  readonly stateEcho: string;
  readonly interactionHints: readonly string[];
  readonly representativeCapabilities: readonly string[];
} = {
  id: 'code-editor',
  category: 'Text editing',
  title: 'CodeEditor',
  blurb:
    'Live syntax, line numbers, status, editing, selection, search, folding, completion, and diagnostics. Run demo:code-editor for every scenario.',
  stateEcho: 'TypeScript · Ln 1, Col 1 · ready · writable',
  interactionHints: Object.freeze([
    'Type to edit',
    'Ctrl-F search',
    'Ctrl-Space completion',
    'Ctrl-G fold',
    'Click to place the caret',
  ]),
  representativeCapabilities,
  build(context: StoryContext) {
    const document = createDocumentModel({
      uri: 'file:///kitchen-sink/code-editor.ts',
      languageId: 'typescript',
      text: 'function greet(name: string) {\n  return `Hello ${name}`;\n}\n',
    });
    const session = createInProcessLspSession({ capabilities: { completion: true, diagnostics: true } });
    const coordinator = createCodeEditorLspCoordinator({
      document,
      session,
      uri: document.uri ?? 'file:///kitchen-sink/code-editor.ts',
      languageId: document.languageId,
    });
    const controller = createCodeEditorController({ document, lsp: coordinator });
    const editor = new CodeEditor({ controller });
    let disposed = false;
    onCleanup(() => {
      disposed = true;
      editor.dispose();
      void coordinator.close();
    });
    editor.openCompletion([{ label: 'greet', insertText: 'greet(name)' }]);
    void createLanguageScheduler()
      .analyze(typescriptLanguageAdapter, document.text, document.identity)
      .then((result) => {
        if (disposed) return;
        controller.setLanguageResult(result);
        editor.invalidate();
      });
    void coordinator.open().then(() => {
      if (disposed) return;
      session.publishDiagnostics(document.uri ?? '', Number(document.identity.revision), [
        {
          range: { start: { line: 1, character: 9 }, end: { line: 1, character: 24 } },
          message: 'Simulated diagnostic',
          severity: 3,
        },
      ]);
      editor.invalidate();
    });
    const group = new Group();
    const editorHeight = Math.max(4, context.height - 3);
    group.add(at(editor, 0, 0, Math.max(20, context.width), editorHeight));
    group.add(
      at(
        new Text(() => {
          const state = controller.publicState;
          return `${state.language} · Ln ${state.line}, Col ${state.visualColumn} · ${state.serviceState} · ${
            state.modified ? 'modified' : 'saved'
          } · diagnostics=${controller.diagnostics.length}`;
        }),
        0,
        editorHeight,
        Math.max(20, context.width),
        1,
      ),
    );
    group.add(
      at(
        new Text(`${codeEditorStory.interactionHints.join(' · ')} · full catalog: demo:code-editor`),
        0,
        editorHeight + 1,
        Math.max(20, context.width),
        2,
      ),
    );
    return group;
  },
};
