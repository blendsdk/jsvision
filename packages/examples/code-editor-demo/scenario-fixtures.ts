import {
  LanguageRegistry,
  createCodeEditorController,
  createDocumentModel,
  type CodeEditorLanguageId,
} from '@jsvision/code-editor';
import { javascriptLanguageAdapter } from '@jsvision/code-editor/languages/javascript';
import { postgresqlLanguageAdapter } from '@jsvision/code-editor/languages/postgresql';
import { typescriptLanguageAdapter } from '@jsvision/code-editor/languages/typescript';

import type { CodeEditorDemoFixture } from './scenarios.js';

const languageRegistry = new LanguageRegistry([
  postgresqlLanguageAdapter,
  javascriptLanguageAdapter,
  typescriptLanguageAdapter,
]);

/**
 * Creates one detached fixture snapshot and derives its initial public state through production
 * document/controller objects. Declarative labels therefore stay aligned with mounted behavior.
 */
export function snapshotCodeEditorFixture(source: CodeEditorDemoFixture): CodeEditorDemoFixture {
  const languageId = selectedFixtureLanguage(source);
  const document = createDocumentModel({
    text: source.text,
    languageId,
    readOnly: source.readOnly,
    uri: `memory://code-editor-demo/fixture/${encodeURIComponent(source.title)}`,
    confirmLargeDocument: () => true,
  });
  const controller = createCodeEditorController({ document });
  const expectedPublicState = controller.publicState;
  controller.dispose();
  return Object.freeze({
    ...source,
    languageId,
    ...(source.demonstrates === undefined ? {} : { demonstrates: Object.freeze([...source.demonstrates]) }),
    ...(source.languageSelection === undefined
      ? {}
      : { languageSelection: Object.freeze({ ...source.languageSelection }) }),
    expectedPublicState,
  });
}

/** Resolves extension/explicit selection while constraining unknown adapters to plain text. */
function selectedFixtureLanguage(source: CodeEditorDemoFixture): CodeEditorLanguageId {
  if (source.languageSelection === undefined) return source.languageId;
  const resolved = languageRegistry.resolve(source.languageSelection).id;
  if (resolved === 'postgresql' || resolved === 'javascript' || resolved === 'typescript') return resolved;
  return 'plain';
}
