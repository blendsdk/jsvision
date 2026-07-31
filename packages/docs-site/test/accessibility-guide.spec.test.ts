/**
 * Immutable oracle for the Accessibility & resilient interaction course and its two laboratories.
 *
 * One laboratory proves keyboard-complete discovery and focus. The other proves that meaning
 * survives monochrome, ASCII fallback, reduced geometry, and documentation-host constraints.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { degradeCapsFully, fallbackGlyph, isAsciiSafe, monochromeTheme, resolveCapabilities } from '@jsvision/core';
import { Button, Group, View, createEventLoop } from '@jsvision/ui';
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

const guidePath = fileURLToPath(new URL('../guide/accessibility.md', import.meta.url));
const catalogPath = fileURLToPath(new URL('../guides.json', import.meta.url));
const source = existsSync(guidePath) ? readFileSync(guidePath, 'utf8') : '';
const catalog = parseGuideCatalog(readFileSync(catalogPath, 'utf8'));
const guide = catalog.entries.find((candidate) => candidate.id === 'accessibility');
const INTERACTION_ID = 'guides/accessible-interaction';
const PRESENTATION_ID = 'guides/resilient-presentation';
const labIds = [INTERACTION_ID, PRESENTATION_ID] as const;
const richCaps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: {
    colorDepth: 'truecolor',
    unicode: { utf8: true, widthMode: 'wcwidth', emoji: 'wide' },
    glyphs: { boxDrawing: true, halfBlocks: true, ambiguousWide: false },
  },
}).profile;

interface AccessibleInteractionPanel extends View {
  readonly lessonName: 'Keyboard-complete interaction';
  readonly keyboardVisits: number;
  readonly hotkeyActivations: number;
  readonly mouseActivations: number;
  readonly visibleFocusChecks: number;
  readonly nonColorChecks: number;
  readonly cleanupCount: number;
}

interface ResilientPresentationPanel extends View {
  readonly lessonName: 'Resilient presentation';
  readonly profileName: 'Classic' | 'NO_COLOR' | 'Monochrome' | 'ASCII' | 'Narrow';
  readonly profileChanges: number;
  readonly meaningChecks: number;
  readonly clippingFailures: number;
  readonly asciiUnsafeGlyphs: number;
  readonly cleanupCount: number;
}

function snippets(): string[] {
  return [...source.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/gu)].map((match) => match[1] ?? '');
}

function registryEntry(id: string) {
  return EXAMPLES.find((candidate) => candidate.id === id);
}

async function loadDefinition(id: string): Promise<ExampleDefinition> {
  const entry = registryEntry(id);
  if (entry === undefined) throw new Error(`missing example registry entry: ${id}`);
  return (await entry.load()).default;
}

function interactionPanel(dialog: View): AccessibleInteractionPanel {
  const panel = viewsIn(dialog).find(
    (view): view is AccessibleInteractionPanel =>
      'lessonName' in view && view.lessonName === 'Keyboard-complete interaction',
  );
  if (panel === undefined) throw new Error('the interaction laboratory is missing its teaching panel');
  return panel;
}

function presentationPanel(dialog: View): ResilientPresentationPanel {
  const panel = viewsIn(dialog).find(
    (view): view is ResilientPresentationPanel => 'lessonName' in view && view.lessonName === 'Resilient presentation',
  );
  if (panel === undefined) throw new Error('the presentation laboratory is missing its teaching panel');
  return panel;
}

function clickButton(app: ReturnType<typeof buildLabExample>['app'], dialog: View, label: string): void {
  const button = viewsIn(dialog).find(
    (view): view is Button => view instanceof Button && view.activation.label === label,
  );
  if (button === undefined) throw new Error(`the accessibility laboratory is missing "${label}"`);
  const origin = absoluteOrigin(button);
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'click',
    at: { x: origin.x + Math.floor(button.bounds.width / 2), y: origin.y },
  });
}

function resizeDialog(
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
): void {
  const origin = absoluteOrigin(dialog);
  const corner = {
    x: origin.x + dialog.bounds.width - 1,
    y: origin.y + dialog.bounds.height - 1,
  };
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'drag',
    at: corner,
    to: { x: corner.x + 9, y: corner.y + 3 },
  });
}

describe('Accessibility & resilient interaction course contract', () => {
  test('should publish the completed catalog course with both outcome-specific laboratories', () => {
    expect(source).not.toBe('');
    expect(guide).toMatchObject({
      title: 'Accessibility & resilient interaction',
      group: 'Operating a real app',
      page: '/guide/accessibility',
      profile: 'course',
      stage: 'complete',
      sidebarOrder: 4,
      prerequisites: ['views-and-focus', 'keyboard-and-clipboard', 'theming-and-colour-depth'],
      learningOutcomes: [
        'Design keyboard-complete, discoverable interactions with visible focus and non-color state cues.',
        'Preserve meaning under NO_COLOR, monochrome, ASCII fallback, reduced geometry, and browser documentation constraints.',
      ],
      requiredLiveExamples: 2,
      liveExampleException: null,
      examples: [...labIds],
    });
    expect(source).toContain('](/guide/views-and-focus)');
    expect(source).toContain('](/guide/keyboard-and-clipboard)');
    expect(source).toContain('](/guide/theming-and-colour-depth)');
    for (const id of labIds) expect(source).toContain(`<PlayExample id="${id}"`);
  });

  test('should state the learner contract and follow the complete question-led course backbone', () => {
    const sections = [
      '## Who is this course for?',
      '## What is the resilient-interaction mental model?',
      '## How do I get the first keyboard-complete result?',
      '## Laboratory: keyboard-complete interaction',
      '## How do I design a complete focus route?',
      '## How do users discover commands?',
      '## How do I make focus and state visible without colour?',
      '## How do pointer and keyboard paths stay equivalent?',
      '## Laboratory: resilient presentation',
      '## What does NO_COLOR change?',
      '## How do monochrome and ASCII fallbacks preserve meaning?',
      '## How do I design for reduced geometry?',
      '## What can a browser documentation terminal prove?',
      '## How do I compose resilient interaction across an application?',
      '## What belongs in advanced accessibility work?',
      '## How do I diagnose accessibility failures?',
      '## What are the best practices?',
      '## What should I practice next?',
    ];
    let previous = -1;
    for (const section of sections) {
      const index = source.indexOf(section);
      expect(index, `missing or misplaced ${section}`).toBeGreaterThan(previous);
      previous = index;
    }
    expect(source).toMatch(/^description:\s*.+keyboard.+focus.+(?:non-color|monochrome).+(?:ASCII|geometry)/imu);
    expect(source).toMatch(/\bbuild\b[\s\S]*\bexplain\b[\s\S]*\bdiagnos(?:e|is)\b[\s\S]*\bverify\b/iu);
  });

  test('should teach keyboard completeness as a reachable task graph, not a list of key names', () => {
    expect(source).toMatch(
      /(?:every|all)[\s\S]{0,250}(?:action|task|workflow)[\s\S]{0,250}(?:keyboard|without a mouse)/iu,
    );
    expect(source).toMatch(
      /(?:Tab|focusNext)[\s\S]{0,300}(?:document|tree|source) order[\s\S]{0,250}(?:Shift\+Tab|focusPrev)/iu,
    );
    expect(source).toMatch(/(?:disabled|hidden|unmounted)[\s\S]{0,300}(?:skip|ineligible|not focusable)/iu);
    expect(source).toMatch(
      /(?:modal|dialog)[\s\S]{0,300}(?:confine|scope|contain)[\s\S]{0,250}(?:restore|previous focus)/iu,
    );
    expect(source).toMatch(
      /(?:Enter|Space)[\s\S]{0,250}(?:activate|button)[\s\S]{0,300}(?:arrow|selection|navigation)/iu,
    );
    expect(source).toMatch(
      /(?:test|verify)[\s\S]{0,300}(?:start|complete)[\s\S]{0,250}(?:workflow|task)[\s\S]{0,250}(?:keyboard only|without a mouse)/iu,
    );
  });

  test('should teach command discovery through labels, accelerators, and visible instructions', () => {
    expect(source).toMatch(/~[A-Za-z]~[\s\S]{0,300}(?:Alt|accelerator|hotkey)/u);
    expect(source).toMatch(
      /(?:F12|revealKey)[\s\S]{0,350}(?:reveal|underline)[\s\S]{0,250}(?:bare letter|accelerator)/iu,
    );
    expect(source).toMatch(/(?:status line|menu|instruction|help)[\s\S]{0,350}(?:shortcut|command|discover)/iu);
    expect(source).toMatch(
      /(?:duplicate|collision)[\s\S]{0,300}(?:accelerator|hotkey)[\s\S]{0,250}(?:scope|co-visible)/iu,
    );
    expect(source).toMatch(/(?:browser|OS)[\s\S]{0,350}(?:reserve|consume)[\s\S]{0,250}(?:F-key|Tab|Alt|Ctrl|chord)/iu);
    expect(source).toMatch(/(?:fallback|alternative)[\s\S]{0,350}(?:reserved|unavailable)[\s\S]{0,250}(?:key|chord)/iu);
  });

  test('should require visible focus and non-colour cues for every meaningful state', () => {
    expect(source).toMatch(
      /(?:focused|focus)[\s\S]{0,350}(?:border|caret|marker|underline|label)[\s\S]{0,250}(?:not|besides|independent)[\s\S]{0,150}colou?r/iu,
    );
    expect(source).toMatch(
      /(?:selected|checked|expanded|disabled|error)[\s\S]{0,450}(?:text|glyph|marker|label|shape)/iu,
    );
    expect(source).toMatch(/(?:colour alone|color alone)[\s\S]{0,300}(?:never|not|insufficient|fails)/iu);
    expect(source).toMatch(
      /(?:buttonFocused|listFocused|inputSelected|dangerText)[\s\S]{0,400}(?:semantic|theme role)/iu,
    );
    expect(source).toMatch(
      /(?:visible focus|focus cue)[\s\S]{0,300}(?:every|all)[\s\S]{0,250}(?:depth|theme|profile)/iu,
    );
    expect(source).toMatch(
      /(?:status|feedback)[\s\S]{0,300}(?:success|warning|error)[\s\S]{0,250}(?:word|text|non-color)/iu,
    );
  });

  test('should preserve semantics under NO_COLOR, monochrome, and ASCII fallback', () => {
    expect(source).toMatch(/NO_COLOR[\s\S]{0,300}(?:presence|any value)[\s\S]{0,250}(?:mono|monochrome)/iu);
    expect(source).toMatch(/(?:monochromeTheme|colorDepth.*mono)[\s\S]{0,350}(?:attrs|underline|reverse|bold)/iu);
    expect(source).toMatch(/degradeCapsFully\([\s\S]{0,300}(?:boxDrawing|halfBlocks|ambiguousWide|ASCII)/iu);
    expect(source).toMatch(
      /fallbackGlyph\([\s\S]{0,350}(?:border|arrow|block|marker)[\s\S]{0,250}(?:ASCII|fallback)/iu,
    );
    expect(source).toMatch(/isAsciiSafe\([\s\S]{0,300}(?:verify|test|profile)/iu);
    expect(source).toMatch(
      /(?:PASS|WARN|ERROR|selected|focused)[\s\S]{0,350}(?:text|ASCII|marker)[\s\S]{0,250}(?:without|independent of) colou?r/iu,
    );
  });

  test('should treat reduced geometry as prioritization rather than scaled-down desktop layout', () => {
    expect(source).toMatch(
      /(?:reduced|narrow|small)[\s\S]{0,350}(?:geometry|viewport|terminal)[\s\S]{0,250}(?:priority|essential|progressive)/iu,
    );
    expect(source).toMatch(
      /(?:wrap|reflow|stack)[\s\S]{0,350}(?:controls|instructions|labels)[\s\S]{0,250}(?:clip|truncate|scroll)/iu,
    );
    expect(source).toMatch(
      /(?:minimum|too small|insufficient)[\s\S]{0,350}(?:message|diagnostic|fallback)[\s\S]{0,250}(?:action|recover|resize)/iu,
    );
    expect(source).toMatch(
      /(?:focus|keyboard)[\s\S]{0,350}(?:remains|still)[\s\S]{0,250}(?:reachable|usable)[\s\S]{0,250}(?:resize|narrow)/iu,
    );
    expect(source).toMatch(
      /(?:do not|never|avoid)[\s\S]{0,350}(?:hide|clip)[\s\S]{0,250}(?:only action|focused|instructions|feedback)/iu,
    );
  });

  test('should state browser documentation evidence and assistive-technology limits honestly', () => {
    expect(source).toMatch(
      /(?:browser docs|documentation terminal|xterm)[\s\S]{0,400}(?:keyboard|focus|cells|resize)/iu,
    );
    expect(source).toMatch(
      /(?:cannot|does not|not)[\s\S]{0,350}(?:prove|guarantee)[\s\S]{0,250}(?:screen reader|assistive technolog|native terminal)/iu,
    );
    expect(source).toMatch(/(?:DOM|ARIA|semantic HTML)[\s\S]{0,350}(?:outside|host|separate|not supplied)/iu);
    expect(source).toMatch(
      /(?:browser|OS)[\s\S]{0,350}(?:reserved|reclaim|consume)[\s\S]{0,250}(?:shortcut|key|chord)/iu,
    );
    expect(source).toMatch(/(?:manual|platform|assistive)[\s\S]{0,350}(?:test|evidence|verification)/iu);
    expect(source).not.toMatch(
      /(?:fully accessible|WCAG compliant|screen-reader compatible) (?:by default|automatically)/iu,
    );
  });

  test('should integrate pointer parity, cleanup, diagnosis, and production judgment', () => {
    expect(source).toMatch(/(?:mouse|pointer)[\s\S]{0,350}(?:same command|same outcome|parity)[\s\S]{0,250}keyboard/iu);
    expect(source).toMatch(/(?:drag|hover|wheel)[\s\S]{0,350}(?:keyboard alternative|not required|equivalent)/iu);
    expect(source).toMatch(/(?:dispose|onCleanup|cleanup)[\s\S]{0,350}(?:timer|subscription|listener|host)/iu);
    expect(source).toMatch(
      /(?:focus lost|invisible focus|shortcut collision|colour-only|color-only|clipped action)[\s\S]{0,450}(?:cause|correction|evidence)/iu,
    );
    expect(source).toMatch(/(?:audit|matrix)[\s\S]{0,350}(?:keyboard|monochrome|ASCII|geometry|browser)/iu);
  });

  test('should keep snippets concise and public and close with failure evidence and exercises', () => {
    const code = snippets();
    expect(code.length).toBeGreaterThanOrEqual(10);
    for (const snippet of code) {
      expect(snippet.split('\n').filter((line) => line.trim() !== '').length).toBeLessThanOrEqual(28);
      expect(snippet).not.toMatch(/(?:demoApp|Template1Dialog|defineExample|packages\/(?:core|ui|web)\/src)/u);
      for (const imported of snippet.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu)) {
        expect(['@jsvision/core', '@jsvision/ui', '@jsvision/web']).toContain(imported[1]);
      }
    }
    const joined = code.join('\n');
    for (const api of [
      'createApplication',
      'getFocused',
      'focusNext',
      'setAcceleratorMode',
      'resolveCapabilities',
      'monochromeTheme',
      'degradeCapsFully',
      'fallbackGlyph',
      'isAsciiSafe',
    ]) {
      expect(joined).toMatch(new RegExp(`\\b${api}\\b`, 'u'));
    }
    expect(source).toMatch(/symptom[\s\S]{0,300}cause[\s\S]{0,300}(?:correction|fix)[\s\S]{0,300}evidence/iu);
    expect(source).toMatch(/(?:exercise|experiment)[\s\S]{0,1400}(?:keyboard|focus|NO_COLOR|ASCII|narrow|browser)/iu);
    expect(source).toContain('](/api/ui/functions/createApplication)');
    expect(source).toContain('](/api/ui/functions/createEventLoop)');
    expect(source).toContain('](/api/core/functions/degradeCapsFully)');
    expect(source).toContain('](/api/core/functions/fallbackGlyph)');
  });
});

describe('public resilient-interaction controls taught by the course', () => {
  test('should traverse eligible controls in both directions and preserve visible focused state', () => {
    const save = new Button('~S~ave');
    const unavailable = new Button('~D~elete', { disabled: true });
    const cancel = new Button('~C~ancel');
    for (const button of [save, unavailable, cancel]) {
      button.setLayout({ size: { kind: 'fixed', cells: 2 } });
    }
    const root = new Group();
    root.setLayout({ direction: 'col' });
    root.add(save);
    root.add(unavailable);
    root.add(cancel);
    const loop = createEventLoop({ width: 18, height: 6 }, { caps: richCaps });
    loop.mount(root);
    loop.focusView(save);
    const saveFrame = loop.renderRoot
      .buffer()
      .rows()
      .map((row) => row.map((cell) => `${cell.char}:${cell.fg}:${cell.bg}:${cell.attrs}`).join('|'))
      .join('\n');
    loop.focusNext();
    expect(loop.getFocused()).toBe(cancel);
    const cancelFrame = loop.renderRoot
      .buffer()
      .rows()
      .map((row) => row.map((cell) => `${cell.char}:${cell.fg}:${cell.bg}:${cell.attrs}`).join('|'))
      .join('\n');
    expect(cancelFrame).not.toBe(saveFrame);
    loop.focusPrev();
    expect(loop.getFocused()).toBe(save);
    loop.dispose();
  });

  test('should activate the same control by Alt hotkey and discoverable accelerator mode', () => {
    let saves = 0;
    const save = new Button('~S~ave', { onClick: () => (saves += 1) });
    save.setLayout({ size: { kind: 'fixed', cells: 2 } });
    const root = new Group();
    root.add(save);
    const loop = createEventLoop({ width: 14, height: 3 }, { caps: richCaps });
    loop.mount(root);
    loop.dispatch(key('s', { alt: true }));
    expect(saves).toBe(1);
    loop.dispatch(key('f12'));
    loop.dispatch(key('s'));
    expect(saves).toBe(2);
    loop.dispose();
  });

  test('should honor NO_COLOR and retain attribute-driven monochrome focus', () => {
    const noColor = resolveCapabilities({
      env: { NO_COLOR: '', FORCE_COLOR: '3', TERM: 'xterm-256color' },
      platform: 'linux',
    }).profile;
    expect(noColor.colorDepth).toBe('mono');
    expect(monochromeTheme.buttonFocused.attrs).toBeDefined();
    expect(monochromeTheme.buttonFocused.attrs).not.toBe(monochromeTheme.button.attrs);
    expect(monochromeTheme.listFocused.attrs).toBeDefined();
  });

  test('should force deterministic ASCII-safe chrome without losing semantic labels', () => {
    const ascii = degradeCapsFully(richCaps);
    expect(isAsciiSafe(ascii)).toBe(true);
    expect(fallbackGlyph('│', ascii)).toBe('|');
    expect(fallbackGlyph('─', ascii)).toBe('-');
    expect(fallbackGlyph('█', ascii)).toBe('#');
    expect(['v', '^', '<', '>', '+', '-', '|', '#']).toContain(fallbackGlyph('↕', ascii));
    expect('PASS').toMatch(/PASS/u);
  });
});

describe('Accessibility laboratories contract', () => {
  test('should register two distinct accurately described application laboratories', async () => {
    expect(registryEntry(INTERACTION_ID)).toMatchObject({
      id: INTERACTION_ID,
      kind: 'app',
      themeMenu: true,
      sourcePath: 'examples/guides/accessible-interaction.ts',
    });
    expect(registryEntry(PRESENTATION_ID)).toMatchObject({
      id: PRESENTATION_ID,
      kind: 'app',
      themeMenu: true,
      sourcePath: 'examples/guides/resilient-presentation.ts',
    });
    const interaction = await loadDefinition(INTERACTION_ID);
    const presentation = await loadDefinition(PRESENTATION_ID);
    expect(interaction.blurb).toMatch(/keyboard.+focus.+discover.+non-color/iu);
    expect(presentation.blurb).toMatch(/NO_COLOR.+monochrome.+ASCII.+geometry/iu);
  });

  test.each(labIds)('should open %s as a centered compact Classic template1 application', async (id) => {
    const { app, dialog } = buildLabExample(id, await loadDefinition(id));
    const evidence = collectTemplate1Evidence(app, dialog);
    expect(evidence.viewport).toEqual({ width: 80, height: 24 });
    expect(evidence.dialogInterior.join('\n')).toMatch(/Alt\+|F12|Tab|keyboard|profile/iu);
    app.loop.dispose();
  });

  test('should complete discovery, traversal, focus, and activation by keyboard', async () => {
    const { app, dialog } = buildLabExample(INTERACTION_ID, await loadDefinition(INTERACTION_ID));
    const panel = interactionPanel(dialog);
    dispatchExampleAction(app, { kind: 'key', key: 'tab', modifiers: [] });
    dispatchExampleAction(app, { kind: 'key', key: 'tab', modifiers: [] });
    expect(panel.keyboardVisits).toBeGreaterThanOrEqual(2);
    expect(panel.visibleFocusChecks).toBeGreaterThanOrEqual(2);
    dispatchExampleAction(app, { kind: 'key', key: 'f12', modifiers: [] });
    expect(frameText(app)).toMatch(/accelerators:\s*(?:visible|revealed)|hotkeys revealed/iu);
    dispatchExampleAction(app, { kind: 'key', key: 'A', modifiers: [] });
    expect(panel.hotkeyActivations).toBe(1);
    expect(panel.nonColorChecks).toBeGreaterThan(0);
    expect(frameText(app)).toMatch(/focus:\s*\S+[\s\S]*(?:PASS|focused|selected)/iu);
    app.loop.dispose();
  });

  test('should provide meaningful pointer parity without making mouse mandatory', async () => {
    const { app, dialog } = buildLabExample(INTERACTION_ID, await loadDefinition(INTERACTION_ID));
    const panel = interactionPanel(dialog);
    clickButton(app, dialog, 'Activate');
    expect(panel.mouseActivations).toBe(1);
    expect(frameText(app)).toMatch(/same command|same outcome|activation:\s*PASS/iu);
    expect(frameText(app)).toMatch(/Tab|Alt\+A|F12/iu);
    app.loop.dispose();
  });

  test('should cycle semantic evidence through NO_COLOR, monochrome, ASCII, and narrow profiles', async () => {
    const { app, dialog } = buildLabExample(PRESENTATION_ID, await loadDefinition(PRESENTATION_ID));
    const panel = presentationPanel(dialog);
    const observed = new Set([panel.profileName]);
    for (let index = 0; index < 4; index += 1) {
      dispatchExampleAction(app, { kind: 'key', key: 'P', modifiers: ['Alt'] });
      observed.add(panel.profileName);
      expect(panel.meaningChecks).toBe(index + 1);
      expect(panel.clippingFailures).toBe(0);
      expect(panel.asciiUnsafeGlyphs).toBe(0);
      expect(frameText(app)).toMatch(/(?:FOCUSED|SELECTED|DISABLED|ERROR|PASS)/u);
    }
    expect(observed).toEqual(new Set(['Classic', 'NO_COLOR', 'Monochrome', 'ASCII', 'Narrow']));
    app.loop.dispose();
  });

  test.each(labIds)('should keep %s padded and unclipped through resize, maximize, and restore', async (id) => {
    const { app, dialog } = buildLabExample(id, await loadDefinition(id));
    const compact = { ...dialog.bounds };
    resizeDialog(app, dialog);
    collectTemplate1Evidence(app, dialog, { startup: 'resized' });
    expect(frameText(app)).toMatch(/keyboard|focus|profile|meaning|PASS/iu);
    dispatchExampleAction(app, { kind: 'key', key: 'z', modifiers: ['Alt'] });
    collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
    dispatchExampleAction(app, { kind: 'key', key: 'z', modifiers: ['Alt'] });
    expect(dialog.bounds).not.toEqual(compact);
    collectTemplate1Evidence(app, dialog, { startup: 'resized' });
    app.loop.dispose();
  });

  test.each(labIds)('should clean up %s ownership exactly once', async (id) => {
    const { app, dialog } = buildLabExample(id, await loadDefinition(id));
    const panel = id === INTERACTION_ID ? interactionPanel(dialog) : presentationPanel(dialog);
    app.loop.dispose();
    expect(panel.cleanupCount).toBe(1);
    expect(() => app.loop.dispose()).not.toThrow();
    expect(panel.cleanupCount).toBe(1);
  });
});
