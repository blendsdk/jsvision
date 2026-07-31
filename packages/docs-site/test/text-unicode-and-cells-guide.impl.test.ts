/**
 * Implementation hardening for the Text, Unicode & terminal cells laboratories.
 *
 * The immutable course oracle owns learner-visible outcomes. These checks stress repeated state
 * transitions, narrow-cell edges, orphan repair, monochrome capability, geometry, and teardown.
 */
import { existsSync, readFileSync } from 'node:fs';
import { ScreenBuffer, monochromeTheme, resolveCapabilities, serialize } from '@jsvision/core';
import { Button, Group, Text, View, createRoot, stringWidth, wrapText } from '@jsvision/ui';
import { describe, expect, test, vi } from 'vitest';
import cellWidthExample from '../examples/guides/cell-width.js';
import glyphFallbackExample from '../examples/guides/glyph-fallback.js';
import type { ExampleDefinition } from '../examples/_contract.js';
import { demoShell } from '../src/demo-shell.js';
import { CellWidthPanel } from '../src/example-fixtures/text-unicode-and-cells/cell-width-panel.js';
import { GlyphFallbackPanel } from '../src/example-fixtures/text-unicode-and-cells/glyph-fallback-panel.js';
import {
  EXAMPLE_VIEWPORT,
  absoluteOrigin,
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  key,
  viewsIn,
} from './example-lab-harness.js';

const STYLE = { fg: 'default' as const, bg: 'default' as const };
const COURSE_SOURCE = readFileSync(new URL('../guide/text-unicode-and-cells.md', import.meta.url), 'utf8');
const COMPLETE_COPY = {
  'guides/cell-width': [
    'Code units, code points, graphemes, and cells are different.',
    'Alt+N sample · Alt+W width · Alt+G ZWJ · click · resize',
  ],
  'guides/glyph-fallback': [
    'Capabilities selectively degrade Unicode chrome.',
    'Alt+P profile · Alt+U UTF-8 · click · READY stays visible',
  ],
} as const;

/** Return the one fixture panel of the requested class from a mounted laboratory. */
function panelIn<T extends View>(dialog: View, type: abstract new (...args: never[]) => T): T {
  const panel = viewsIn(dialog).find((view): view is T => view instanceof type);
  if (panel === undefined) throw new Error(`laboratory is missing ${type.name}`);
  return panel;
}

/** Resize through the real south-east grip rather than assigning dialog geometry. */
function resizeDialog(app: ReturnType<typeof buildLabExample>['app'], dialog: View): void {
  const origin = absoluteOrigin(dialog);
  const from = {
    x: origin.x + dialog.bounds.width - 1,
    y: origin.y + dialog.bounds.height - 1,
  };
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'drag',
    at: from,
    to: { x: from.x + 10, y: from.y + 4 },
  });
}

/** Activate a named laboratory button through the real pointer event route. */
function clickButton(app: ReturnType<typeof buildLabExample>['app'], dialog: View, label: string): void {
  const button = viewsIn(dialog)
    .filter((view): view is Button => view instanceof Button)
    .find((candidate) => candidate.activation.label === label);
  if (button === undefined) throw new Error(`laboratory is missing the ${label} button`);
  const rows = app.loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''));
  const y = rows.findIndex((row) => row.includes(label));
  const x = y < 0 ? -1 : (rows[y]?.indexOf(label) ?? -1);
  if (x < 0 || y < 0) throw new Error(`laboratory did not render the ${label} button`);
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'click',
    at: { x, y },
  });
}

/** Assert both deliberately single-row teaching strings remain completely visible. */
function expectCompleteCopy(app: ReturnType<typeof buildLabExample>['app'], id: keyof typeof COMPLETE_COPY): void {
  const text = frameText(app);
  for (const line of COMPLETE_COPY[id]) expect(text).toContain(line);
}

/** Assert a view remains fully contained by its immediate parent. */
function expectContained(view: View): void {
  const parent = view.parent;
  if (parent === null) return;
  expect(view.bounds.x).toBeGreaterThanOrEqual(0);
  expect(view.bounds.y).toBeGreaterThanOrEqual(0);
  expect(view.bounds.x + view.bounds.width).toBeLessThanOrEqual(parent.bounds.width);
  expect(view.bounds.y + view.bounds.height).toBeLessThanOrEqual(parent.bounds.height);
}

/** Build a live example with monochrome terminal capabilities and a monochrome semantic theme. */
function buildMonochrome(definition: ExampleDefinition) {
  const caps = resolveCapabilities({
    env: {},
    platform: 'linux',
    override: { colorDepth: 'mono', unicode: { utf8: false } },
  }).profile;
  const app = demoShell({
    build: (ctx) => definition.build(ctx),
    title: definition.title,
    kind: 'app',
    caps,
    viewport: EXAMPLE_VIEWPORT,
  });
  app.setTheme(monochromeTheme);
  app.loop.resize(EXAMPLE_VIEWPORT);
  return app;
}

