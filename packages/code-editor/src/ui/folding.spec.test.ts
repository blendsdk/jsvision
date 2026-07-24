import { resolveCapabilities, type MouseEvent } from '@jsvision/core';
import { createEventLoop, Group } from '@jsvision/ui';
import { describe, expect, it } from 'vitest';

import { createCodeEditorController, type CodeEditorController } from '../controller.js';
import { createDocumentModel } from '../document/model.js';
import type { DocumentIdentity } from '../document/types.js';
import type { FoldRange, LocalLanguageResult } from '../languages/contracts.js';
import { CodeEditor } from './code-editor.js';

const unicodeCaps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: {
    colorDepth: 'truecolor',
    unicode: { utf8: true },
    glyphs: { boxDrawing: true },
  },
}).profile;
const asciiCaps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: {
    colorDepth: 'mono',
    unicode: { utf8: false },
    glyphs: { boxDrawing: false },
  },
}).profile;

const SOURCE = ['function outer() {', '  if (ready) {', '    return value;', '  }', '}', 'const tail = true;'].join(
  '\n',
);

/** Creates a controller and editor over the nested source fixture. */
function nestedEditor() {
  const document = createDocumentModel({
    text: SOURCE,
    uri: 'memory://folding/nested.ts',
    languageId: 'typescript',
  });
  const controller = createCodeEditorController({ document });
  const editor = new CodeEditor({ controller, lineNumbers: true });
  return { controller, document, editor };
}

/** Returns deterministic outer and nested fold ranges in source-offset coordinates. */
function structuralRanges(controller: CodeEditorController): readonly [FoldRange, FoldRange] {
  const snapshot = controller.document.snapshot;
  return [
    { from: Number(snapshot.line(0).from), to: Number(snapshot.line(4).to) },
    { from: Number(snapshot.line(1).from), to: Number(snapshot.line(3).to) },
  ];
}

/** Creates one current or deliberately foreign local-language result. */
function languageResult(
  identity: DocumentIdentity,
  folds: readonly FoldRange[],
  adapterId = 'typescript',
): LocalLanguageResult {
  return {
    identity,
    adapterId,
    generation: 1,
    state: 'ready',
    syntax: [],
    folds,
    brackets: [],
  };
}

/** Reads one projected terminal row without making assumptions about style objects. */
function rowText(editor: CodeEditor, row: number): string {
  return (
    editor
      .project({ width: 32, height: 6, caps: unicodeCaps })
      .cells[row]?.map((cell) => cell.text)
      .join('') ?? ''
  );
}

/** Creates a one-based primary-button event for a zero-based editor cell. */
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 };
}

interface StructuralFoldCommands {
  fold(): void;
  unfold(): void;
  foldAll(): void;
  unfoldAll(): void;
}

/** Narrows the public controller only after every structural folding command is present. */
function hasStructuralFoldCommands(
  controller: CodeEditorController,
): controller is CodeEditorController & StructuralFoldCommands {
  return (
    'fold' in controller &&
    typeof controller.fold === 'function' &&
    'unfold' in controller &&
    typeof controller.unfold === 'function' &&
    'foldAll' in controller &&
    typeof controller.foldAll === 'function' &&
    'unfoldAll' in controller &&
    typeof controller.unfoldAll === 'function'
  );
}

describe('structural fold validation and commands', () => {
  // Only current, bounded, multi-line, properly nested adapter ranges may become foldable regions.
  it('should accept nested current ranges and reject malformed, crossing, stale, and excessive ranges', () => {
    const { controller } = nestedEditor();
    const [outer, inner] = structuralRanges(controller);
    const snapshot = controller.document.snapshot;
    const crossing = {
      from: Number(snapshot.line(2).from),
      to: Number(snapshot.line(5).to),
    };

    controller.setLanguageResult(
      languageResult(controller.document.identity, [
        outer,
        inner,
        crossing,
        { from: Number(snapshot.line(2).from), to: Number(snapshot.line(2).to) },
        { from: -1, to: Number(snapshot.line(1).to) },
      ]),
    );
    expect(controller.languageResult?.folds).toEqual([outer, inner]);

    const foreign = nestedEditor().controller;
    foreign.setLanguageResult(
      languageResult({ lineage: 'foreign-document', revision: foreign.document.identity.revision }, [outer]),
    );
    expect(foreign.languageResult).toBeUndefined();

    const excessive = Array.from({ length: controller.limits.folds + 1 }, () => inner);
    controller.setLanguageResult(languageResult(controller.document.identity, excessive));
    expect(controller.languageResult?.folds.length).toBeLessThanOrEqual(controller.limits.folds);
  });

  // Folding is presentation-only: source identity, dirty state, and undo history never change.
  it('should hide and restore only region interiors while preserving document state', () => {
    const { controller, document, editor } = nestedEditor();
    const [outer, inner] = structuralRanges(controller);
    controller.setLanguageResult(languageResult(document.identity, [outer, inner]));
    const inside = Number(document.snapshot.line(2).from) + 4;
    document.setSelection({ anchor: inside + 6, head: Number(document.snapshot.line(0).from) });
    const before = {
      text: document.text,
      identity: document.identity,
      modified: document.modified,
      undoDepth: document.undoDepth,
      redoDepth: document.redoDepth,
    };

    editor.execute('fold.toggle');

    expect(controller.folds).toEqual([{ from: 0, to: 4 }]);
    expect(document.selection).toEqual({
      anchor: Number(document.snapshot.line(0).from),
      head: Number(document.snapshot.line(0).from),
    });
    expect(rowText(editor, 0)).toContain('function outer()');
    expect(rowText(editor, 1)).toContain('const tail');
    expect(document.text).toBe(before.text);
    expect(document.identity).toEqual(before.identity);
    expect(document.modified).toBe(before.modified);
    expect(document.undoDepth).toBe(before.undoDepth);
    expect(document.redoDepth).toBe(before.redoDepth);

    editor.execute('fold.toggle');
    expect(controller.folds).toEqual([]);
    expect(rowText(editor, 1)).toContain('if (ready)');
    expect(document.text).toBe(before.text);
  });

  // The stable public command boundary supports one-region and all-region operations.
  it('should expose fold, unfold, fold-all, and unfold-all operations', () => {
    const { controller, document } = nestedEditor();
    controller.setLanguageResult(languageResult(document.identity, structuralRanges(controller)));

    expect(hasStructuralFoldCommands(controller)).toBe(true);
    if (!hasStructuralFoldCommands(controller)) return;

    controller.foldAll();
    expect(controller.folds).toEqual([
      { from: 0, to: 4 },
      { from: 1, to: 3 },
    ]);
    controller.unfoldAll();
    expect(controller.folds).toEqual([]);

    document.setSelection({
      anchor: Number(document.snapshot.line(1).from),
      head: Number(document.snapshot.line(1).from),
    });
    controller.fold();
    expect(controller.folds).toEqual([{ from: 1, to: 3 }]);
    controller.unfold();
    expect(controller.folds).toEqual([]);
  });
});

