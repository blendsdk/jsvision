import { defaultTheme, resolveCapabilities } from '@jsvision/core';
import { describe, expect, it } from 'vitest';

import {
  classicCodeEditorTheme,
  CodeEditor,
  createCodeEditorController,
  createDocumentModel,
  darkCodeEditorTheme,
  lightCodeEditorTheme,
  resolveCodeEditorTheme,
} from '../index.js';

const trueColorCaps = resolveCapabilities({
  override: { colorDepth: 'truecolor', unicode: { utf8: true }, glyphs: { boxDrawing: true } },
}).profile;

const monochromeAsciiCaps = resolveCapabilities({
  override: { colorDepth: 'mono', unicode: { utf8: false }, glyphs: { boxDrawing: false } },
}).profile;

const ansiCaps = resolveCapabilities({
  override: { colorDepth: '16', unicode: { utf8: true }, glyphs: { boxDrawing: true } },
}).profile;

/** Creates an editor with non-default semantic and viewport state to detect theme-update side effects. */
function createStatefulEditor() {
  const longLine = `const alpha = "${'0123456789'.repeat(8)}";`;
  const document = createDocumentModel({
    text: [longLine, ...Array.from({ length: 18 }, (_, index) => `const value${index} = alpha + ${index};`)].join('\n'),
    uri: 'file:///workspace/theme.ts',
    languageId: 'typescript',
  });
  const controller = createCodeEditorController({ document });
  const editor = new CodeEditor({ controller });
  editor.execute('cursor.documentEnd');
  editor.insertText('\nexport { beta };');
  const visibleSelection = Number(document.snapshot.line(3).from) + 10;
  document.setSelection({ anchor: visibleSelection, head: visibleSelection });
  editor.project({ width: 20, height: 4, caps: trueColorCaps });
  editor.scroll.x.set(3);
  editor.scroll.y.set(2);
  return { controller, editor };
}

/** Captures state that a presentation-only theme update must never mutate. */
function semanticState(controller: ReturnType<typeof createCodeEditorController>, editor: CodeEditor) {
  return {
    text: controller.document.text,
    revision: controller.document.snapshot.revision,
    selection: controller.document.selection,
    undoDepth: controller.document.undoDepth,
    redoDepth: controller.document.redoDepth,
    folds: controller.folds,
    parserRuns: controller.metrics.parserRuns,
    lspRequests: controller.metrics.lspRequests,
    scrollX: editor.scroll.x(),
    scrollY: editor.scroll.y(),
  };
}

