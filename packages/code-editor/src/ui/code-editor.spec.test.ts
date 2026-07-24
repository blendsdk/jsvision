import { defaultTheme, resolveCapabilities } from '@jsvision/core';
import { describe, expect, it, vi } from 'vitest';

import { createDocumentModel } from '../document/model.js';
import { CodeEditor } from './code-editor.js';
import { CodeEditorWindow } from './code-editor-window.js';
import { createCodeEditorController } from '../controller.js';
import { projectCodeEditor } from './projection.js';
import { resolveCodeEditorTheme } from '../theme/resolve.js';
import { classicCodeEditorTheme, darkCodeEditorTheme, lightCodeEditorTheme } from '../theme/presets.js';

const colorCaps = resolveCapabilities({
  override: { colorDepth: 'truecolor', unicode: { utf8: true }, glyphs: { boxDrawing: true } },
}).profile;
const asciiCaps = resolveCapabilities({
  override: { colorDepth: 'mono', unicode: { utf8: false }, glyphs: { boxDrawing: false } },
}).profile;

function createController(text = 'const value = 1;\nreturn value;') {
  return createCodeEditorController({
    document: createDocumentModel({
      text,
      uri: 'file:///fixture.ts',
      languageId: 'typescript',
      tabSize: 4,
    }),
  });
}

function stableState(controller: ReturnType<typeof createController>) {
  return {
    text: controller.document.text,
    selection: controller.document.selection,
    revision: controller.document.snapshot.revision,
    undoDepth: controller.document.undoDepth,
    redoDepth: controller.document.redoDepth,
    folds: controller.folds,
    parserRuns: controller.metrics.parserRuns,
    lspRequests: controller.metrics.lspRequests,
    assistanceRequests: controller.metrics.assistanceRequests,
  };
}

describe('ST-32 CodeEditor composition', () => {
  it('keeps direct and window-hosted editors on the same document while the window adds standard chrome', () => {
    const directController = createController();
    const windowController = createController();
    const direct = new CodeEditor({ controller: directController });
    const window = new CodeEditorWindow({ controller: windowController });

    direct.execute('cursor.documentEnd');
    direct.insertText('\nexport { value };');
    window.editor.execute('cursor.documentEnd');
    window.editor.insertText('\nexport { value };');

    expect(stableState(directController)).toEqual(stableState(windowController));
    expect(window.editor.behavior).toEqual(direct.behavior);
    expect(direct.chrome).toEqual({ horizontalScrollBar: false, verticalScrollBar: false, statusLine: false });
    expect(window.chrome).toEqual({ horizontalScrollBar: true, verticalScrollBar: true, statusLine: true });
    expect(window.status).toMatchObject({ language: 'typescript', line: 3, column: 18 });
  });
});

describe('ST-33 deterministic input routing', () => {
  it('routes dismissal, completion, snippets, editor bindings, and text in order with replaceable bindings', () => {
    const controller = createController('pri');
    const editor = new CodeEditor({
      controller,
      keyBindings: { 'Ctrl+J': 'cursor.documentEnd' },
    });

    editor.openCompletion([{ label: 'print', insertText: 'print()' }]);
    editor.openModal({ kind: 'search' });
    expect(editor.routeKey({ key: 'Escape' })).toEqual({ handled: true, owner: 'dismissal' });
    expect(editor.routeKey({ key: 'Enter' })).toEqual({ handled: true, owner: 'completion' });
    expect(controller.document.text).toBe('print()');

    editor.startSnippet([
      { from: 6, to: 6 },
      { from: 0, to: 5 },
    ]);
    expect(editor.routeKey({ key: 'Tab' })).toEqual({ handled: true, owner: 'snippet' });
    expect(editor.routeKey({ key: 'Ctrl+J' })).toEqual({ handled: true, owner: 'editor' });
    expect(editor.routeKey({ key: 'x', text: 'x' })).toEqual({ handled: true, owner: 'text' });
    expect(controller.document.text.endsWith('x')).toBe(true);
  });
});

describe('ST-34 cell projection precedence', () => {
  it('resolves every overlapping role deterministically and keeps the caret visible', () => {
    const controller = createController('value');
    controller.document.setSelection({ anchor: 0, head: 5 });

    const frame = projectCodeEditor({
      controller,
      width: 12,
      height: 3,
      caps: colorCaps,
      syntax: [{ from: 0, to: 5, category: 'variable' }],
      diagnostics: [{ from: 0, to: 5, severity: 'error' }],
      search: [{ from: 0, to: 5 }],
      bracket: { from: 0, to: 1 },
      snippet: [{ from: 0, to: 5, active: true }],
      activeLine: 0,
      caret: 0,
    });

    expect(frame.precedence).toEqual([
      'caret',
      'selection',
      'diagnostic',
      'snippet',
      'bracket',
      'search',
      'syntax',
      'activeLine',
      'base',
    ]);
    expect(frame.cellAtDocumentOffset(0)).toMatchObject({
      text: 'v',
      role: 'selection',
      overlays: ['diagnostic.error', 'snippet.active', 'bracket', 'search'],
    });
    expect(frame.caret).toMatchObject({ visible: true, x: 0, y: 0 });
  });
});

