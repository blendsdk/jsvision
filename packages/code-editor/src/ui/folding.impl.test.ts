import { resolveCapabilities } from '@jsvision/core';
import { describe, expect, it } from 'vitest';

import { createCodeEditorController } from '../controller.js';
import { createDocumentModel } from '../document/model.js';
import type { FoldRange, LocalLanguageResult } from '../languages/contracts.js';
import { CodeEditor } from './code-editor.js';

const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;

/** Creates a matching language result from untrusted fold ranges. */
function result(
  controller: ReturnType<typeof createCodeEditorController>,
  folds: readonly FoldRange[],
): LocalLanguageResult {
  return {
    identity: controller.document.identity,
    adapterId: 'typescript',
    generation: 1,
    state: 'ready',
    syntax: [],
    folds,
    brackets: [],
  };
}

/** Returns the full-document fold for the controller's current snapshot. */
function wholeFold(controller: ReturnType<typeof createCodeEditorController>): FoldRange {
  const snapshot = controller.document.snapshot;
  return { from: Number(snapshot.line(0).from), to: Number(snapshot.line(snapshot.lineCount - 2).to) };
}

describe('fold reconciliation', () => {
  it('temporarily exposes stale source and restores an unambiguous fold after an unrelated edit', () => {
    const controller = createCodeEditorController({
      document: createDocumentModel({
        text: 'function stable() {\n  const value = 1;\n  return value;\n}\nconst tail = true;',
        languageId: 'typescript',
      }),
    });
    controller.setLanguageResult(result(controller, [wholeFold(controller)]));
    controller.foldAll();
    expect(controller.folds).toEqual([{ from: 0, to: 3 }]);

    const tail = controller.document.text.indexOf('true');
    controller.document.setSelection({ anchor: tail, head: tail + 4 });
    expect(controller.replaceSelection('false')).toBe(true);
    expect(controller.folds).toEqual([]);

    controller.setLanguageResult(result(controller, [wholeFold(controller)]));
    expect(controller.folds).toEqual([{ from: 0, to: 3 }]);
  });

  it('unfolds when an edited structural header no longer has the same identity', () => {
    const controller = createCodeEditorController({
      document: createDocumentModel({
        text: 'function before() {\n  return 1;\n}\nconst tail = true;',
        languageId: 'typescript',
      }),
    });
    controller.setLanguageResult(result(controller, [wholeFold(controller)]));
    controller.foldAll();

    const name = controller.document.text.indexOf('before');
    controller.document.setSelection({ anchor: name, head: name + 'before'.length });
    expect(controller.replaceSelection('after')).toBe(true);
    controller.setLanguageResult(result(controller, [wholeFold(controller)]));

    expect(controller.folds).toEqual([]);
  });
});

describe('folded viewport limits', () => {
  it('derives vertical and horizontal scroll ranges only from visible rows', () => {
    const controller = createCodeEditorController({
      document: createDocumentModel({
        text: ['function compact() {', `  ${'hidden'.repeat(30)}`, '  return 1;', '}', 'tail'].join('\n'),
        languageId: 'typescript',
      }),
    });
    const editor = new CodeEditor({ controller, lineNumbers: true });
    controller.setLanguageResult(result(controller, [wholeFold(controller)]));
    controller.foldAll();

    editor.project({ width: 32, height: 3, caps });

    expect(editor.viewportMetrics.maxScrollY).toBe(0);
    expect(editor.viewportMetrics.maxScrollX).toBe(0);
  });
});
