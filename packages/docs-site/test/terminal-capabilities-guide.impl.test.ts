/**
 * Implementation hardening for the terminal-capabilities course laboratories.
 *
 * These cases extend the immutable course contract with conservative unknown input, independent
 * colour/mouse/glyph degradations, reduced host geometry, sequence wraparound, and post-disposal
 * inertia.
 */
import { degradeCapsFully, fallbackGlyph, isAsciiSafe, resolveCapabilities } from '@jsvision/core';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { buildBrowserCaps } from '@jsvision/web';
import type { ExampleDefinition } from '../examples/_contract.js';
import { EXAMPLES } from '../examples/index.js';
import { CapabilityResolutionPanel } from '../src/example-fixtures/terminal-capabilities/capability-resolution-panel.js';
import { PortableFallbackPanel } from '../src/example-fixtures/terminal-capabilities/portable-fallback-panel.js';
import {
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  viewsIn,
} from './example-lab-harness.js';

const RESOLUTION_ID = 'guides/capability-resolution';
const FALLBACK_ID = 'guides/portable-fallbacks';
const GUIDE_SOURCE = readFileSync(fileURLToPath(new URL('../guide/terminal-capabilities.md', import.meta.url)), 'utf8');

/** Load a registered Guide laboratory through the learner-facing lazy boundary. */
async function definition(id: string): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(`missing example registry entry: ${id}`);
  return (await entry.load()).default;
}

/** Find the mounted resolution-evidence panel. */
function resolutionPanel(dialog: ReturnType<typeof buildLabExample>['dialog']): CapabilityResolutionPanel {
  const panel = viewsIn(dialog).find(
    (view): view is CapabilityResolutionPanel => view instanceof CapabilityResolutionPanel,
  );
  if (panel === undefined) throw new Error('missing capability-resolution panel');
  return panel;
}

/** Find the mounted portable-fallback panel. */
function fallbackPanel(dialog: ReturnType<typeof buildLabExample>['dialog']): PortableFallbackPanel {
  const panel = viewsIn(dialog).find((view): view is PortableFallbackPanel => view instanceof PortableFallbackPanel);
  if (panel === undefined) throw new Error('missing portable-fallback panel');
  return panel;
}

