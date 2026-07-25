import { defaultTheme, nordTheme, resolveCapabilities } from '@jsvision/core';
import { createRenderRoot } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';
import { createCodeEditorController } from '../controller.js';
import { createDocumentModel } from '../document/model.js';
import { CodeEditor } from '../ui/code-editor.js';
import { darkCodeEditorTheme } from './presets.js';
import { resolveCodeEditorTheme } from './resolve.js';

const colorCaps = resolveCapabilities({
  override: { colorDepth: 'truecolor', unicode: { utf8: true } },
}).profile;
const monoCaps = resolveCapabilities({ override: { colorDepth: 'mono' } }).profile;

describe('CodeEditor theme implementation', () => {
  it('does not invoke accessors across a bounded hostile-input corpus', () => {
    for (let index = 0; index < 64; index += 1) {
      const getter = vi.fn();
      const value = Object.create(null) as Record<string, unknown>;
      Object.defineProperty(value, `bad-${index}`, { enumerable: true, get: getter });
      const result = resolveCodeEditorTheme(
        { kind: 'application', overrides: { syntax: value } },
        { applicationTheme: defaultTheme, caps: colorCaps },
      );
      expect(getter).not.toHaveBeenCalled();
      expect(result.theme.contractVersion).toBe(1);
    }
  });

  it('repairs equal foreground/background and reports the exact semantic path', () => {
    const result = resolveCodeEditorTheme(
      {
        kind: 'independent',
        base: darkCodeEditorTheme,
        overrides: { surfaces: { editor: { foreground: '#222222', background: '#222222' } } },
      },
      { applicationTheme: defaultTheme, caps: colorCaps },
    );

    expect(result.theme.surfaces.editor.foreground).not.toBe(result.theme.surfaces.editor.background);
    expect(result.report.adjustments).toContainEqual({
      path: 'surfaces.editor',
      reason: 'minimum-contrast',
    });
  });

  it('downsamples every semantic section deterministically for monochrome terminals', () => {
    const first = resolveCodeEditorTheme(
      { kind: 'independent', base: darkCodeEditorTheme },
      { applicationTheme: defaultTheme, caps: monoCaps },
    );
    const second = resolveCodeEditorTheme(
      { kind: 'independent', base: darkCodeEditorTheme },
      { applicationTheme: defaultTheme, caps: monoCaps },
    );

    expect(first).toEqual(second);
    expect(first.report.adjustments).toContainEqual({ path: '*', reason: 'capability-fallback' });
    expect(first.theme.syntax.keyword).toMatchObject({ foreground: 'default', background: 'default' });
  });

  it('deeply snapshots caller styles and rejects terminal-control colors', () => {
    const mutable = structuredClone(darkCodeEditorTheme) as typeof darkCodeEditorTheme;
    const result = resolveCodeEditorTheme(
      {
        kind: 'independent',
        base: mutable,
        overrides: { syntax: { keyword: { foreground: '\u001b[31m' } } },
      },
      { applicationTheme: defaultTheme, caps: colorCaps },
    );
    const before = result.theme.syntax.keyword.foreground;
    (mutable.syntax.keyword as { foreground: string }).foreground = '#ffffff';
    expect(result.theme.syntax.keyword.foreground).toBe(before);
    expect(result.theme.syntax.keyword.foreground).not.toContain('\u001b');
    expect(Object.isFrozen(result.theme.syntax.keyword)).toBe(true);
  });

  it('ignores excessive unknown override width without traversing or retaining caller data', () => {
    const excessive = Object.fromEntries(
      Array.from({ length: 100_000 }, (_, index) => [`role-${index}`, { foreground: '#ffffff' }]),
    );
    let nested: unknown = '#ffffff';
    for (let depth = 0; depth < 12; depth += 1) nested = { nested };

    const startedAt = performance.now();
    const result = resolveCodeEditorTheme(
      {
        kind: 'application',
        applicationOverrides: { syntax: excessive },
        overrides: { structure: { lineNumber: nested } },
      },
      { applicationTheme: defaultTheme, caps: colorCaps },
    );

    expect(performance.now() - startedAt).toBeLessThan(16);
    expect(result.report.rejected).toEqual([]);
    expect(result.theme.contractVersion).toBe(1);
  });

  it('contains nested proxy traps and rejects forged resolution evidence', () => {
    const getPrototypeOf = vi.fn(() => {
      throw new Error('hostile prototype');
    });
    const hostileSection = new Proxy(Object.create(null), { getPrototypeOf });
    const resolved = resolveCodeEditorTheme(
      { kind: 'application', overrides: { syntax: hostileSection } },
      { applicationTheme: defaultTheme, caps: colorCaps },
    );
    expect(resolved.report.rejected).toContain('overrides.syntax');

    const editor = new CodeEditor({
      controller: createCodeEditorController({ document: createDocumentModel({ text: 'safe' }) }),
    });
    Reflect.apply(editor.setTheme, editor, [
      {
        theme: darkCodeEditorTheme,
        report: {
          activeLayer: 'safe-default',
          fallbackSource: 'forged',
          rejected: [],
          adjustments: [],
        },
      },
    ]);
    expect(editor.themeInspection).toMatchObject({ activeLayer: 'independent', fallbackSource: 'dark' });

    const genuine = resolveCodeEditorTheme(
      { kind: 'application' },
      { applicationTheme: defaultTheme, caps: colorCaps },
    );
    editor.setTheme({
      contractVersion: 1,
      theme: darkCodeEditorTheme,
      report: genuine.report,
    });
    expect(editor.themeInspection).toMatchObject({ activeLayer: 'independent', fallbackSource: 'dark' });
  });

  it('snapshots a live source so later caller mutation cannot alter a repaint', () => {
    const overrides = { syntax: { keyword: { foreground: '#ff00ff' } } };
    const editor = new CodeEditor({
      controller: createCodeEditorController({
        document: createDocumentModel({ text: 'const value = 1;', languageId: 'typescript' }),
      }),
      themeSource: { kind: 'application', overrides },
    });
    const root = createRenderRoot({ width: 30, height: 4 }, { caps: colorCaps, theme: defaultTheme });
    root.mount(editor);
    root.flush();
    const before = editor.project({ width: 30, height: 4, caps: colorCaps }).cellSignature;

    overrides.syntax.keyword.foreground = '#00ff00';
    root.setTheme(nordTheme);
    root.flush();

    expect(editor.themeInspection.activeLayer).toBe('editor');
    expect(editor.project({ width: 30, height: 4, caps: colorCaps }).cellSignature).not.toBe(before);
    expect(editor.themeInspection.rejected).toEqual([]);
  });

  it('uses the render root coalescing seam for rapid editor and application theme changes', () => {
    const scheduled: (() => void)[] = [];
    const editor = new CodeEditor({
      controller: createCodeEditorController({
        document: createDocumentModel({ text: 'const value = 1;', languageId: 'typescript' }),
      }),
      themeSource: { kind: 'application' },
    });
    const root = createRenderRoot(
      { width: 30, height: 4 },
      { caps: colorCaps, theme: defaultTheme, schedule: (flush) => scheduled.push(flush) },
    );
    root.mount(editor);
    root.flush();
    scheduled.splice(0);

    editor.setThemeSource({ kind: 'application', overrides: { syntax: { keyword: { attrs: 1 } } } });
    editor.setThemeSource({ kind: 'application', overrides: { syntax: { keyword: { attrs: 2 } } } });
    root.setTheme(nordTheme);

    expect(scheduled).toHaveLength(1);
    root.flush();
    expect(editor.themeInspection).toMatchObject({
      activeLayer: 'editor',
      fallbackSource: 'application-derived',
    });
    expect(editor.controller.metrics).toMatchObject({ parserRuns: 0, lspRequests: 0 });
  });
});
