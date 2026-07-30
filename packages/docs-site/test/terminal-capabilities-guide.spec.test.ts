/**
 * Immutable oracle for the Terminal capabilities & portability course and its two laboratories.
 *
 * The course owns capability evidence and runtime adaptation. Theme authorship and general
 * accessible interaction remain with their prerequisite courses.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ScreenBuffer,
  degradeCapsFully,
  dumpCaps,
  evaluateEssentials,
  fallbackGlyph,
  resolveCapabilities,
  resolveCapabilitiesAsync,
  serialize,
} from '@jsvision/core';
import type { CapabilityProfile, CapabilityResolution, TerminalQuery } from '@jsvision/core';
import { Button, View } from '@jsvision/ui';
import { buildBrowserCaps } from '@jsvision/web';
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
  viewsIn,
} from './example-lab-harness.js';

const guidePath = fileURLToPath(new URL('../guide/terminal-capabilities.md', import.meta.url));
const catalogPath = fileURLToPath(new URL('../guides.json', import.meta.url));
const source = existsSync(guidePath) ? readFileSync(guidePath, 'utf8') : '';
const catalog = parseGuideCatalog(readFileSync(catalogPath, 'utf8'));
const guide = catalog.entries.find((candidate) => candidate.id === 'terminal-capabilities');
const RESOLUTION_ID = 'guides/capability-resolution';
const FALLBACK_ID = 'guides/portable-fallbacks';
const labIds = [RESOLUTION_ID, FALLBACK_ID] as const;
const style = { fg: '#ffffff' as const, bg: '#000000' as const };

interface CapabilityResolutionPanel extends View {
  readonly lessonName: 'Capability resolution evidence';
  readonly scenarioName: 'Unknown' | 'Environment' | 'Runtime query' | 'Override';
  readonly scenarioChanges: number;
  readonly evidenceChecks: number;
  readonly unsupportedClaims: number;
  readonly passthroughBytes: number;
  readonly resolution: CapabilityResolution;
  readonly cleanupCount: number;
}

interface PortableFallbackPanel extends View {
  readonly lessonName: 'Portable fallback evidence';
  readonly profileName:
    'Rich' | 'Monochrome' | 'No mouse' | 'ASCII' | 'SSH' | 'tmux' | 'Windows' | 'Browser' | 'Narrow';
  readonly profileChanges: number;
  readonly renderedChecks: number;
  readonly unsupportedClaims: number;
  readonly clippingFailures: number;
  readonly profile: CapabilityProfile;
  readonly renderedGlyphs: string;
  readonly keyboardAvailable: boolean;
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

function resolutionPanel(dialog: View): CapabilityResolutionPanel {
  const panel = viewsIn(dialog).find(
    (view): view is CapabilityResolutionPanel =>
      'lessonName' in view && view.lessonName === 'Capability resolution evidence',
  );
  if (panel === undefined) throw new Error('the capability-resolution laboratory is missing its panel');
  return panel;
}

function fallbackPanel(dialog: View): PortableFallbackPanel {
  const panel = viewsIn(dialog).find(
    (view): view is PortableFallbackPanel => 'lessonName' in view && view.lessonName === 'Portable fallback evidence',
  );
  if (panel === undefined) throw new Error('the portable-fallback laboratory is missing its panel');
  return panel;
}

function clickButton(app: ReturnType<typeof buildLabExample>['app'], dialog: View, label: string): void {
  const button = viewsIn(dialog).find(
    (view): view is Button => view instanceof Button && view.activation.label === label,
  );
  if (button === undefined) throw new Error(`the capability laboratory is missing "${label}"`);
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

describe('Terminal capabilities & portability course contract', () => {
  test('should publish the completed catalog course with two outcome-shaped laboratories', () => {
    expect(source).not.toBe('');
    expect(guide).toMatchObject({
      title: 'Terminal capabilities & portability',
      group: 'Operating a real app',
      page: '/guide/terminal-capabilities',
      profile: 'course',
      stage: 'complete',
      sidebarOrder: 5,
      prerequisites: ['theming-and-colour-depth', 'crash-safety'],
      learningOutcomes: [
        'Explain capability detection, profiles, queries, overrides, and degradations.',
        'Adapt applications honestly across SSH, tmux, Windows, browser, color, mouse, and glyph differences.',
      ],
      requiredLiveExamples: 2,
      liveExampleException: null,
      examples: [...labIds],
    });
    expect(source).toContain('](/guide/theming-and-colour-depth)');
    expect(source).toContain('](/guide/crash-safety)');
    for (const id of labIds) expect(source).toContain(`<PlayExample id="${id}"`);
  });

  test('should state the learner contract and follow the complete question-led course backbone', () => {
    const sections = [
      '## Who is this course for?',
      '## What is the capability mental model?',
      '## How do I get the first useful profile?',
      '## Laboratory: explain a capability resolution',
      '## What is inside a capability profile?',
      '## How does synchronous detection work?',
      '## When should I run live terminal queries?',
      '## When is an explicit override honest?',
      '## How do essential failures differ from degradations?',
      '## Laboratory: adapt through portable fallbacks',
      '## How do SSH and multiplexers change the evidence?',
      '## What is different on Windows and in a browser?',
      '## How do colour, mouse, Unicode, and glyph fallbacks compose?',
      '## How do I preserve behavior at reduced geometry?',
      '## How do I compose capabilities with hosts and rendering?',
      '## What belongs in advanced capability handling?',
      '## How do I diagnose capability failures?',
      '## What are the best practices?',
      '## What should I practice next?',
    ];
    let previous = -1;
    for (const section of sections) {
      const index = source.indexOf(section);
      expect(index, `missing or misplaced ${section}`).toBeGreaterThan(previous);
      previous = index;
    }
    expect(source).toMatch(/^description:\s*.+(?:detect|profile).+(?:query|override).+(?:fallback|portab)/imu);
    expect(source).toMatch(/\bbuild\b[\s\S]*\bexplain\b[\s\S]*\bdiagnos(?:e|is)\b[\s\S]*\bverify\b/iu);
  });

  test('should teach profiles and reasons as immutable evidence rather than ambient guesses', () => {
    expect(source).toMatch(/CapabilityProfile[\s\S]{0,450}(?:colorDepth|mouse|unicode|osc|glyphs|platform)/u);
    expect(source).toMatch(
      /CapabilityResolution[\s\S]{0,350}(?:profile|reasons)[\s\S]{0,250}(?:immutable|frozen|readonly)/iu,
    );
    expect(source).toMatch(/(?:override|runtime|env|table|default)[\s\S]{0,450}(?:reason|layer|decided)/iu);
    expect(source).toMatch(/(?:nested|group)[\s\S]{0,300}(?:reason|top-level)[\s\S]{0,250}(?:mouse|unicode|glyph)/iu);
    expect(source).toMatch(
      /dumpCaps\([\s\S]{0,350}(?:one-line|reason|layer)[\s\S]{0,250}(?:safe|no input|secret-free)/iu,
    );
    expect(source).toMatch(/(?:never|do not)[\s\S]{0,300}(?:mutate|assign)[\s\S]{0,250}(?:profile|capabilities)/iu);
  });

  test('should distinguish synchronous environment detection from optional live queries', () => {
    expect(source).toMatch(
      /resolveCapabilities\([\s\S]{0,400}(?:synchronous|environment|table)[\s\S]{0,250}(?:cache|cached)/iu,
    );
    expect(source).toMatch(
      /(?:env|platform|override)[\s\S]{0,350}(?:inject|hermetic|deterministic)[\s\S]{0,250}(?:test|fixture)/iu,
    );
    expect(source).toMatch(
      /resolveCapabilitiesAsync\([\s\S]{0,400}(?:query|runtime|probe)[\s\S]{0,250}(?:fresh|not cached)/iu,
    );
    expect(source).toMatch(/createTerminalQuery\([\s\S]{0,350}(?:raw mode|flowing|close|cleanup)/iu);
    expect(source).toMatch(/(?:timeout|silent|garbage|too much)[\s\S]{0,400}(?:fallback|never rejects|environment)/iu);
    expect(source).toMatch(
      /passthrough[\s\S]{0,350}(?:typed|keystroke|input bytes)[\s\S]{0,250}(?:decoder|first|order)/iu,
    );
  });

  test('should teach precedence and overrides without turning tests into production claims', () => {
    expect(source).toMatch(/(?:override)[\s\S]{0,300}(?:wins|highest|deep-merge)[\s\S]{0,250}(?:reason|override)/iu);
    expect(source).toMatch(/NO_COLOR[\s\S]{0,300}(?:forced|wins|outranks)[\s\S]{0,250}(?:runtime|query|probe)/iu);
    expect(source).toMatch(/(?:FORCE_COLOR|COLORTERM|TERM)[\s\S]{0,450}(?:env|table|soft|forced)/iu);
    expect(source).toMatch(/(?:screenshot|test|known host)[\s\S]{0,350}(?:valid|honest)[\s\S]{0,250}override/iu);
    expect(source).toMatch(
      /(?:do not|never|avoid)[\s\S]{0,350}(?:force|override)[\s\S]{0,250}(?:unsupported|wish|assume)/iu,
    );
    expect(source).toMatch(
      /(?:override)[\s\S]{0,350}(?:does not|cannot)[\s\S]{0,250}(?:add|change)[\s\S]{0,200}(?:terminal|host) support/iu,
    );
  });

  test('should separate terminal essentials from independent degradation decisions', () => {
    expect(source).toMatch(/(?:interactive TTY)[\s\S]{0,350}(?:essential|hard requirement)/iu);
    expect(source).toMatch(/evaluateEssentials\([\s\S]{0,350}(?:met|missing|degradations)/iu);
    expect(source).toMatch(/(?:no mouse|mouse unavailable)[\s\S]{0,250}keyboard-only/iu);
    expect(source).toMatch(/(?:mono|no colou?r)[\s\S]{0,250}monochrome/iu);
    expect(source).toMatch(/(?:no alternate screen|altScreen)[\s\S]{0,250}inline/iu);
    expect(source).toMatch(
      /(?:degradation|fallback)[\s\S]{0,300}(?:not|does not)[\s\S]{0,200}(?:failed startup|refuse to start|fatal)/iu,
    );
    expect(source).toMatch(
      /(?:unknown|uncertain)[\s\S]{0,350}(?:conservative|fallback|measure)[\s\S]{0,250}(?:not unsupported|not false|do not claim)/iu,
    );
  });

  test('should explain SSH and tmux as boundaries that narrow what evidence proves', () => {
    expect(source).toMatch(/SSH[\s\S]{0,400}(?:remote|server)[\s\S]{0,250}(?:TERM|COLORTERM|locale|environment)/iu);
    expect(source).toMatch(
      /SSH[\s\S]{0,400}(?:does not|cannot)[\s\S]{0,250}(?:identify|prove|guarantee)[\s\S]{0,200}(?:local terminal|feature)/iu,
    );
    expect(source).toMatch(/(?:tmux|screen)[\s\S]{0,350}multiplexer[\s\S]{0,250}(?:TERM|TMUX)/iu);
    expect(source).toMatch(/multiplexer[\s\S]{0,350}(?:flag|true)[\s\S]{0,250}(?:policy|passthrough|conservative)/iu);
    expect(source).toMatch(
      /(?:tmux|multiplexer)[\s\S]{0,350}(?:not|does not)[\s\S]{0,250}(?:prove|guarantee)[\s\S]{0,200}(?:OSC|colour|color|keyboard)/iu,
    );
    expect(source).toMatch(
      /(?:query|probe)[\s\S]{0,350}(?:through|inside)[\s\S]{0,250}(?:SSH|tmux|remote)[\s\S]{0,250}(?:actual path|current session)/iu,
    );
  });

  test('should explain platform and browser profiles without pretending they are equivalent', () => {
    expect(source).toMatch(
      /Windows[\s\S]{0,400}(?:modern-console|baseline|win32)[\s\S]{0,250}(?:truecolor|Unicode|mouse|alternate)/iu,
    );
    expect(source).toMatch(/Windows[\s\S]{0,350}(?:default reason|reason.*default)[\s\S]{0,250}(?:rich|baseline)/iu);
    expect(source).toMatch(
      /buildBrowserCaps\([\s\S]{0,400}(?:injected|known host|xterm)[\s\S]{0,250}(?:truecolor|UTF-8|mouse)/iu,
    );
    expect(source).toMatch(
      /browser[\s\S]{0,400}(?:does not|not)[\s\S]{0,250}(?:process\.env|native query|TTY signal)/iu,
    );
    expect(source).toMatch(
      /(?:browser lab|documentation terminal)[\s\S]{0,400}(?:simulate|fixture|profile)[\s\S]{0,250}(?:not proof|does not prove|bounded evidence)/iu,
    );
    expect(source).toMatch(/(?:host|runtime)[\s\S]{0,350}(?:owns|supplies)[\s\S]{0,250}(?:capability profile|facts)/iu);
  });

  test('should adapt rendered output and interaction to color, mouse, Unicode, and glyph facts', () => {
    expect(source).toMatch(/colorDepth[\s\S]{0,350}(?:truecolor|256|16|mono)[\s\S]{0,250}(?:downsample|serialize)/iu);
    expect(source).toMatch(
      /(?:mouse\.sgr|mouse)[\s\S]{0,300}(?:keyboard|command)[\s\S]{0,250}(?:fallback|always|still)/iu,
    );
    expect(source).toMatch(/unicode[\s\S]{0,350}(?:utf8|widthMode|emoji)[\s\S]{0,250}(?:unknown|wide|narrow)/iu);
    expect(source).toMatch(/fallbackGlyph\([\s\S]{0,350}(?:box|block|arrow)[\s\S]{0,250}ASCII/iu);
    expect(source).toMatch(/degradeCapsFully\([\s\S]{0,300}(?:ASCII|boxDrawing|halfBlocks|ambiguousWide)/iu);
    expect(source).toMatch(
      /(?:rendered frame|buffer|cell evidence)[\s\S]{0,400}(?:profile|fallback)[\s\S]{0,250}(?:assert|verify|observe)/iu,
    );
  });

  test('should integrate reduced geometry, cleanup, diagnosis, and evidence scope', () => {
    expect(source).toMatch(
      /(?:reduced|narrow)[\s\S]{0,350}(?:geometry|viewport)[\s\S]{0,250}(?:reflow|wrap|clip|priority)/iu,
    );
    expect(source).toMatch(
      /(?:keyboard|command)[\s\S]{0,350}(?:reachable|available)[\s\S]{0,250}(?:no mouse|narrow)/iu,
    );
    expect(source).toMatch(/(?:close|cleanup|dispose)[\s\S]{0,350}(?:query|listener|timer|host)/iu);
    expect(source).toMatch(
      /(?:symptom|failure)[\s\S]{0,350}(?:wrong color|missing mouse|garbled glyph|clipping|lost input)[\s\S]{0,350}(?:reason|evidence)/iu,
    );
    expect(source).toMatch(
      /(?:observed|measured|fixture|simulated)[\s\S]{0,350}(?:scope|environment|host)[\s\S]{0,250}(?:not guarantee|not universal|bounded)/iu,
    );
    expect(source).toMatch(
      /(?:security|diagnostic)[\s\S]{0,350}(?:redact|secret|path|environment)[\s\S]{0,250}(?:dumpCaps|safe)/iu,
    );
  });

  test('should preserve prerequisite ownership and keep snippets concise and public', () => {
    expect(source).not.toMatch(
      /^## How do I (?:create a theme|choose semantic roles|design keyboard-complete interaction)/imu,
    );
    expect(source).toMatch(/(?:theme authoring|palette|contrast)[\s\S]{0,300}\]\/guide\/theming-and-colour-depth\)/iu);
    expect(source).toMatch(/(?:keyboard completeness|focus|non-color)[\s\S]{0,300}\]\/guide\/accessibility\)/iu);
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
      'resolveCapabilities',
      'resolveCapabilitiesAsync',
      'createTerminalQuery',
      'dumpCaps',
      'evaluateEssentials',
      'buildBrowserCaps',
      'fallbackGlyph',
      'degradeCapsFully',
    ]) {
      expect(joined).toMatch(new RegExp(`\\b${api}\\b`, 'u'));
    }
    expect(source).toMatch(/symptom[\s\S]{0,300}cause[\s\S]{0,300}(?:correction|fix)[\s\S]{0,300}evidence/iu);
    expect(source).toMatch(
      /(?:exercise|experiment)[\s\S]{0,1500}(?:query|override|SSH|tmux|Windows|browser|ASCII|mouse)/iu,
    );
    expect(source).toContain('](/api/core/functions/resolveCapabilities)');
    expect(source).toContain('](/api/core/functions/resolveCapabilitiesAsync)');
    expect(source).toContain('](/api/web/functions/buildBrowserCaps)');
  });
});

describe('public capability controls taught by the course', () => {
  test('should return a frozen conservative resolution and mark explicit overrides', () => {
    const conservative = resolveCapabilities({ env: {}, platform: 'linux' });
    expect(Object.isFrozen(conservative.profile)).toBe(true);
    expect(Object.isFrozen(conservative.reasons)).toBe(true);
    expect(conservative.profile.colorDepth).toBe('16');
    expect(conservative.profile.mouse.sgr).toBe(false);
    expect(conservative.reasons.colorDepth).toBe('default');

    const forced = resolveCapabilities({
      env: {},
      platform: 'linux',
      override: {
        colorDepth: '256',
        mouse: { sgr: true },
        glyphs: { boxDrawing: true },
      },
    });
    expect(forced.profile.colorDepth).toBe('256');
    expect(forced.profile.mouse).toMatchObject({ sgr: true, drag: false, wheel: false });
    expect(forced.reasons.colorDepth).toBe('override');
    expect(forced.reasons.mouse).toBe('override');
    expect(forced.reasons.glyphs).toBe('override');
  });

  test('should preserve precedence and identify tmux without inventing extra support', () => {
    const resolution = resolveCapabilities({
      env: {
        NO_COLOR: '',
        FORCE_COLOR: '3',
        COLORTERM: 'truecolor',
        TERM: 'tmux-256color',
        TMUX: '/tmp/tmux-session',
      },
      platform: 'linux',
    });
    expect(resolution.profile.colorDepth).toBe('mono');
    expect(resolution.reasons.colorDepth).toBe('env');
    expect(resolution.profile.multiplexer).toBe(true);
    expect(resolution.reasons.multiplexer).toBe('env');
    expect(resolution.profile.osc.clipboard52).toBe(false);
  });

  test('should keep live-query evidence fresh and preserve unrelated input bytes', async () => {
    const encoder = new TextEncoder();
    const query: TerminalQuery = {
      write: () => {},
      async *read() {
        yield encoder.encode('\x1b[?2026;2$yq');
      },
    };
    const resolution = await resolveCapabilitiesAsync({
      env: {},
      platform: 'linux',
      query,
      timeoutMs: 20,
    });
    expect(resolution.profile.sync2026).toBe(true);
    expect(resolution.reasons.sync2026).toBe('runtime');
    expect(new TextDecoder().decode(resolution.passthrough)).toBe('q');
  });

  test('should distinguish Windows and browser host facts', () => {
    const windows = resolveCapabilities({ env: {}, platform: 'win32' });
    expect(windows.profile).toMatchObject({
      platform: 'win32',
      colorDepth: 'truecolor',
      unicode: { utf8: true },
      mouse: { sgr: true },
      altScreen: true,
    });
    expect(windows.reasons.colorDepth).toBe('default');

    const browser = buildBrowserCaps({ colorDepth: '16' });
    expect(browser).toMatchObject({
      platform: 'linux',
      colorDepth: '16',
      unicode: { utf8: true },
      mouse: { sgr: true, drag: true, wheel: true },
      bracketedPaste: true,
    });
  });

  test('should render authentic degraded evidence without making no-mouse fatal', () => {
    const degraded = resolveCapabilities({
      env: {},
      platform: 'linux',
      override: {
        colorDepth: 'mono',
        mouse: { sgr: false, drag: false, wheel: false },
        unicode: { utf8: false, widthMode: 'wcwidth', emoji: 'unknown' },
        glyphs: { boxDrawing: false, halfBlocks: false, ambiguousWide: true },
        altScreen: false,
      },
    });
    const report = evaluateEssentials(degraded.profile, { isTTY: true });
    expect(report.met).toBe(true);
    expect(report.degradations.map((item) => item.mode)).toEqual(['keyboard-only', 'monochrome', 'inline']);
    const ascii = degradeCapsFully(degraded.profile);
    expect(fallbackGlyph('│', ascii)).toBe('|');
    expect(fallbackGlyph('█', ascii)).toBe('#');

    const buffer = new ScreenBuffer(12, 1, style);
    buffer.text(0, 0, 'STATE: OK', style);
    const rendered = serialize(buffer, null, { caps: ascii });
    expect(rendered).toContain('STATE: OK');
    expect(dumpCaps(degraded)).toContain('mouse=- (override)');
  });
});

describe('Terminal capability laboratories contract', () => {
  test('should register two distinct accurately described application laboratories', async () => {
    expect(registryEntry(RESOLUTION_ID)).toMatchObject({
      id: RESOLUTION_ID,
      kind: 'app',
      themeMenu: true,
      sourcePath: 'examples/guides/capability-resolution.ts',
    });
    expect(registryEntry(FALLBACK_ID)).toMatchObject({
      id: FALLBACK_ID,
      kind: 'app',
      themeMenu: true,
      sourcePath: 'examples/guides/portable-fallbacks.ts',
    });
    const resolution = await loadDefinition(RESOLUTION_ID);
    const fallback = await loadDefinition(FALLBACK_ID);
    expect(resolution.blurb).toMatch(/profile.+reason.+query.+override/iu);
    expect(fallback.blurb).toMatch(/SSH.+tmux.+Windows.+browser.+mouse.+glyph/iu);
  });

  test.each(labIds)('should open %s as a centered compact Classic template1 application', async (id) => {
    const { app, dialog } = buildLabExample(id, await loadDefinition(id));
    const evidence = collectTemplate1Evidence(app, dialog);
    expect(evidence.viewport).toEqual({ width: 80, height: 24 });
    expect(evidence.dialogInterior.join('\n')).toMatch(/profile|reason|evidence|fallback/iu);
    app.loop.dispose();
  });

  test('should explain unknown, environment, query, and override scenarios by keyboard', async () => {
    const { app, dialog } = buildLabExample(RESOLUTION_ID, await loadDefinition(RESOLUTION_ID));
    const panel = resolutionPanel(dialog);
    const observed = new Set([panel.scenarioName]);
    for (let index = 0; index < 3; index += 1) {
      dispatchExampleAction(app, { kind: 'key', key: 'E', modifiers: ['Alt'] });
      observed.add(panel.scenarioName);
      expect(panel.evidenceChecks).toBe(index + 1);
      expect(panel.unsupportedClaims).toBe(0);
      const expectedReason =
        panel.scenarioName === 'Environment'
          ? 'env'
          : panel.scenarioName === 'Runtime query'
            ? 'runtime'
            : panel.scenarioName === 'Override'
              ? 'override'
              : 'default';
      expect(Object.values(panel.resolution.reasons)).toContain(expectedReason);
      expect(frameText(app)).toContain(`colorDepth=${panel.resolution.profile.colorDepth}`);
      expect(frameText(app)).toContain(`(${panel.resolution.reasons.colorDepth})`);
    }
    expect(observed).toEqual(new Set(['Unknown', 'Environment', 'Runtime query', 'Override']));
    expect(panel.passthroughBytes).toBeGreaterThanOrEqual(0);
    app.loop.dispose();
  });

  test('should provide mouse parity for evidence inspection without accessing visitor state', async () => {
    const { app, dialog } = buildLabExample(RESOLUTION_ID, await loadDefinition(RESOLUTION_ID));
    const panel = resolutionPanel(dialog);
    clickButton(app, dialog, 'Explain next');
    expect(panel.scenarioChanges).toBe(1);
    expect(panel.evidenceChecks).toBe(1);
    expect(frameText(app)).toMatch(/deterministic fixture|no live query|simulated/iu);
    app.loop.dispose();
  });

  test('should adapt honestly across all declared portable profiles', async () => {
    const { app, dialog } = buildLabExample(FALLBACK_ID, await loadDefinition(FALLBACK_ID));
    const panel = fallbackPanel(dialog);
    const observed = new Set([panel.profileName]);
    for (let index = 0; index < 8; index += 1) {
      dispatchExampleAction(app, { kind: 'key', key: 'P', modifiers: ['Alt'] });
      observed.add(panel.profileName);
      expect(panel.renderedChecks).toBe(index + 1);
      expect(panel.unsupportedClaims).toBe(0);
      expect(panel.clippingFailures).toBe(0);
      expect(panel.keyboardAvailable).toBe(true);
      const expectedBorder = fallbackGlyph('│', panel.profile);
      const expectedBlock = fallbackGlyph('█', panel.profile);
      expect(panel.renderedGlyphs).toContain(expectedBorder);
      expect(panel.renderedGlyphs).toContain(expectedBlock);
      expect(frameText(app)).toContain(panel.renderedGlyphs);
      expect(frameText(app)).toMatch(/(?:keyboard-only|mono|ASCII|remote|multiplexer|win32|browser|narrow|rich)/iu);
    }
    expect(observed).toEqual(
      new Set(['Rich', 'Monochrome', 'No mouse', 'ASCII', 'SSH', 'tmux', 'Windows', 'Browser', 'Narrow']),
    );
    app.loop.dispose();
  });

  test.each(labIds)('should keep %s padded and unclipped through resize, maximize, and restore', async (id) => {
    const { app, dialog } = buildLabExample(id, await loadDefinition(id));
    const compact = { ...dialog.bounds };
    resizeDialog(app, dialog);
    collectTemplate1Evidence(app, dialog, { startup: 'resized' });
    expect(frameText(app)).toMatch(/profile|evidence|fallback|reason/iu);
    dispatchExampleAction(app, { kind: 'key', key: 'z', modifiers: ['Alt'] });
    collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
    dispatchExampleAction(app, { kind: 'key', key: 'z', modifiers: ['Alt'] });
    expect(dialog.bounds).not.toEqual(compact);
    collectTemplate1Evidence(app, dialog, { startup: 'resized' });
    app.loop.dispose();
  });

  test.each(labIds)('should clean up %s ownership exactly once', async (id) => {
    const { app, dialog } = buildLabExample(id, await loadDefinition(id));
    const panel = id === RESOLUTION_ID ? resolutionPanel(dialog) : fallbackPanel(dialog);
    app.loop.dispose();
    expect(panel.cleanupCount).toBe(1);
    expect(() => app.loop.dispose()).not.toThrow();
    expect(panel.cleanupCount).toBe(1);
  });
});