describe('cell-width fixture edges', () => {
  test('should cycle every bounded wrap width and return to the authored state', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/cell-width', cellWidthExample);
      const panel = panelIn(dialog, CellWidthPanel);

      expect(panel.wrapWidth).toBe(12);
      for (const width of [8, 4, 1, 12]) {
        app.loop.dispatch(key('w', { alt: true }));
        expect(panel.wrapWidth).toBe(width);
        expect(frameText(app)).toContain(`Wrap width: ${width} cells`);
      }

      app.loop.dispose();
      dispose();
    });
  });

  test('should expose whole wide glyphs even when a one-cell wrap cannot contain them', () => {
    expect(wrapText('界😀', 1)).toEqual(['界', '😀']);
    for (const line of wrapText('界😀', 1)) {
      expect(stringWidth(line)).toBe(2);
      expect([...line]).toHaveLength(1);
    }
  });

  test('should retain combining marks with a base and drop a leading orphan', () => {
    const buffer = new ScreenBuffer(5, 1, STYLE);
    buffer.text(0, 0, '\u0301e\u0301x', STYLE);

    expect(buffer.get(0, 0)).toMatchObject({ char: 'e\u0301', width: 1 });
    expect(buffer.get(1, 0)).toMatchObject({ char: 'x', width: 1 });
    expect(buffer.text(2, 0, '\u0301', STYLE)).toBe(2);
    expect(buffer.get(2, 0)).toMatchObject({ char: ' ', width: 1 });
  });

  test.each([
    ['n', 'Next sample'],
    ['w', 'Cycle width'],
    ['g', 'Show grapheme limit'],
  ] as const)('should report keyboard and mouse sources for the %s action', (hotkey, label) => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/cell-width', cellWidthExample);

      app.loop.dispatch(key(hotkey, { alt: true }));
      expect(frameText(app)).toMatch(/Action source:\s*keyboard/iu);
      clickButton(app, dialog, label);
      expect(frameText(app)).toMatch(/Action source:\s*mouse/iu);

      app.loop.dispose();
      dispose();
    });
  });

  test('should repair both halves when a wide glyph is overwritten', () => {
    const overwriteLead = new ScreenBuffer(4, 1, STYLE);
    overwriteLead.set(0, 0, '界', STYLE);
    overwriteLead.set(0, 0, 'A', STYLE);
    expect(overwriteLead.get(0, 0)).toMatchObject({ char: 'A', width: 1 });
    expect(overwriteLead.get(1, 0)).toMatchObject({ char: ' ', width: 1 });

    const overwriteContinuation = new ScreenBuffer(4, 1, STYLE);
    overwriteContinuation.set(0, 0, '界', STYLE);
    overwriteContinuation.set(1, 0, 'B', STYLE);
    expect(overwriteContinuation.get(0, 0)).toMatchObject({ char: ' ', width: 1 });
    expect(overwriteContinuation.get(1, 0)).toMatchObject({ char: 'B', width: 1 });
  });
});