describe('folded visible-row interaction and presentation', () => {
  // Keyboard and mouse coordinates must skip hidden logical rows instead of reaching invisible text.
  it('should navigate and place the caret through the shared visible-row mapping', () => {
    const { controller, document, editor } = nestedEditor();
    const [outer] = structuralRanges(controller);
    controller.setLanguageResult(languageResult(document.identity, [outer]));
    document.setSelection({ anchor: 0, head: 0 });
    editor.execute('fold.toggle');

    editor.routeKey({ key: 'ArrowDown' });
    expect(Number(document.selection.head)).toBe(Number(document.snapshot.line(5).from));

    editor.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 32, height: 4 } });
    const root = new Group();
    root.add(editor);
    const loop = createEventLoop({ width: 32, height: 4 }, { caps: unicodeCaps });
    loop.mount(root);
    loop.focusView(editor);
    loop.dispatch(mouse('down', 8, 1));
    expect(Number(document.selection.head)).toBeGreaterThanOrEqual(Number(document.snapshot.line(5).from));
  });

  // Expanded/collapsed state remains perceivable without color and has an ASCII fallback; clicking
  // the marker uses the same toggle command as the keyboard.
  it('should expose clickable Unicode and ASCII fold markers in a usable line-number gutter', () => {
    const { controller, document, editor } = nestedEditor();
    const [outer] = structuralRanges(controller);
    controller.setLanguageResult(languageResult(document.identity, [outer]));

    const unicodeExpanded = editor.project({ width: 32, height: 4, caps: unicodeCaps });
    const asciiExpanded = editor.project({ width: 32, height: 4, caps: asciiCaps });
    expect(unicodeExpanded.cells[0]?.map((cell) => cell.text).join('')).toContain('▼');
    expect(asciiExpanded.cells[0]?.map((cell) => cell.text).join('')).toContain('v');

    editor.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 32, height: 4 } });
    const root = new Group();
    root.add(editor);
    const loop = createEventLoop({ width: 32, height: 4 }, { caps: unicodeCaps });
    loop.mount(root);
    loop.focusView(editor);
    loop.dispatch(mouse('down', 2, 0));
    expect(controller.folds).toEqual([{ from: 0, to: 4 }]);
    expect(
      editor
        .project({ width: 32, height: 4, caps: unicodeCaps })
        .cells[0]?.map((cell) => cell.text)
        .join(''),
    ).toContain('▶');
    expect(
      editor
        .project({ width: 32, height: 4, caps: asciiCaps })
        .cells[0]?.map((cell) => cell.text)
        .join(''),
    ).toContain('>');
  });

  // Hostile fold input and repeated toggles stay bounded and never expose terminal controls.
  it('should stay terminal-safe and bounded under hostile ranges and repeated fold cycles', () => {
    const { controller, document, editor } = nestedEditor();
    const [outer] = structuralRanges(controller);
    controller.setLanguageResult(
      languageResult(document.identity, [
        outer,
        { from: Number.NaN, to: Number.POSITIVE_INFINITY },
        { from: 0, to: Number.MAX_SAFE_INTEGER },
      ]),
    );

    for (let cycle = 0; cycle < 100; cycle += 1) editor.execute('fold.toggle');
    const frame = editor.project({ width: 12, height: 3, caps: asciiCaps });
    expect(controller.folds.length).toBeLessThanOrEqual(controller.limits.folds);
    expect(frame.cells).toHaveLength(3);
    expect(frame.cells.flat()).toHaveLength(36);
    expect(frame.cells.flat().every((cell) => !/[\u0000-\u001f\u007f]/u.test(cell.text))).toBe(true);
    expect(document.text).toBe(SOURCE);
  });
});
