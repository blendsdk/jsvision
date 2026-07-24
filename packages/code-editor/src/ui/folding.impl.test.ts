import { resolveCapabilities } from '@jsvision/core';
import { Commands, type DispatchEvent } from '@jsvision/ui';
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

/** Creates a direct application command envelope for editor command-route coverage. */
function commandEvent(command: string): DispatchEvent {
  return {
    event: { type: 'command', command },
    handled: false,
  };
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

  it('unfolds touched bodies after fresh analysis', () => {
    const controller = createCodeEditorController({
      document: createDocumentModel({
        text: 'function stable() {\n  return 1;\n}\nconst tail = true;',
        languageId: 'typescript',
      }),
    });
    controller.setLanguageResult(result(controller, [wholeFold(controller)]));
    controller.foldAll();

    const body = controller.document.text.indexOf('1');
    controller.document.setSelection({ anchor: body, head: body + 1 });
    expect(controller.replaceSelection('2')).toBe(true);
    controller.setLanguageResult(result(controller, [wholeFold(controller)]));

    expect(controller.folds).toEqual([]);
  });

  it('validates constructor results and preserves compatible fold assignments', () => {
    const document = createDocumentModel({
      text: 'function ready() {\n  return 1;\n}\nconst tail = true;',
      languageId: 'typescript',
    });
    const range = {
      from: Number(document.snapshot.line(0).from),
      to: Number(document.snapshot.line(2).to),
    };
    const controller = createCodeEditorController({
      document,
      languageResult: {
        identity: document.identity,
        adapterId: 'typescript',
        generation: 1,
        state: 'ready',
        syntax: [],
        folds: [range, { from: -1, to: 2 }],
        brackets: [],
      },
    });

    expect(controller.foldableRegions).toEqual([{ from: 0, to: 2 }]);
    const hidden = document.text.indexOf('return');
    document.setSelection({ anchor: hidden, head: hidden });
    controller.folds = [{ from: 0, to: 2 }];
    expect(controller.folds).toEqual([{ from: 0, to: 2 }]);
    expect(document.selection).toMatchObject({ anchor: 0, head: 0 });
    controller.folds = [{ from: 1, to: 2 }];
    expect(controller.folds).toEqual([]);
  });

  it('keeps one deterministic outer region when nested ranges share a header', () => {
    const document = createDocumentModel({
      text: 'outer {\n  middle {\n    value;\n  }\n}\ntail;',
      languageId: 'typescript',
    });
    const controller = createCodeEditorController({ document });
    controller.setLanguageResult(
      result(controller, [
        { from: Number(document.snapshot.line(0).from), to: Number(document.snapshot.line(4).to) },
        { from: Number(document.snapshot.line(0).from), to: Number(document.snapshot.line(3).to) },
      ]),
    );

    expect(controller.foldableRegions).toEqual([{ from: 0, to: 4 }]);
    controller.foldAll();
    controller.toggleFoldLine(0);
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

  it('unfolds before horizontal navigation, deletion, word movement, or search reaches hidden rows', () => {
    const controller = createCodeEditorController({
      document: createDocumentModel({
        text: 'header {\n  hidden target;\n}\ntail',
        languageId: 'typescript',
      }),
    });
    const editor = new CodeEditor({ controller });
    controller.setLanguageResult(result(controller, [wholeFold(controller)]));
    controller.foldAll();
    const headerEnd = Number(controller.document.snapshot.line(0).to);
    controller.document.setSelection({ anchor: headerEnd, head: headerEnd });

    editor.routeKey({ key: 'ArrowRight' });
    expect(controller.folds).toEqual([]);

    controller.foldAll();
    editor.setSearchQuery('target');
    editor.execute('search.next');
    expect(controller.folds).toEqual([]);
    expect(
      controller.document.text.slice(
        Number(controller.document.selection.anchor),
        Number(controller.document.selection.head),
      ),
    ).toBe('target');

    controller.document.setSelection({ anchor: headerEnd, head: headerEnd });
    controller.foldAll();
    editor.routeKey({ key: 'ArrowRight', ctrl: true });
    expect(controller.folds).toEqual([]);
  });

  it('unfolds every containing region before nested hidden source becomes reachable', () => {
    const document = createDocumentModel({
      text: 'outer {\n  inner {\n    hidden target;\n  }\n}\ntail',
      languageId: 'typescript',
    });
    const controller = createCodeEditorController({ document });
    const editor = new CodeEditor({ controller });
    controller.setLanguageResult(
      result(controller, [
        { from: Number(document.snapshot.line(0).from), to: Number(document.snapshot.line(4).to) },
        { from: Number(document.snapshot.line(1).from), to: Number(document.snapshot.line(3).to) },
      ]),
    );
    controller.foldAll();

    editor.setSearchQuery('target');
    editor.execute('search.next');

    expect(controller.folds).toEqual([]);
    expect(document.snapshot.slice(Number(document.selection.anchor), Number(document.selection.head))).toBe('target');
  });

  it('unfolds command and document-end targets before selecting hidden source', () => {
    const document = createDocumentModel({
      text: 'header {\n  hidden;\n}',
      languageId: 'typescript',
    });
    const controller = createCodeEditorController({ document });
    const editor = new CodeEditor({ controller });
    controller.setLanguageResult(result(controller, [wholeFold(controller)]));

    controller.foldAll();
    const selectAll = commandEvent(Commands.selectAll);
    editor.onEvent(selectAll);
    expect(selectAll.handled).toBe(true);
    expect(controller.folds).toEqual([]);
    expect(document.selection).toMatchObject({ anchor: 0, head: document.text.length });

    controller.setLanguageResult(
      result(controller, [
        {
          from: Number(document.snapshot.line(0).from),
          to: Number(document.snapshot.line(document.snapshot.lineCount - 1).to),
        },
      ]),
    );
    controller.foldAll();
    editor.execute('cursor.documentEnd');
    expect(controller.folds).toEqual([]);
    expect(document.selection).toMatchObject({ anchor: document.text.length, head: document.text.length });
  });
});
