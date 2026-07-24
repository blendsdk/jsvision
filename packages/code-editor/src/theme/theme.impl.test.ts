import { defaultTheme, resolveCapabilities } from '@jsvision/core';
import { describe, expect, it, vi } from 'vitest';
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
});