describe('glyph-fallback fixture edges', () => {
  test('should reset UTF-8 availability when the learner selects another profile', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/glyph-fallback', glyphFallbackExample);
      const panel = panelIn(dialog, GlyphFallbackPanel);

      app.loop.dispatch(key('u', { alt: true }));
      expect(frameText(app)).toMatch(/UTF-8:\s*no[\s\S]*Text:\s*\?/u);
      app.loop.dispatch(key('p', { alt: true }));
      expect(panel.profileName).toBe('Adapted chrome');
      expect(frameText(app)).toMatch(/UTF-8:\s*yes[\s\S]*Text:\s*é/u);

      app.loop.dispose();
      dispose();
    });
  });

  test('should preserve a two-cell footprint when a wide glyph serializes as ASCII', () => {
    const buffer = new ScreenBuffer(4, 1, STYLE);
    buffer.set(0, 0, '界', STYLE);
    buffer.set(2, 0, 'X', STYLE);
    const caps = resolveCapabilities({
      env: {},
      platform: 'linux',
      override: { unicode: { utf8: false } },
    }).profile;
    const output = serialize(buffer, null, { caps });

    expect(output).toContain('? ');
    expect(output).toContain('X');
  });

  test('should expose the decomposed-cell limit when UTF-8 serialization is disabled', () => {
    const buffer = new ScreenBuffer(4, 1, STYLE);
    buffer.text(0, 0, 'e\u0301', STYLE);
    const caps = resolveCapabilities({
      env: {},
      platform: 'linux',
      override: { unicode: { utf8: false } },
    }).profile;
    const output = serialize(buffer, null, { caps });

    expect(output).toContain('\u0301');
    expect(COURSE_SOURCE).toMatch(/leading code point[\s\S]*decomposed[\s\S]*combining suffix/iu);
    expect(COURSE_SOURCE).toMatch(/pure ASCII[\s\S]*(?:transliterat|ASCII wording)/iu);
  });

  test('should keep the fallback comparison table well formed', () => {
    expect(COURSE_SOURCE).toContain(
      '| `boxDrawing: false`          | `┌ ─ │`                       | plus, hyphen, and vertical bar |',
    );
  });

  test('should link only to Guide routes that have real pages', () => {
    const guideLinks = [...COURSE_SOURCE.matchAll(/\]\(\/guide\/([^/)#]+)(?:#[^)]+)?\)/gu)].map(([, slug]) => slug);

    for (const slug of guideLinks) {
      expect(existsSync(new URL(`../guide/${slug}.md`, import.meta.url)), `/guide/${slug} must resolve`).toBe(true);
    }
  });

  test.each([
    ['cell width', cellWidthExample],
    ['glyph fallback', glyphFallbackExample],
  ] as const)('should keep %s meaning visible under monochrome and UTF-8-off capabilities', (_name, definition) => {
    const app = buildMonochrome(definition);
    try {
      const text = frameText(app);
      expect(text).toMatch(/(?:Sample|Profile):/u);
      expect(text).toMatch(/(?:Action source|READY)/u);
      expect(text).toMatch(/Alt\+[A-Z]/u);
      if (app.desktop === undefined) throw new Error('guide laboratory must use a desktop application');
      expect(viewsIn(app.desktop).some((view) => view instanceof Button)).toBe(true);
    } finally {
      app.loop.dispose();
    }
  });
});

describe('laboratory geometry and lifecycle', () => {
  test.each([
    ['guides/cell-width', cellWidthExample],
    ['guides/glyph-fallback', glyphFallbackExample],
  ] as const)('should show every authored one-row string in the compact 80x24 %s laboratory', (id, definition) => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(id, definition);

      collectTemplate1Evidence(app, dialog);
      expectCompleteCopy(app, id);

      app.loop.dispose();
      dispose();
    });
  });

  test.each([
    ['guides/cell-width', cellWidthExample],
    ['guides/glyph-fallback', glyphFallbackExample],
  ] as const)('should preserve authored rows and containment across repeated %s window changes', (id, definition) => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(id, definition, { viewport: { width: 120, height: 40 } });
      const content = dialog.children.find((view): view is Group => view instanceof Group);
      if (content === undefined) throw new Error(`${id} is missing its inset content group`);
      const authoredTextHeights = content.children
        .filter((view): view is Text => view instanceof Text)
        .map((view) => view.bounds.height);

      collectTemplate1Evidence(app, dialog);
      expectCompleteCopy(app, id);
      for (let cycle = 0; cycle < 2; cycle += 1) {
        resizeDialog(app, dialog);
        collectTemplate1Evidence(app, dialog, { startup: 'resized' });
        expectCompleteCopy(app, id);
        for (const view of viewsIn(content)) expectContained(view);
        dialog.zoom();
        app.loop.renderRoot.flush();
        collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
        expectCompleteCopy(app, id);
        for (const view of viewsIn(content)) expectContained(view);
        dialog.zoom();
        app.loop.renderRoot.flush();
        collectTemplate1Evidence(app, dialog, { startup: 'resized' });
        expectCompleteCopy(app, id);
      }

      expect(
        content.children.filter((view): view is Text => view instanceof Text).map((view) => view.bounds.height),
      ).toEqual(authoredTextHeights);
      app.loop.dispose();
      dispose();
    });
  });

  test.each([
    ['cell width', cellWidthExample],
    ['glyph fallback', glyphFallbackExample],
  ] as const)('should release every %s view scope after repeated teardown', (_name, definition) => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const app = demoShell({
      build: (ctx) => definition.build(ctx),
      title: definition.title,
      kind: 'app',
      caps: resolveCapabilities({ env: {}, platform: 'linux' }).profile,
      viewport: EXAMPLE_VIEWPORT,
    });
    if (app.desktop === undefined) throw new Error('guide laboratory must use a desktop application');
    const mounted = viewsIn(app.desktop);
    try {
      expect(() => {
        app.loop.dispose();
        app.loop.dispose();
      }).not.toThrow();
      expect(mounted.every((view) => !view.mounted && view.scope === null)).toBe(true);
      expect(warning.mock.calls.flat().join('\n')).not.toContain('created outside any createRoot() scope');
    } finally {
      app.loop.dispose();
      warning.mockRestore();
    }
  });
});