describe('ST-35 hybrid editor themes', () => {
  it('switches app-derived, override, independent, light, dark, and classic presentation without semantic work', () => {
    const controller = createController();
    const editor = new CodeEditor({ controller });
    const before = stableState(controller);
    const appDerived = resolveCodeEditorTheme(
      { kind: 'application' },
      { applicationTheme: defaultTheme, caps: colorCaps },
    );
    const overridden = resolveCodeEditorTheme(
      { kind: 'application', overrides: { syntax: { keyword: { foreground: '#ff00ff' } } } },
      { applicationTheme: defaultTheme, caps: colorCaps },
    );
    const independent = resolveCodeEditorTheme(
      {
        kind: 'independent',
        base: darkCodeEditorTheme,
        overrides: { structure: { gutter: { foreground: '#999999' } } },
      },
      { applicationTheme: defaultTheme, caps: colorCaps },
    );

    const signatures = [
      appDerived,
      overridden,
      independent,
      lightCodeEditorTheme,
      darkCodeEditorTheme,
      classicCodeEditorTheme,
    ].map((theme) => {
      editor.setTheme(theme);
      return editor.project({ width: 24, height: 4, caps: colorCaps }).cellSignature;
    });

    expect(new Set(signatures).size).toBe(6);
    expect(stableState(controller)).toEqual(before);
  });
});

describe('ST-36 hostile theme resolution', () => {
  it('rejects accessors and prototypes, bounds depth, and reports deterministic contrast repair', () => {
    const getter = vi.fn(() => {
      throw new Error('must not execute');
    });
    const accessor = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(accessor, 'syntax', { enumerable: true, get: getter });
    const inherited = Object.create({ syntax: { keyword: { foreground: '#ff0000' } } });
    const deep = { value: {} } as { value: Record<string, unknown> };
    let cursor = deep.value;
    for (let index = 0; index < 40; index += 1) {
      cursor.next = {};
      cursor = cursor.next as Record<string, unknown>;
    }

    const resolved = resolveCodeEditorTheme(
      {
        kind: 'application',
        overrides: {
          surfaces: { editor: { foreground: '#777777', background: '#777777' } },
          unsafeAccessor: accessor,
          unsafePrototype: inherited,
          excessiveDepth: deep,
        },
      },
      { applicationTheme: defaultTheme, caps: colorCaps },
    );

    expect(getter).not.toHaveBeenCalled();
    expect(resolved.contractVersion).toBe(1);
    expect(resolved.report.rejected).toEqual(['excessiveDepth', 'unsafeAccessor', 'unsafePrototype']);
    expect(resolved.report.adjustments).toContainEqual({
      path: 'surfaces.editor',
      reason: 'minimum-contrast',
    });
    expect(resolved.theme.syntax).toHaveProperty('keyword');
    expect(resolved.theme.diagnostics).toHaveProperty('error');
  });
});

describe('ST-37 constrained terminal projection', () => {
  it('keeps actions, overlays, and caret in bounds across capability, width, resize, tab, and grapheme cases', () => {
    const controller = createController('\tA\u0301界()\nnext');
    controller.document.setSelection({ anchor: 3, head: 3 });
    const editor = new CodeEditor({ controller });

    for (const scenario of [
      { width: 8, height: 2, caps: colorCaps },
      { width: 5, height: 2, caps: asciiCaps },
      { width: 3, height: 1, caps: asciiCaps },
      { width: 10, height: 3, caps: colorCaps },
    ]) {
      const frame = editor.project(scenario);
      expect(frame.actions).toEqual(expect.arrayContaining(['edit', 'search', 'save', 'close']));
      expect(frame.caret.x).toBeGreaterThanOrEqual(0);
      expect(frame.caret.x).toBeLessThan(scenario.width);
      expect(frame.caret.y).toBeGreaterThanOrEqual(0);
      expect(frame.caret.y).toBeLessThan(scenario.height);
      expect(frame.cells.flat()).toHaveLength(scenario.width * scenario.height);
      expect(frame.cells.flat().every((cell) => cell.width === 1)).toBe(true);
    }
  });
});

describe('ST-38 keyboard-only workflow', () => {
  it('completes edit, search, fold, assist, navigate, format, save, and close with no mouse or focus trap', async () => {
    const events: string[] = [];
    const controller = createCodeEditorController({
      document: createDocumentModel({
        text: 'const value=1;\n',
        uri: 'file:///journey.ts',
        languageId: 'typescript',
      }),
      host: async (effect) => {
        events.push(effect.kind);
        return true;
      },
    });
    const editor = new CodeEditor({ controller });

    expect(editor.focus()).toBe(true);
    editor.routeKey({ key: 'End' });
    editor.routeKey({ key: 'x', text: 'x' });
    editor.routeKey({ key: 'f', ctrl: true });
    editor.setSearchQuery('value');
    editor.routeKey({ key: 'Enter' });
    editor.routeKey({ key: '[', ctrl: true });
    editor.routeKey({ key: ' ', ctrl: true });
    editor.routeKey({ key: 'F12' });
    editor.routeKey({ key: 'F', shift: true, alt: true });
    editor.routeKey({ key: 's', ctrl: true });
    editor.routeKey({ key: 'w', ctrl: true });
    await editor.whenIdle();

    expect(editor.journey).toEqual([
      'focus',
      'edit',
      'search.open',
      'search.next',
      'fold.toggle',
      'assist',
      'navigate',
      'format',
      'save',
      'close',
    ]);
    expect(events).toEqual(['navigate', 'save', 'close']);
    expect(editor.focusState).toBe('released');
  });
});