describe('live hybrid code-editor themes', () => {
  it('should apply editor fields over application fields over derived fields using role-level deep merge', () => {
    // Theme resolution must preserve unspecified role fields at every precedence layer.
    const source = {
      kind: 'application' as const,
      applicationOverrides: {
        syntax: { keyword: { foreground: '#00aa00' } },
        structure: { lineNumber: { foreground: '#111111' } },
      },
      overrides: {
        syntax: { keyword: { foreground: '#ff00ff' } },
      },
    };

    const resolved = resolveCodeEditorTheme(source, {
      applicationTheme: defaultTheme,
      caps: trueColorCaps,
    });
    const derived = resolveCodeEditorTheme(
      { kind: 'application' },
      {
        applicationTheme: defaultTheme,
        caps: trueColorCaps,
      },
    );

    expect(resolved.theme.syntax.keyword.foreground).toBe('#ff00ff');
    expect(resolved.theme.structure.lineNumber.foreground).not.toBe('#111111');
    expect(resolved.theme.structure.lineNumber.background).toBe(derived.theme.structure.lineNumber.background);
    expect(resolved.theme.syntax.keyword.background).toBeDefined();
    expect(resolved.report.adjustments).toContainEqual({
      path: 'structure.lineNumber',
      reason: 'minimum-contrast',
    });
    expect(resolved.report).toMatchObject({
      activeLayer: 'editor',
      fallbackSource: 'application-derived',
    });
  });

  it('should repaint application-derived, light, dark, and classic palettes without losing editor state', () => {
    // A live palette change is presentation-only even after edits and scrolling.
    const { controller, editor } = createStatefulEditor();
    const before = semanticState(controller, editor);
    const applicationDerived = resolveCodeEditorTheme(
      { kind: 'application' },
      { applicationTheme: defaultTheme, caps: trueColorCaps },
    );

    const signatures = [applicationDerived, lightCodeEditorTheme, darkCodeEditorTheme, classicCodeEditorTheme].map(
      (theme) => {
        editor.setTheme(theme);
        return editor.project({ width: 32, height: 5, caps: trueColorCaps }).cellSignature;
      },
    );

    expect(new Set(signatures).size).toBe(4);
    expect(semanticState(controller, editor)).toEqual(before);
  });

  it('should coalesce repeated theme-only updates while preserving semantic subsystem state', async () => {
    // Multiple live updates in one turn may repaint once, but may not start parser or language-service work.
    const { controller, editor } = createStatefulEditor();
    const before = semanticState(controller, editor);

    editor.setTheme(lightCodeEditorTheme);
    editor.setTheme(darkCodeEditorTheme);
    editor.setTheme(classicCodeEditorTheme);
    await Promise.resolve();

    expect(editor.project({ width: 32, height: 5, caps: trueColorCaps }).cellSignature).toBe(
      editor.project({ width: 32, height: 5, caps: trueColorCaps }).cellSignature,
    );
    expect(semanticState(controller, editor)).toEqual(before);
  });

  it('should keep the last valid palette when a hostile live override is rejected', () => {
    // Invalid live input must not blank the editor, mutate source state, or execute accessors.
    const { controller, editor } = createStatefulEditor();
    editor.setTheme(lightCodeEditorTheme);
    const beforeState = semanticState(controller, editor);
    const beforeFrame = editor.project({ width: 32, height: 5, caps: trueColorCaps }).cellSignature;
    let getterCalls = 0;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, 'syntax', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return { keyword: { foreground: '\u001b[31m' } };
      },
    });

    Reflect.apply(editor.setTheme, editor, [hostile]);

    expect(getterCalls).toBe(0);
    expect(editor.project({ width: 32, height: 5, caps: trueColorCaps }).cellSignature).toBe(beforeFrame);
    expect(semanticState(controller, editor)).toEqual(beforeState);
    expect(Reflect.get(editor, 'themeInspection')).toMatchObject({
      activeLayer: 'last-valid',
      fallbackSource: 'light',
    });

    const hostileName = { ...darkCodeEditorTheme, name: '\u001b[2Jstolen source' };
    const named = resolveCodeEditorTheme(
      { kind: 'independent', base: hostileName },
      { applicationTheme: defaultTheme, caps: trueColorCaps },
    );
    expect(JSON.stringify(named)).not.toContain('\u001b');
    expect(named.report.rejected).toContain('name');
  });

  it('should adapt monochrome and ASCII presentation without relying on color alone', () => {
    // Reduced terminal capabilities must remain inspectable and preserve semantic distinctions.
    const resolved = resolveCodeEditorTheme(
      { kind: 'independent', base: darkCodeEditorTheme },
      { applicationTheme: defaultTheme, caps: monochromeAsciiCaps },
    );

    expect(resolved.report.adjustments).toContainEqual(expect.objectContaining({ reason: 'capability-fallback' }));
    expect(resolved.report).toMatchObject({
      activeLayer: 'independent',
      fallbackSource: 'dark',
    });
    expect(resolved.theme.surfaces.selection.attrs).toBeDefined();
    expect(resolved.theme.diagnostics.error.attrs).toBeDefined();
    expect(resolved.theme.structure.search.attrs).toBeDefined();

    const ansi = resolveCodeEditorTheme(
      { kind: 'independent', base: darkCodeEditorTheme },
      { applicationTheme: defaultTheme, caps: ansiCaps },
    );
    expect(ansi.report.adjustments).toContainEqual(expect.objectContaining({ reason: 'capability-fallback' }));
    expect(JSON.stringify(ansi.theme)).not.toContain('#');
  });
});
