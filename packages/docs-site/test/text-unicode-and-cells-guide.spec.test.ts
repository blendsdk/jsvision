/**
 * Immutable oracle for the Text, Unicode & terminal cells course and its two laboratories.
 *
 * The controls below prove current public width, buffer, wrapping, and fallback boundaries. Course
 * and laboratory assertions describe the final learner-visible result, not placeholder behavior.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ScreenBuffer,
  charWidth,
  degradeCapsFully,
  fallbackGlyph,
  isAsciiSafe,
  resolveCapabilities,
} from '@jsvision/core';
import * as uiPackage from '@jsvision/ui';
import { Button, View, createRoot, stringWidth, wrapText } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import type { ExampleDefinition } from '../examples/_contract.js';
import { EXAMPLES } from '../examples/index.js';
import { parseGuideCatalog } from '../src/guides/guide-catalog.mjs';
import {
  absoluteOrigin,
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  key,
  viewsIn,
} from './example-lab-harness.js';

const guidePath = fileURLToPath(new URL('../guide/text-unicode-and-cells.md', import.meta.url));
const catalogPath = fileURLToPath(new URL('../guides.json', import.meta.url));
const source = existsSync(guidePath) ? readFileSync(guidePath, 'utf8') : '';
const catalog = parseGuideCatalog(readFileSync(catalogPath, 'utf8'));
const guide = catalog.entries.find((candidate) => candidate.id === 'text-unicode-and-cells');
const widthLabId = 'guides/cell-width';
const fallbackLabId = 'guides/glyph-fallback';
const labIds = [widthLabId, fallbackLabId] as const;
const style = { fg: 'default' as const, bg: 'default' as const };

interface TeachingPanel extends View {
  readonly lessonName: string;
  readonly wrapWidth?: number;
  readonly profileName?: string;
}

function snippets(): string[] {
  return [...source.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/g)].map((match) => match[1] ?? '');
}

function registryEntry(id: string) {
  return EXAMPLES.find((candidate) => candidate.id === id);
}

async function loadDefinition(id: string): Promise<ExampleDefinition> {
  const entry = registryEntry(id);
  if (entry === undefined) throw new Error(`Missing example registry entry: ${id}`);
  return (await entry.load()).default;
}

function panelsIn(dialog: View, className: 'CellWidthPanel' | 'GlyphFallbackPanel'): TeachingPanel[] {
  return viewsIn(dialog).filter((view): view is TeachingPanel => view.constructor.name === className);
}

function resizeDialog(
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
): void {
  const origin = absoluteOrigin(dialog);
  const from = {
    x: origin.x + dialog.bounds.width - 1,
    y: origin.y + dialog.bounds.height - 1,
  };
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'drag',
    at: from,
    to: { x: from.x + 9, y: from.y + 3 },
  });
}

function clickButton(app: ReturnType<typeof buildLabExample>['app'], dialog: View, label: string): void {
  const button = viewsIn(dialog).find(
    (view): view is Button => view instanceof Button && view.activation.label === label,
  );
  if (button === undefined) throw new Error(`Laboratory is missing "${label}"`);
  const origin = absoluteOrigin(button);
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'click',
    at: { x: origin.x + 1, y: origin.y },
  });
}

function unicodeCaps() {
  return resolveCapabilities({
    env: { TERM: 'xterm-256color', LANG: 'en_US.UTF-8' },
    platform: 'linux',
    override: {
      unicode: { utf8: true, widthMode: 'wcwidth', emoji: 'wide' },
      glyphs: { boxDrawing: true, halfBlocks: true, ambiguousWide: false },
    },
  }).profile;
}

describe('Text, Unicode & terminal cells course contract', () => {
  test('should publish the completed catalog course with its prerequisite, outcomes, and two labs', () => {
    expect(source).not.toBe('');
    expect(guide).toMatchObject({
      title: 'Text, Unicode & terminal cells',
      profile: 'course',
      stage: 'complete',
      prerequisites: ['layout'],
      requiredLiveExamples: 2,
      liveExampleException: null,
      examples: [...labIds],
    });
    expect(guide?.learningOutcomes).toEqual([
      'Reason about terminal cells, graphemes, wide glyphs, combining marks, wrapping, and clipping.',
      'Build text interfaces that remain legible across Unicode and ASCII-safe capability profiles.',
    ]);
    expect(source).toContain('](/guide/layout)');
  });

  test('should state the learner contract and progress through the complete course backbone', () => {
    const sections = [
      '## Who this course is for',
      '## Mental model',
      '## Your first cell-width result',
      '## Code points, graphemes, and cells',
      '## Wide glyphs and combining marks',
      '## Wrapping and clipping',
      '## Capability-aware glyphs',
      '## Composition and integration',
      '## Advanced behavior',
      '## Failure modes and diagnosis',
      '## Best practices',
      '## Practice and next steps',
    ];
    let previous = -1;
    for (const section of sections) {
      const index = source.indexOf(section);
      expect(index, `missing or misplaced ${section}`).toBeGreaterThan(previous);
      previous = index;
    }
    expect(source).toMatch(/^description:\s*.+(?:Unicode|text).+(?:cell|glyph).+$/imu);
    expect(source).toMatch(
      /\bbuild\b[\s\S]{0,400}\bexplain\b[\s\S]{0,400}\bdiagnos(?:e|is)\b[\s\S]{0,400}\bverify\b/iu,
    );
    expect(source).toMatch(/(?:assume|already know|comfortable with)[\s\S]{0,450}(?:layout|terminal cell)/iu);
    expect(source).toMatch(/(?:table|status|workspace|application)[\s\S]{0,500}(?:misalign|clip|unreadable|legible)/iu);
    expect(source).toContain(`<PlayExample id="${widthLabId}"`);
    expect(source).toContain(`<PlayExample id="${fallbackLabId}"`);
  });

  test('should teach the exact code-point width and ScreenBuffer storage model', () => {
    expect(source).toMatch(/code point[\s\S]{0,300}grapheme[\s\S]{0,300}(?:terminal )?cell/iu);
    expect(source).toMatch(/width scan[\s\S]{0,350}code[- ]point/iu);
    expect(source).toMatch(/combining mark[\s\S]{0,350}(?:zero|0)[ -]?(?:cell|width)/iu);
    expect(source).toMatch(/(?:CJK|emoji)[\s\S]{0,350}(?:two|2)[ -]cells/iu);
    expect(source).toMatch(/width[- ]2 lead[\s\S]{0,350}width[- ]0 continuation/iu);
    expect(source).toMatch(/combining mark[\s\S]{0,450}(?:compose|append)[\s\S]{0,250}(?:prior|previous|base)/iu);
    expect(source).toMatch(/last column[\s\S]{0,400}wide glyph[\s\S]{0,350}(?:space|never a half|not half)/iu);
  });

  test('should explain wrapping and clipping without claiming full grapheme support', () => {
    expect(source).toMatch(
      /wrapText\([\s\S]{0,450}(?:surrogate pair)[\s\S]{0,250}(?:never|does not)[\s\S]{0,180}split/iu,
    );
    expect(source).toMatch(/(?:ZWJ|skin[- ]tone|flag)[\s\S]{0,500}(?:may|can)[\s\S]{0,250}split/iu);
    expect(source).toMatch(/not (?:fully )?grapheme-aware|code[- ]point wrapping/iu);
    expect(source).toMatch(/clipping[\s\S]{0,450}(?:wide glyph|cell boundary)[\s\S]{0,300}(?:omit|space|not split)/iu);
    expect(source).toMatch(/plain `?Input`?[\s\S]{0,400}(?:not|isn't)[\s\S]{0,250}(?:wide|grapheme)[ -]aware/iu);
    expect(source).not.toMatch(/import\s*\{[^}]*clipCellText[^}]*\}\s*from\s*['"]@jsvision\/ui['"]/u);
    expect(source).toContain('](/components/controls/input)');
  });

  test('should teach capability resolution and each fallback boundary accurately', () => {
    expect(source).toMatch(/resolveCapabilities\([\s\S]{0,500}(?:unicode|glyph|profile)/iu);
    expect(source).toMatch(/fallbackGlyph\(/u);
    expect(source).toMatch(/box[- ]drawing[\s\S]{0,350}(?:\+|-|\|)[\s\S]{0,300}(?:unavailable|fallback|off)/iu);
    expect(source).toMatch(/(?:arrow|ambiguous)[\s\S]{0,350}(?:\^|<|>)[\s\S]{0,300}(?:fallback|wide)/iu);
    expect(source).toMatch(/(?:block|shade)[\s\S]{0,350}#[\s\S]{0,250}(?:fallback|off)/iu);
    expect(source).toMatch(/degradeCapsFully\([\s\S]{0,500}(?:does not|keeps)[\s\S]{0,250}unicode\.utf8/iu);
    expect(source).toMatch(/generic non-ASCII[\s\S]{0,400}\?[\s\S]{0,250}(?:only|when)[\s\S]{0,200}UTF-8/iu);
    expect(source).toMatch(/isAsciiSafe\(/u);
  });

  test('should keep teaching snippets concise, public, focused, and free of live-app plumbing', () => {
    const code = snippets();
    expect(code.length).toBeGreaterThanOrEqual(7);
    for (const snippet of code) {
      expect(snippet.split('\n').filter((line) => line.trim() !== '').length).toBeLessThanOrEqual(24);
      expect(snippet).not.toMatch(
        /(?:demoApp|Template1Dialog|defineExample|packages\/(?:core|ui)\/src|@jsvision\/ui\/src)/u,
      );
      expect(snippet).not.toMatch(/\bclipCellText\b/u);
      for (const imported of snippet.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu)) {
        expect(['@jsvision/core', '@jsvision/ui']).toContain(imported[1]);
      }
    }
    expect(code.some((snippet) => /stringWidth\(/u.test(snippet))).toBe(true);
    expect(code.some((snippet) => /wrapText\(/u.test(snippet))).toBe(true);
    expect(code.some((snippet) => /ScreenBuffer/u.test(snippet))).toBe(true);
    expect(code.some((snippet) => /fallbackGlyph\(/u.test(snippet))).toBe(true);
  });

  test('should diagnose failures and finish with production guidance, practice, and API links', () => {
    expect(source).toMatch(/symptom[\s\S]{0,250}cause[\s\S]{0,250}(?:correction|fix)[\s\S]{0,250}evidence/iu);
    expect(source).toMatch(/(?:misalign|drift)[\s\S]{0,500}(?:wide|cell width|capability)/iu);
    expect(source).toMatch(/half glyph|last-column wide|clipp/iu);
    expect(source).toMatch(/combining[\s\S]{0,450}(?:detached|orphan|base)/iu);
    expect(source).toMatch(/(?:monochrome|non-colou?r|ASCII-safe)[\s\S]{0,350}(?:status|cue|label)/iu);
    expect(source).toMatch(
      /## Practice and next steps[\s\S]{0,1200}(?:combining|wide)[\s\S]{0,500}(?:resize|clip)[\s\S]{0,500}(?:ASCII|fallback)/iu,
    );
    for (const link of [
      '/guide/layout',
      '/guide/theming-and-colour-depth',
      '/components/controls/text',
      '/components/controls/input',
      '/api/core/classes/ScreenBuffer',
      '/api/core/functions/charWidth',
      '/api/ui/functions/stringWidth',
      '/api/ui/functions/wrapText',
    ]) {
      expect(source).toContain(link);
    }
  });
});

describe('public cell-width and capability behavior taught by the course', () => {
  // Width is intentionally code-point based: this proves the useful guarantees and the honest
  // grapheme boundary independently of any future prose or laboratory implementation.
  test('should count ASCII, combining, CJK, emoji, and ZWJ sequences by code point', () => {
    expect(charWidth('A'.codePointAt(0)!, 'wcwidth')).toBe(1);
    expect(charWidth(0x0301, 'wcwidth')).toBe(0);
    expect(charWidth('界'.codePointAt(0)!, 'wcwidth')).toBe(2);
    expect(charWidth('😀'.codePointAt(0)!, 'wcwidth')).toBe(2);
    expect(stringWidth('A')).toBe(1);
    expect(stringWidth('e\u0301')).toBe(1);
    expect(stringWidth('界😀')).toBe(4);
    expect(stringWidth('👩‍💻')).toBe(4);
  });

  test('should preserve surrogate pairs while documenting code-point rather than grapheme wrapping', () => {
    expect(wrapText('😀😀', 2)).toEqual(['😀', '😀']);
    const zwj = wrapText('👩‍💻', 2);
    expect(zwj.join('')).toBe('👩‍💻');
    expect(zwj.length).toBeGreaterThan(1);
    expect(zwj[0]).toBe('👩‍');
    const skinTone = wrapText('👍🏽', 2);
    expect(skinTone.join('')).toBe('👍🏽');
    expect(skinTone).toEqual(['👍', '🏽']);
  });

  test('should store wide continuations, compose combining marks, and avoid last-column halves', () => {
    const buffer = new ScreenBuffer(4, 2, style);
    expect(buffer.text(0, 0, '界', style)).toBe(2);
    expect(buffer.get(0, 0)).toMatchObject({ char: '界', width: 2 });
    expect(buffer.get(1, 0)).toMatchObject({ char: '', width: 0 });
    expect(buffer.text(0, 1, 'e\u0301', style)).toBe(1);
    expect(buffer.get(0, 1)).toMatchObject({ char: 'e\u0301', width: 1 });
    buffer.set(3, 0, '😀', style);
    expect(buffer.get(3, 0)).toMatchObject({ char: ' ', width: 1 });
  });

  test('should resolve Unicode, adapted-chrome, fully degraded, and non-UTF-8 fallbacks', () => {
    const utf8 = unicodeCaps();
    const adapted = {
      ...utf8,
      glyphs: { ...utf8.glyphs, ambiguousWide: true },
    };
    const asciiSafe = degradeCapsFully(utf8);
    const noUtf8 = {
      ...asciiSafe,
      unicode: { ...asciiSafe.unicode, utf8: false },
    };
    expect(fallbackGlyph('┌', utf8)).toBe('┌');
    expect(fallbackGlyph('▲', adapted)).toBe('^');
    expect(fallbackGlyph('┌', adapted)).toBe('┌');
    expect(fallbackGlyph('█', adapted)).toBe('█');
    expect(fallbackGlyph('┌', asciiSafe)).toBe('+');
    expect(fallbackGlyph('▲', asciiSafe)).toBe('^');
    expect(fallbackGlyph('█', asciiSafe)).toBe('#');
    expect(fallbackGlyph('é', asciiSafe)).toBe('é');
    expect(asciiSafe.unicode.utf8).toBe(true);
    expect(isAsciiSafe(utf8)).toBe(false);
    expect(isAsciiSafe(asciiSafe)).toBe(true);
    expect(fallbackGlyph('é', noUtf8)).toBe('?');
    expect(isAsciiSafe(noUtf8)).toBe(true);
  });

  test('should keep the internal clipping helper out of the public UI package', () => {
    expect(uiPackage).not.toHaveProperty('clipCellText');
    expect(uiPackage).toHaveProperty('stringWidth');
    expect(uiPackage).toHaveProperty('wrapText');
  });
});

describe('Text and glyph laboratory contract', () => {
  // The labs must turn both catalog outcomes into observable behavior through the same real shell,
  // event loop, capability logic, and window operations a learner uses in the documentation.
  test('should register two distinct applications with objective-specific titles and blurbs', async () => {
    expect(registryEntry(widthLabId)).toMatchObject({
      kind: 'app',
      sourcePath: 'examples/guides/cell-width.ts',
    });
    expect(registryEntry(fallbackLabId)).toMatchObject({
      kind: 'app',
      sourcePath: 'examples/guides/glyph-fallback.ts',
    });
    const widthDefinition = await loadDefinition(widthLabId);
    const fallbackDefinition = await loadDefinition(fallbackLabId);
    expect(widthDefinition.title).toMatch(/Cell Width (?:Laboratory|Workshop)/iu);
    expect(widthDefinition.blurb).toMatch(/wide[\s\S]*combining[\s\S]*(?:wrap|clip)/iu);
    expect(fallbackDefinition.title).toMatch(/Glyph Fallback (?:Laboratory|Workshop)/iu);
    expect(fallbackDefinition.blurb).toMatch(/UTF-8[\s\S]*adapted[\s\S]*ASCII/iu);
  });

  test.each(labIds)('should open %s in a compact centered Classic shell at 80x24', async (id) => {
    const definition = await loadDefinition(id);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(id, definition);
      const evidence = collectTemplate1Evidence(app, dialog);
      expect(evidence.viewport).toEqual({ width: 80, height: 24 });
      expect(evidence.dialogRect.width).toBeLessThan(evidence.viewport.width);
      expect(evidence.dialogRect.height).toBeLessThan(evidence.viewport.height - 2);
      expect(dialog.closable).toBe(false);
      expect(dialog.background).toBeUndefined();
      expect(evidence.dialogInterior.join('\n')).toMatch(/(?:Alt|Enter|mouse|click)/iu);
      app.loop.dispose();
      expect(dialog.mounted).toBe(false);
      dispose();
    });
  });

  test.each(labIds)('should keep %s padded and unclipped through resize, maximize, and restore', async (id) => {
    const definition = await loadDefinition(id);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(id, definition, {
        viewport: { width: 120, height: 40 },
      });
      const authored = { ...dialog.bounds };
      resizeDialog(app, dialog);
      expect(dialog.bounds.width).toBeGreaterThan(authored.width);
      expect(dialog.bounds.height).toBeGreaterThan(authored.height);
      const resized = { ...dialog.bounds };
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      dialog.zoom();
      app.loop.renderRoot.flush();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      dialog.zoom();
      app.loop.renderRoot.flush();
      app.loop.renderRoot.flush();
      expect(dialog.bounds).toEqual(resized);
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      app.loop.dispose();
      dispose();
    });
  });

  test('should make exact width, buffer, wrapping, and clipping evidence interactive', async () => {
    const definition = await loadDefinition(widthLabId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(widthLabId, definition);
      const panels = panelsIn(dialog, 'CellWidthPanel');
      expect(panels).toHaveLength(1);
      expect(panels[0]?.lessonName).toBe('Cell width');
      expect(panels[0]?.wrapWidth).toBe(12);
      expect(frameText(app)).toMatch(/ASCII A:\s*1/iu);
      expect(frameText(app)).toMatch(/Combining e \+ .+:\s*1/iu);
      expect(frameText(app)).toMatch(/CJK 界:\s*2/iu);
      expect(frameText(app)).toMatch(/Emoji 😀:\s*2/iu);
      expect(frameText(app)).toMatch(/Lead width:\s*2[\s\S]*Continuation width:\s*0/iu);
      expect(frameText(app)).toMatch(/Last-column wide:\s*space/iu);
      app.loop.dispatch(key('w', { alt: true }));
      expect(panels[0]?.wrapWidth).toBe(8);
      expect(frameText(app)).toMatch(/Wrap width:\s*8 cells/iu);
      app.loop.dispatch(key('g', { alt: true }));
      expect(frameText(app)).toMatch(/Sample:\s*ZWJ sequence/iu);
      expect(frameText(app)).toMatch(/Wrap boundary:\s*code points \(not graphemes\)/iu);
      clickButton(app, dialog, 'Next sample');
      expect(frameText(app)).toMatch(/Action source:\s*mouse/iu);
      app.loop.dispose();
      dispose();
    });
  });

  test('should compare real UTF-8, adapted, ASCII-safe, and UTF-8-off fallback outcomes', async () => {
    const definition = await loadDefinition(fallbackLabId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(fallbackLabId, definition);
      const panels = panelsIn(dialog, 'GlyphFallbackPanel');
      expect(panels).toHaveLength(1);
      expect(panels[0]?.profileName).toBe('UTF-8');
      expect(frameText(app)).toMatch(/Box:\s*┌─┐[\s\S]*Arrow:\s*▲[\s\S]*Block:\s*█[\s\S]*Text:\s*é/iu);
      app.loop.dispatch(key('p', { alt: true }));
      expect(panels[0]?.profileName).toBe('Adapted chrome');
      expect(frameText(app)).toMatch(/Box:\s*┌─┐[\s\S]*Arrow:\s*\^[\s\S]*Block:\s*█[\s\S]*Text:\s*é/iu);
      app.loop.dispatch(key('p', { alt: true }));
      expect(panels[0]?.profileName).toBe('ASCII-safe');
      expect(frameText(app)).toMatch(/Box:\s*\+-\+[\s\S]*Arrow:\s*\^[\s\S]*Block:\s*#[\s\S]*Text:\s*é/iu);
      expect(frameText(app)).toMatch(/isAsciiSafe:\s*yes[\s\S]*UTF-8:\s*yes/iu);
      app.loop.dispatch(key('u', { alt: true }));
      expect(frameText(app)).toMatch(/UTF-8:\s*no[\s\S]*Text:\s*\?/iu);
      app.loop.dispose();
      dispose();
    });
  });

  test('should expose keyboard and mouse actions, ASCII status cues, and deterministic cleanup', async () => {
    for (const id of labIds) {
      const definition = await loadDefinition(id);
      let mounted: View[] = [];
      createRoot((dispose) => {
        const { app, dialog } = buildLabExample(id, definition);
        mounted = viewsIn(dialog);
        expect(frameText(app)).toMatch(/Alt\+[A-Z]/u);
        expect(frameText(app)).toMatch(/(?:Profile|Sample|Status|Action):/iu);
        expect(frameText(app)).toMatch(/(?:yes|no|width|cells|fallback)/iu);
        const buttons = viewsIn(dialog).filter((view): view is Button => view instanceof Button);
        expect(buttons.length).toBeGreaterThan(0);
        expect(buttons.every((button) => button.focusable)).toBe(true);
        app.loop.dispose();
        dispose();
      });
      expect(mounted.every((view) => !view.mounted && view.scope === null)).toBe(true);
    }
  });
});
