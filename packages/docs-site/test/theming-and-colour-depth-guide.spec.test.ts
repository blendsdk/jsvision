/**
 * Immutable oracle for the Theming & colour depth course and its two laboratories.
 *
 * Public controls prove semantic theme construction, contrast checks, application switching, and
 * depth-aware rendering. Course and laboratory assertions describe the final learner-visible result.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  Attr,
  ScreenBuffer,
  classicTheme,
  contrastRatio,
  createTheme,
  encodeStyle,
  monochromeTheme,
  nordTheme,
  resolveCapabilities,
  serialize,
} from '@jsvision/core';
import type { Theme, ThemeOptions, ThemeRole } from '@jsvision/core';
import { Button, View, createApplication, createRoot } from '@jsvision/ui';
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

const guidePath = fileURLToPath(new URL('../guide/theming-and-colour-depth.md', import.meta.url));
const catalogPath = fileURLToPath(new URL('../guides.json', import.meta.url));
const source = existsSync(guidePath) ? readFileSync(guidePath, 'utf8') : '';
const catalog = parseGuideCatalog(readFileSync(catalogPath, 'utf8'));
const guide = catalog.entries.find((candidate) => candidate.id === 'theming-and-colour-depth');
const rolesLabId = 'guides/theme-role-states';
const depthLabId = 'guides/color-depth-fallbacks';
const labIds = [rolesLabId, depthLabId] as const;

interface ThemeRoleStatesPanel extends View {
  readonly lessonName: 'Semantic theme roles and states';
  readonly themeSwitches: number;
  readonly roleChecks: number;
  readonly contrastChecks: number;
  readonly currentTheme: Theme;
  readonly currentThemeName: string;
}

interface ColourDepthPanel extends View {
  readonly lessonName: 'Colour depth degradation';
  readonly depthChanges: number;
  readonly monochromeChecks: number;
  readonly asciiChecks: number;
  readonly cleanupCount: number;
  readonly currentDepth: 'truecolor' | '256' | '16' | 'mono';
  readonly currentEncoderEvidence: string;
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

function isRolesPanel(view: View): view is ThemeRoleStatesPanel {
  return (
    view.constructor.name === 'ThemeRoleStatesPanel' &&
    'lessonName' in view &&
    view.lessonName === 'Semantic theme roles and states' &&
    'themeSwitches' in view &&
    typeof view.themeSwitches === 'number' &&
    'roleChecks' in view &&
    typeof view.roleChecks === 'number' &&
    'contrastChecks' in view &&
    typeof view.contrastChecks === 'number'
  );
}

function isDepthPanel(view: View): view is ColourDepthPanel {
  return (
    view.constructor.name === 'ColourDepthPanel' &&
    'lessonName' in view &&
    view.lessonName === 'Colour depth degradation' &&
    'depthChanges' in view &&
    typeof view.depthChanges === 'number' &&
    'monochromeChecks' in view &&
    typeof view.monochromeChecks === 'number' &&
    'asciiChecks' in view &&
    typeof view.asciiChecks === 'number' &&
    'cleanupCount' in view &&
    typeof view.cleanupCount === 'number'
  );
}

function rolesPanelIn(dialog: View): ThemeRoleStatesPanel {
  const panel = viewsIn(dialog).find(isRolesPanel);
  if (panel === undefined) throw new Error('Theme-role laboratory is missing its teaching panel');
  return panel;
}

function depthPanelIn(dialog: View): ColourDepthPanel {
  const panel = viewsIn(dialog).find(isDepthPanel);
  if (panel === undefined) throw new Error('Colour-depth laboratory is missing its teaching panel');
  return panel;
}

function viewNamed(dialog: View, name: string): View {
  const view = viewsIn(dialog).find((candidate) => candidate.constructor.name === name);
  if (view === undefined) throw new Error(`Laboratory is missing ${name}`);
  return view;
}

function expectRoleStrip(app: ReturnType<typeof buildLabExample>['app'], dialog: View, theme: Theme): void {
  const strip = viewNamed(dialog, 'RoleStateStrip');
  const origin = absoluteOrigin(strip);
  const samples = [
    { x: 1, role: theme.button },
    { x: 15, role: theme.buttonFocused },
    { x: 29, role: theme.listSelected },
    { x: 43, role: theme.buttonDisabled },
  ] as const;
  for (const sample of samples) {
    expect(app.loop.renderRoot.buffer().get(origin.x + sample.x, origin.y)).toMatchObject({
      fg: sample.role.fg,
      bg: sample.role.bg,
      attrs: sample.role.attrs ?? Attr.none,
    });
  }
}

function encoderEvidence(depth: 'truecolor' | '256' | '16' | 'mono'): string {
  const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: depth } }).profile;
  return encodeStyle('#3b82f6', '#101827', Attr.reverse, caps).replace('\u001b[', '').replace('m', '') || 'none';
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
    to: { x: from.x + 10, y: from.y + 4 },
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

describe('Theming & colour depth course contract', () => {
  test('should publish the completed catalog course with exact prerequisite, outcomes, and labs', () => {
    expect(source).not.toBe('');
    expect(guide).toMatchObject({
      title: 'Theming & colour depth',
      page: '/guide/theming-and-colour-depth',
      profile: 'course',
      stage: 'complete',
      prerequisites: ['application-shell'],
      learningOutcomes: [
        'Author semantic themes and select exact roles for component states.',
        'Preserve contrast and meaning through truecolor, 256-color, 16-color, and monochrome degradation.',
      ],
      requiredLiveExamples: 2,
      liveExampleException: null,
      examples: [...labIds],
    });
    expect(source).toContain('](/guide/application-shell)');
  });

  test('should state the learner contract and follow the complete question-led backbone', () => {
    const sections = [
      '## Who is this course for?',
      '## What is the theme mental model?',
      '## How do I create and apply my first theme?',
      '## Laboratory: semantic roles and states',
      '## How do I choose exact semantic roles?',
      '## How do seeds, aliases, and role overrides differ?',
      '## How do I verify concrete contrast?',
      '## How does theming integrate with an application?',
      '## Laboratory: colour-depth degradation',
      '## How does rendering degrade across colour depths?',
      '## What belongs in advanced theme design?',
      '## How do I diagnose theme failures?',
      '## What are the best practices?',
      '## What should I practice next?',
    ];
    let previous = -1;
    for (const section of sections) {
      const index = source.indexOf(section);
      expect(index, `missing or misplaced ${section}`).toBeGreaterThan(previous);
      previous = index;
    }
    expect(source).toMatch(/^description:\s*.+(?:theme|roles).+(?:contrast|colour depth|monochrome)/imu);
    expect(source).toMatch(/\bbuild\b[\s\S]*\bexplain\b[\s\S]*\bdiagnos(?:e|is)\b[\s\S]*\bverify\b/iu);
    expect(source).toContain(`<PlayExample id="${rolesLabId}"`);
    expect(source).toContain(`<PlayExample id="${depthLabId}"`);
  });

  test('should teach semantic authoring, exact roles, overrides, contrast, and application switching', () => {
    expect(source).toMatch(/\bTheme\b[\s\S]{0,250}\bThemeRole\b[\s\S]{0,250}\bThemeOptions\b/iu);
    expect(source).toMatch(/createTheme\([\s\S]{0,400}mode:[\s\S]{0,200}accent:/iu);
    expect(source).toMatch(/semantic[\s\S]{0,300}(?:button|list|menu|dialog)[A-Z][A-Za-z]+/iu);
    expect(source).toMatch(/normal[\s\S]{0,250}(?:focused|selected)[\s\S]{0,250}disabled/iu);
    expect(source).toMatch(/overrides[\s\S]{0,450}(?:alias|every role|re-drives)[\s\S]{0,450}roleOverrides/iu);
    expect(source).toMatch(/roleOverrides[\s\S]{0,350}(?:surgical|one role|field-level)/iu);
    expect(source).toMatch(/contrastRatio\([\s\S]{0,300}(?:concrete|hex|resolvable)/iu);
    expect(source).toMatch(/(?:default|unresolvable)[\s\S]{0,250}NaN[\s\S]{0,250}(?:skip|cannot verify)/iu);
    expect(source).toMatch(/classicTheme[\s\S]{0,300}monochromeTheme/iu);
    expect(source).toMatch(/app\.setTheme\(/u);
  });

  test('should teach capability-owned depth degradation without manual quantization', () => {
    expect(source).toMatch(/truecolor[\s\S]{0,150}256[\s\S]{0,150}16[\s\S]{0,150}mono(?:chrome)?/iu);
    expect(source).toMatch(/(?:renderer|serializer)[\s\S]{0,400}(?:downsample|quantiz|encode)/iu);
    expect(source).toMatch(/(?:capability|caps)\.colorDepth|colorDepth/iu);
    expect(source).toMatch(
      /(?:do not|never|avoid)[\s\S]{0,350}(?:manual|your own)[\s\S]{0,250}(?:downsampl|quantiz)/iu,
    );
    expect(source).toMatch(/mono(?:chrome)?[\s\S]{0,350}(?:no colour|no color)[\s\S]{0,350}(?:attrs|attribute)/iu);
    expect(source).toMatch(/(?:focus|selected|disabled|error)[\s\S]{0,500}(?:text|glyph|border|attribute|label)/iu);
    expect(source).toMatch(/ASCII[\s\S]{0,350}(?:fallback|safe|meaning)/iu);
  });

  test('should keep snippets public and close with failure diagnosis, practice, and owning links', () => {
    const code = snippets();
    expect(code.length).toBeGreaterThanOrEqual(10);
    for (const snippet of code) {
      expect(snippet.split('\n').filter((line) => line.trim() !== '').length).toBeLessThanOrEqual(28);
      expect(snippet).not.toMatch(/(?:demoApp|Template1Dialog|defineExample|packages\/(?:core|ui)\/src)/u);
      for (const imported of snippet.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu)) {
        expect(['@jsvision/core', '@jsvision/ui']).toContain(imported[1]);
      }
    }
    const joined = code.join('\n');
    for (const api of ['createTheme', 'contrastRatio', 'classicTheme', 'monochromeTheme', 'setTheme']) {
      expect(joined).toMatch(new RegExp(`\\b${api}\\b`, 'u'));
    }
    expect(source).toMatch(/symptom[\s\S]{0,300}cause[\s\S]{0,300}(?:correction|fix)[\s\S]{0,300}evidence/iu);
    expect(source).toMatch(/(?:exercise|experiment)[\s\S]{0,800}(?:role|contrast|mono|depth)/iu);
    expect(source).toContain('](/components/application/application)');
    expect(source).toContain('](/api/core/functions/createTheme)');
    expect(source).toContain('](/api/core/functions/contrastRatio)');
  });
});

describe('public theming and depth controls taught by the course', () => {
  test('should generate full themes, distinguish alias and role overrides, and switch an application', () => {
    const options: ThemeOptions = { mode: 'dark', accent: '#3b82f6' };
    const base: Theme = createTheme(options);
    const alias = createTheme({ ...options, overrides: { accent: '#ff0000' } });
    const role = createTheme({ ...options, roleOverrides: { buttonFocused: { bg: '#010203' } } });
    const selected: ThemeRole = role.buttonFocused;
    expect(alias.button.bg).toBe('#ff0000');
    expect(alias.listFocused.bg).toBe('#ff0000');
    expect(selected.bg).toBe('#010203');
    expect(role.button.bg).toBe(base.button.bg);

    const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
    const app = createApplication({ caps, theme: classicTheme, viewport: { width: 20, height: 6 } });
    expect(() => app.setTheme(role)).not.toThrow();
    app.loop.dispose();
  });

  test('should calculate only concrete contrast and keep presets meaningful without colour', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 2);
    expect(contrastRatio('#3b82f6', '#3b82f6')).toBeCloseTo(1, 2);
    expect(Number.isNaN(contrastRatio('default', '#ffffff'))).toBe(true);
    expect(monochromeTheme.listFocused.fg).toBe(monochromeTheme.listNormal.fg);
    expect(monochromeTheme.listFocused.bg).toBe(monochromeTheme.listNormal.bg);
    expect(monochromeTheme.listFocused.attrs).not.toBe(monochromeTheme.listNormal.attrs);
  });

  test.each([
    ['truecolor', '38;2;255;0;0'],
    ['256', '38;5;9'],
    ['16', '[91m'],
  ] as const)('should let the serializer encode %s depth', (depth, marker) => {
    const current = new ScreenBuffer(2, 1, { fg: 'default', bg: 'default' });
    current.set(0, 0, 'X', { fg: 'brightRed', bg: 'default' });
    const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: depth } }).profile;
    expect(serialize(current, null, { caps })).toContain(marker);
  });

  test('should emit attributes but no colour sequence at monochrome depth', () => {
    const current = new ScreenBuffer(2, 1, { fg: 'default', bg: 'default' });
    current.set(0, 0, 'X', {
      fg: '#ff0000',
      bg: '#0000ff',
      attrs: Attr.bold | Attr.underline,
    });
    const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'mono' } }).profile;
    const output = serialize(current, null, { caps });
    expect(output).toContain('\x1b[1;4m');
    expect(output).not.toMatch(/(?:38|48);(?:2|5)/u);
  });
});

describe('Theming & colour depth laboratory contract', () => {
  test('should register two applications with objective-specific titles and blurbs', async () => {
    expect(registryEntry(rolesLabId)).toMatchObject({
      kind: 'app',
      sourcePath: 'examples/guides/theme-role-states.ts',
    });
    expect(registryEntry(depthLabId)).toMatchObject({
      kind: 'app',
      sourcePath: 'examples/guides/color-depth-fallbacks.ts',
    });
    const roles = await loadDefinition(rolesLabId);
    const depth = await loadDefinition(depthLabId);
    expect(roles.title).toMatch(/Semantic Theme (?:Roles|States) (?:Laboratory|Workshop)/iu);
    expect(roles.blurb).toMatch(/role[\s\S]*state[\s\S]*(?:switch|theme)[\s\S]*contrast/iu);
    expect(depth.title).toMatch(/Colou?r Depth (?:Fallbacks|Degradation|Resilience) (?:Laboratory|Workshop)/iu);
    expect(depth.blurb).toMatch(/truecolor[\s\S]*256[\s\S]*16[\s\S]*mono[\s\S]*ASCII/iu);
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
      app.loop.dispose();
      dispose();
    });
  });

  test.each(labIds)('should remain padded at constrained size and through resize, maximize, restore', async (id) => {
    const definition = await loadDefinition(id);
    createRoot((dispose) => {
      const constrained = buildLabExample(id, definition, { viewport: { width: 64, height: 20 } });
      collectTemplate1Evidence(constrained.app, constrained.dialog);
      constrained.app.loop.dispose();

      const { app, dialog } = buildLabExample(id, definition, { viewport: { width: 120, height: 40 } });
      resizeDialog(app, dialog);
      const resized = { ...dialog.bounds };
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      dialog.zoom();
      app.loop.renderRoot.flush();
      expect(dialog.bounds).toEqual(resized);
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      app.loop.dispose();
      dispose();
    });
  });

  test('should switch semantic role states and themes with visible contrast evidence', async () => {
    const definition = await loadDefinition(rolesLabId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(rolesLabId, definition);
      const panel = rolesPanelIn(dialog);
      const retainedPanel = panel;
      const retainedFocus = app.loop.getFocused();
      expect(frameText(app)).toMatch(/Theme:\s*Classic[\s\S]*(?:normal|focused|selected|disabled)/iu);
      expectRoleStrip(app, dialog, classicTheme);
      app.loop.dispatch(key('r', { alt: true }));
      expect(panel.roleChecks).toBe(1);
      expect(frameText(app)).toMatch(/Role check:\s*pass/iu);
      app.loop.dispatch(key('c', { alt: true }));
      expect(panel.contrastChecks).toBe(1);
      expect(frameText(app)).toMatch(/Contrast:\s*(?:pass|ratio)/iu);
      app.loop.emitCommand('demo.theme.3');
      app.loop.renderRoot.flush();
      expect(panel.currentThemeName).toBe('Nord');
      expect(panel.currentTheme).toBe(nordTheme);
      expect(rolesPanelIn(dialog)).toBe(retainedPanel);
      expect(app.loop.getFocused()).toBe(retainedFocus);
      expectRoleStrip(app, dialog, nordTheme);
      app.loop.dispatch(key('r', { alt: true }));
      app.loop.dispatch(key('c', { alt: true }));
      expect(panel.roleChecks).toBe(2);
      expect(panel.contrastChecks).toBe(2);
      app.loop.dispatch(key('t', { alt: true }));
      expect(panel.themeSwitches).toBe(2);
      expect(panel.currentThemeName).toBe('Classic');
      expectRoleStrip(app, dialog, classicTheme);
      clickButton(app, dialog, 'Switch theme');
      expect(frameText(app)).toMatch(/Action source:\s*mouse/iu);
      app.loop.dispose();
      dispose();
    });
  });

  test('should traverse every depth and preserve monochrome and ASCII-safe meaning', async () => {
    const definition = await loadDefinition(depthLabId);
    let panel: ColourDepthPanel | undefined;
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(depthLabId, definition);
      panel = depthPanelIn(dialog);
      expect(frameText(app)).toMatch(/Depth:\s*truecolor/iu);
      expect(panel.currentEncoderEvidence).toBe(encoderEvidence('truecolor'));
      for (const expected of ['256', '16', 'mono'] as const) {
        app.loop.dispatch(key('d', { alt: true }));
        expect(frameText(app)).toMatch(new RegExp(`Depth:\\s*${expected}`, 'iu'));
        expect(panel.currentDepth).toBe(expected);
        expect(panel.currentEncoderEvidence).toBe(encoderEvidence(expected));
      }
      expect(panel.depthChanges).toBe(3);
      expect(panel.monochromeChecks).toBe(1);
      const preview = viewNamed(dialog, 'DepthPreviewStrip');
      const previewOrigin = absoluteOrigin(preview);
      expect(app.loop.renderRoot.buffer().get(previewOrigin.x + 42, previewOrigin.y)).toMatchObject({
        char: '>',
        fg: 'default',
        bg: 'default',
        attrs: Attr.reverse,
      });
      expect(frameText(app)).toMatch(/State cue:\s*>\s*marks selected depth/iu);
      app.loop.dispatch(key('a', { alt: true }));
      expect(panel.asciiChecks).toBe(1);
      expect(frameText(app)).toMatch(/ASCII:\s*(?:on|safe)[\s\S]*(?:PASS|selected|focused)/iu);
      clickButton(app, dialog, 'Next depth');
      expect(frameText(app)).toMatch(/Action source:\s*mouse/iu);
      app.loop.dispose();
      dispose();
    });
    expect(panel?.cleanupCount).toBe(1);
  });
});