describe('terminal-capabilities course laboratory hardening', () => {
  test('keeps an unknown Linux fixture conservative without claiming unsupported facts', () => {
    const resolution = resolveCapabilities({ env: {}, platform: 'linux' });
    expect(resolution.profile.colorDepth).toBe('16');
    expect(resolution.profile.mouse.sgr).toBe(false);
    expect(resolution.reasons.colorDepth).toBe('default');
    expect(resolution.reasons.mouse).toBe('default');
    expect(Object.isFrozen(resolution.profile)).toBe(true);
    expect(Object.isFrozen(resolution.reasons)).toBe(true);
  });

  test('keeps monochrome, no-mouse, and ASCII degradation axes independent', () => {
    const monochrome = resolveCapabilities({
      env: { NO_COLOR: '', FORCE_COLOR: '3', TERM: 'xterm-256color' },
      platform: 'linux',
      override: { mouse: { sgr: true } },
    }).profile;
    expect(monochrome.colorDepth).toBe('mono');
    expect(monochrome.mouse.sgr).toBe(true);

    const noMouse = resolveCapabilities({
      env: { COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' },
      platform: 'linux',
      override: { mouse: { sgr: false, drag: false, wheel: false } },
    }).profile;
    expect(noMouse.colorDepth).toBe('truecolor');
    expect(noMouse.unicode.utf8).toBe(true);
    expect(noMouse.mouse.sgr).toBe(false);

    const ascii = degradeCapsFully(noMouse);
    expect(isAsciiSafe(ascii)).toBe(true);
    expect(ascii.colorDepth).toBe('truecolor');
    expect(fallbackGlyph('│', ascii)).toBe('|');
    expect(fallbackGlyph('█', ascii)).toBe('#');
    expect(fallbackGlyph('►', ascii)).toBe('>');
  });

  test('keeps query and browser snippets aligned with their public option objects', () => {
    expect(GUIDE_SOURCE).toMatch(
      /createTerminalQuery\(\{\s*input:\s*process\.stdin,\s*output:\s*process\.stdout,\s*\}\)/u,
    );
    expect(GUIDE_SOURCE).not.toMatch(/createTerminalQuery\(process\.stdin/u);
    const browserOptions = GUIDE_SOURCE.match(/const caps = buildBrowserCaps\(\{([\s\S]*?)\}\);/u)?.[1];
    expect(browserOptions).toContain("colorDepth: 'truecolor'");
    expect(browserOptions).not.toMatch(/\b(?:utf8|mouse)\s*:/u);
    expect(buildBrowserCaps({ colorDepth: '16' })).toMatchObject({
      colorDepth: '16',
      unicode: { utf8: true },
      mouse: { sgr: true },
    });
  });

  test('wraps all capability-resolution scenarios with authentic reason evidence', async () => {
    const { app, dialog } = buildLabExample(RESOLUTION_ID, await definition(RESOLUTION_ID));
    const panel = resolutionPanel(dialog);
    await panel.whenRuntimeReady();
    for (let index = 0; index < 4; index += 1) {
      dispatchExampleAction(app, { kind: 'key', key: 'e', modifiers: ['Alt'] });
      expect(panel.unsupportedClaims).toBe(0);
      expect(Object.isFrozen(panel.resolution.profile)).toBe(true);
      expect(Object.isFrozen(panel.resolution.reasons)).toBe(true);
    }
    expect(panel.scenarioName).toBe('Unknown');
    expect(panel.scenarioChanges).toBe(4);
    expect(panel.evidenceChecks).toBe(4);
    expect(frameText(app)).toMatch(/default observed.+PASS/iu);
    app.loop.dispose();
  });

  test('wraps all portable profiles with draw-derived glyph and clipping evidence', async () => {
    const { app, dialog } = buildLabExample(FALLBACK_ID, await definition(FALLBACK_ID));
    const panel = fallbackPanel(dialog);
    for (let index = 0; index < 9; index += 1) {
      dispatchExampleAction(app, { kind: 'key', key: 'p', modifiers: ['Alt'] });
      expect(panel.unsupportedClaims).toBe(0);
      expect(panel.clippingFailures).toBe(0);
      expect(panel.renderedGlyphs).toBe(`${fallbackGlyph('│', panel.profile)}${fallbackGlyph('█', panel.profile)}`);
      expect(panel.keyboardAvailable).toBe(true);
    }
    expect(panel.profileName).toBe('Rich');
    expect(panel.profileChanges).toBe(9);
    expect(panel.renderedChecks).toBe(9);
    app.loop.dispose();
  });

  test.each([RESOLUTION_ID, FALLBACK_ID])('keeps %s compact and legible in a reduced 68x20 host', async (id) => {
    const { app, dialog } = buildLabExample(id, await definition(id), {
      viewport: { width: 68, height: 20 },
    });
    const evidence = collectTemplate1Evidence(app, dialog);
    expect(evidence.viewport).toEqual({ width: 68, height: 20 });
    expect(frameText(app)).toMatch(/(?:Scenario|Profile):[\s\S]+(?:Evidence|Fallback|PASS)/u);
    app.loop.dispose();
  });

  test('rejects resolution transitions after owner disposal', async () => {
    const { app, dialog } = buildLabExample(RESOLUTION_ID, await definition(RESOLUTION_ID));
    const panel = resolutionPanel(dialog);
    app.loop.dispose();
    panel.explainNext();
    expect(panel.scenarioName).toBe('Unknown');
    expect(panel.scenarioChanges).toBe(0);
    expect(panel.evidenceChecks).toBe(0);
    expect(panel.cleanupCount).toBe(1);
  });

  test('rejects fallback transitions after owner disposal', async () => {
    const { app, dialog } = buildLabExample(FALLBACK_ID, await definition(FALLBACK_ID));
    const panel = fallbackPanel(dialog);
    app.loop.dispose();
    panel.nextProfile();
    expect(panel.profileName).toBe('Rich');
    expect(panel.profileChanges).toBe(0);
    expect(panel.renderedChecks).toBe(0);
    expect(panel.cleanupCount).toBe(1);
  });
});
