/**
 * Immutable oracle for the Displaying untrusted text safely course and comparison laboratory.
 *
 * The course must distinguish rendering sanitization from diagnostic redaction, preserve legitimate
 * Unicode, and avoid claims that control-byte removal validates content or removes secrets.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ScreenBuffer, createLogger, redactEvent, resolveCapabilities, sanitize, serialize } from '@jsvision/core';
import { Button, View } from '@jsvision/ui';
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

const guidePath = fileURLToPath(new URL('../guide/untrusted-text.md', import.meta.url));
const catalogPath = fileURLToPath(new URL('../guides.json', import.meta.url));
const source = existsSync(guidePath) ? readFileSync(guidePath, 'utf8') : '';
const catalog = parseGuideCatalog(readFileSync(catalogPath, 'utf8'));
const guide = catalog.entries.find((candidate) => candidate.id === 'untrusted-text');
const LAB_ID = 'guides/untrusted-text-boundary';
const style = { fg: 'default' as const, bg: 'default' as const };
const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', unicode: { utf8: true, widthMode: 'wcwidth', emoji: 'wide' } },
}).profile;

interface UntrustedTextPanel extends View {
  readonly lessonName: 'Untrusted text boundary';
  readonly sampleIndex: number;
  readonly sanitizations: number;
  readonly redactions: number;
  readonly unsafeControlCount: number;
  readonly renderedControlCount: number;
  readonly leakedPayloads: number;
  readonly cleanupCount: number;
}

function snippets(): string[] {
  return [...source.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/gu)].map((match) => match[1] ?? '');
}

function registryEntry() {
  return EXAMPLES.find((candidate) => candidate.id === LAB_ID);
}

async function loadDefinition(): Promise<ExampleDefinition> {
  const entry = registryEntry();
  if (entry === undefined) throw new Error(`missing example registry entry: ${LAB_ID}`);
  return (await entry.load()).default;
}

function panelIn(dialog: View): UntrustedTextPanel {
  const panel = viewsIn(dialog).find(
    (view): view is UntrustedTextPanel => 'lessonName' in view && view.lessonName === 'Untrusted text boundary',
  );
  if (panel === undefined) throw new Error('the untrusted-text laboratory is missing its comparison panel');
  return panel;
}

function clickButton(app: ReturnType<typeof buildLabExample>['app'], dialog: View, label: string): void {
  const button = viewsIn(dialog).find(
    (view): view is Button => view instanceof Button && view.activation.label === label,
  );
  if (button === undefined) throw new Error(`the untrusted-text laboratory is missing "${label}"`);
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
    to: { x: corner.x + 10, y: corner.y + 3 },
  });
}

describe('Displaying untrusted text safely course contract', () => {
  test('should publish the completed catalog-owned course and its single application laboratory', () => {
    expect(source).not.toBe('');
    expect(guide).toMatchObject({
      title: 'Displaying untrusted text safely',
      group: 'Operating a real app',
      page: '/guide/untrusted-text',
      profile: 'course',
      stage: 'complete',
      sidebarOrder: 3,
      prerequisites: ['text-unicode-and-cells', 'debugging'],
      learningOutcomes: [
        'Identify terminal-injection and sensitive-log threats at every raw text boundary.',
        'Use built-in sanitization, explicit sanitization, and redaction without making false security claims.',
      ],
      requiredLiveExamples: 1,
      liveExampleException: null,
      examples: [LAB_ID],
    });
    expect(source).toContain('](/guide/text-unicode-and-cells)');
    expect(source).toContain('](/guide/debugging)');
    expect(source).toContain(`<PlayExample id="${LAB_ID}"`);
    expect(EXAMPLES.filter((candidate) => candidate.id === LAB_ID)).toHaveLength(1);
  });

  test('should state the learner contract and follow a complete question-led course backbone', () => {
    const sections = [
      '## Who is this course for?',
      '## What is the untrusted-text mental model?',
      '## How do I get the first safe result?',
      '## Laboratory: inspect the text boundary',
      '## Where does raw text enter an application?',
      '## What does terminal injection look like?',
      '## What does sanitize remove and preserve?',
      '## Which JSVision paths sanitize automatically?',
      '## When must I sanitize explicitly?',
      '## Why is redaction a different boundary?',
      '## How do multiline text and terminal cells affect safety?',
      '## How do I compose safety with widgets and hosts?',
      '## What belongs in advanced boundary design?',
      '## How do I diagnose unsafe text handling?',
      '## What are the best practices?',
      '## What should I practice next?',
    ];
    let previous = -1;
    for (const section of sections) {
      const index = source.indexOf(section);
      expect(index, `missing or misplaced ${section}`).toBeGreaterThan(previous);
      previous = index;
    }
    expect(source).toMatch(/^description:\s*.+(?:untrusted|injection).+(?:sanitize|redact).+(?:terminal|log)/imu);
    expect(source).toMatch(/\bbuild\b[\s\S]*\bexplain\b[\s\S]*\bdiagnos(?:e|is)\b[\s\S]*\bverify\b/iu);
  });

  test('should map every raw-text source to a deliberate display and diagnostic boundary', () => {
    for (const boundary of ['paste', 'filename', 'network', 'process', 'terminal response']) {
      expect(source).toMatch(new RegExp(`\\b${boundary}\\b`, 'iu'));
    }
    expect(source).toMatch(/(?:raw text|untrusted data)[\s\S]{0,350}(?:display|draw|screen) boundary/iu);
    expect(source).toMatch(/(?:raw input|event|payload)[\s\S]{0,350}(?:diagnostic|log) boundary/iu);
    expect(source).toMatch(
      /(?:ownership|data flow|source)[\s\S]{0,450}(?:sanitize|redact)[\s\S]{0,300}(?:sink|screen|log)/iu,
    );
    expect(source).toMatch(/(?:bound|limit|maximum)[\s\S]{0,350}(?:before|at)[\s\S]{0,250}(?:store|render|log)/iu);
  });

  test('should explain injection as terminal control rather than dangerous-looking printable text', () => {
    expect(source).toMatch(/(?:ESC|\\x1b)[\s\S]{0,250}(?:CSI|OSC|control sequence)/iu);
    expect(source).toMatch(/(?:BEL|\\x07|String Terminator|C0|C1)[\s\S]{0,350}(?:control|terminat)/iu);
    expect(source).toMatch(
      /(?:title|hyperlink|clipboard|alternate screen|cursor|erase)[\s\S]{0,450}(?:inject|hijack|change)/iu,
    );
    expect(source).toMatch(
      /(?:printable|literal)[\s\S]{0,350}(?:bracket 31 m|parameters|sequence tail)[\s\S]{0,250}(?:harmless|inert|visible)/iu,
    );
    expect(source).toMatch(
      /(?:escaped notation|code points|byte names)[\s\S]{0,350}(?:show|inspect|display)[\s\S]{0,250}(?:unsafe|raw)/iu,
    );
    expect(source).toMatch(
      /(?:never|do not)[\s\S]{0,300}(?:replay|write)[\s\S]{0,250}(?:hostile|raw)[\s\S]{0,200}(?:terminal|stdout)/iu,
    );
  });

  test('should teach the exact sanitizer rule without overclaiming', () => {
    expect(source).toMatch(/sanitize\([\s\S]{0,450}(?:pure|returns)[\s\S]{0,250}(?:control|ESC)/iu);
    expect(source).toMatch(/(?:strips|removes)[\s\S]{0,350}(?:ESC|BEL)[\s\S]{0,300}(?:C0|C1)/iu);
    expect(source).toMatch(/(?:preserves|keeps)[\s\S]{0,300}(?:tab|newline)[\s\S]{0,300}(?:Unicode|emoji|printable)/iu);
    expect(source).toMatch(
      /(?:does not|not)[\s\S]{0,300}(?:remove|consume)[\s\S]{0,250}(?:printable parameters|bracket 31 m|sequence tail)/iu,
    );
    expect(source).toMatch(
      /(?:does not|not)[\s\S]{0,350}(?:validate|authorize|escape)[\s\S]{0,250}(?:URL|shell|HTML|SQL|path)/iu,
    );
    expect(source).toMatch(
      /(?:does not|not)[\s\S]{0,300}(?:redact|remove)[\s\S]{0,250}(?:secret|token|personal|sensitive)/iu,
    );
    expect(source).toMatch(
      /(?:sanitization|sanitize)[\s\S]{0,300}(?:not|separate)[\s\S]{0,250}(?:bounding|length|size|validation)/iu,
    );
  });

  test('should distinguish built-in draw safety from explicit raw-host obligations', () => {
    expect(source).toMatch(
      /(?:ScreenBuffer|DrawContext|ctx\.text)[\s\S]{0,400}(?:automatically|built-in)[\s\S]{0,250}sanitiz/iu,
    );
    expect(source).toMatch(/(?:Text|Label|window title|widget)[\s\S]{0,350}(?:draw|buffer)[\s\S]{0,250}sanitiz/iu);
    expect(source).toMatch(/(?:setTitle|notify|hyperlink)[\s\S]{0,400}(?:sanitiz|safe field)/iu);
    expect(source).toMatch(
      /(?:output\.write|stdout|custom host|raw stream)[\s\S]{0,400}(?:explicitly|call)[\s\S]{0,250}sanitize/iu,
    );
    expect(source).toMatch(
      /setClipboard[\s\S]{0,450}(?:byte-exact|base64|encoded)[\s\S]{0,300}(?:not pre-sanitized|does not sanitize|preserves)/iu,
    );
    expect(source).toMatch(/(?:do not|avoid)[\s\S]{0,350}(?:double sanitiz|sanitiz.*every layer)/iu);
  });

  test('should treat diagnostic redaction as content removal rather than terminal sanitization', () => {
    expect(source).toMatch(/redactEvent\([\s\S]{0,350}(?:printable|character)[\s\S]{0,250}(?:drop|remove)/iu);
    expect(source).toMatch(
      /(?:paste|pasted)[\s\S]{0,300}(?:length|truncated)[\s\S]{0,250}(?:not|never)[\s\S]{0,150}text/iu,
    );
    expect(source).toMatch(/createLogger\([\s\S]{0,350}(?:ring|file|screen-safe)[\s\S]{0,250}(?:size|bounded)/iu);
    expect(source).toMatch(/sanitize\([\s\S]{0,300}(?:token|secret)[\s\S]{0,250}(?:still|remain|not safe to log)/iu);
    expect(source).toMatch(
      /(?:redact|allowlist)[\s\S]{0,350}(?:field|metadata|identifier)[\s\S]{0,250}(?:before|log)/iu,
    );
    expect(source).toMatch(
      /(?:never|do not)[\s\S]{0,350}(?:clipboard|paste|keystroke|file content)[\s\S]{0,250}(?:log|diagnostic)/iu,
    );
  });

  test('should integrate multiline geometry, accessibility, lifecycle, and failure recovery', () => {
    expect(source).toMatch(
      /(?:tab|newline)[\s\S]{0,350}(?:cell|line|wrap|layout)[\s\S]{0,250}(?:clip|bound|height|width)/iu,
    );
    expect(source).toMatch(/(?:Unicode|emoji|combining|wide)[\s\S]{0,350}(?:preserv|width|cell)/iu);
    expect(source).toMatch(/(?:unsafe|sanitized)[\s\S]{0,350}(?:label|heading|non-color|text cue)/iu);
    expect(source).toMatch(/(?:keyboard|hotkey)[\s\S]{0,350}(?:focus|reachable|button)/iu);
    expect(source).toMatch(/(?:cleanup|dispose|onCleanup)[\s\S]{0,350}(?:subscription|timer|resource|owner)/iu);
    expect(source).toMatch(/(?:symptom|failure)[\s\S]{0,350}(?:control|clipping|secret|double sanitiz)/iu);
  });

  test('should keep snippets concise and public and close with diagnosis, practices, and exercises', () => {
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
    for (const api of [
      'sanitize',
      'ScreenBuffer',
      'redactEvent',
      'createLogger',
      'setTitle',
      'notify',
      'hyperlink',
      'setClipboard',
    ]) {
      expect(joined).toMatch(new RegExp(`\\b${api}\\b`, 'u'));
    }
    expect(source).toMatch(/symptom[\s\S]{0,300}cause[\s\S]{0,300}(?:correction|fix)[\s\S]{0,300}evidence/iu);
    expect(source).toMatch(/(?:consequence|otherwise|because)[\s\S]{0,900}(?:sanitize|redact|bound|raw stream)/iu);
    expect(source).toMatch(/(?:exercise|experiment)[\s\S]{0,1200}(?:ESC|multiline|Unicode|redact|buffer)/iu);
    expect(source).toContain('](/api/core/functions/sanitize)');
    expect(source).toContain('](/api/core/functions/redactEvent)');
    expect(source).toContain('](/api/core/functions/createLogger)');
    expect(source).toContain('](/api/core/classes/ScreenBuffer)');
  });
});

describe('public untrusted-text controls taught by the course', () => {
  test('should strip terminal controls while preserving printable Unicode, tabs, and newlines', () => {
    const hostile = 'café 世界 😀\tA\x1b]0;pwned\x07\nB\x9cC\x01D\x7fE';
    const safe = sanitize(hostile);
    expect(safe).toBe('café 世界 😀\tA]0;pwned\nBCD\x7fE');
    expect(safe).not.toContain('\x1b');
    expect(safe).not.toContain('\x07');
    expect(safe).not.toContain('\x9c');
    expect(safe).toContain('\t');
    expect(safe).toContain('\n');
  });

  test('should make raw and pre-sanitized text render to identical terminal cells', () => {
    const hostile = 'file\x1b]8;;https://evil.invalid\x07.txt';
    const safe = sanitize(hostile);
    const render = (text: string): string => {
      const buffer = new ScreenBuffer(48, 1, style);
      buffer.text(0, 0, text, style);
      return serialize(buffer, null, { caps });
    };
    expect(render(hostile)).toBe(render(safe));
    const buffer = new ScreenBuffer(48, 1, style);
    buffer.text(0, 0, hostile, style);
    const cells = buffer
      .rows()[0]
      ?.map((cell) => cell.char)
      .join('');
    expect(cells).not.toContain('\x1b');
    expect(cells).not.toContain('\x07');
    expect(cells).toContain(']8;;https://evil.invalid.txt');
  });

  test('should redact sensitive input content and retain only bounded structural evidence', () => {
    const secret = 'visitor-secret-token';
    const logger = createLogger({ sink: 'ring', size: 2 });
    logger.debug('input', 'paste', {
      event: redactEvent({ type: 'paste', text: secret, truncated: false }),
    });
    logger.debug('input', 'key', {
      event: redactEvent({
        type: 'key',
        key: 's',
        codepoint: 115,
        ctrl: false,
        alt: false,
        shift: false,
      }),
    });
    logger.info('boundary', 'sanitized', { controlsRemoved: 2 });

    expect(logger.entries()).toHaveLength(2);
    expect(JSON.stringify(logger.entries())).not.toContain(secret);
    expect(JSON.stringify(logger.entries())).not.toContain('"key":"s"');
    expect(logger.entries()[0]?.fields).toEqual({
      event: { type: 'key', printable: true, ctrl: false, alt: false, shift: false },
    });
  });

  test('should prove that sanitization is not secret redaction or input validation', () => {
    const secretUrl = 'https://example.invalid/?token=visitor-secret';
    expect(sanitize(secretUrl)).toBe(secretUrl);
    expect(sanitize('../../private/report.txt')).toBe('../../private/report.txt');
    expect(sanitize("'; DROP TABLE users; --")).toBe("'; DROP TABLE users; --");
  });
});

describe('Untrusted text boundary laboratory contract', () => {
  test('should register one accurately described application comparison laboratory', async () => {
    expect(registryEntry()).toMatchObject({
      id: LAB_ID,
      kind: 'app',
      themeMenu: true,
      sourcePath: 'examples/guides/untrusted-text-boundary.ts',
    });
    const definition = await loadDefinition();
    expect(definition.title).toMatch(/untrusted|sanitiz|text boundary/iu);
    expect(definition.blurb).toMatch(/unsafe.+sanitized.+redact/iu);
  });

  test('should open as a centered compact Classic template1 comparison', async () => {
    const { app, dialog } = buildLabExample(LAB_ID, await loadDefinition());
    const evidence = collectTemplate1Evidence(app, dialog);
    const interior = evidence.dialogInterior.join('\n');
    expect(interior).toMatch(/unsafe input|escaped input/iu);
    expect(interior).toMatch(/sanitized output/iu);
    expect(interior).toMatch(/ESC|BEL|C0|control/iu);
    expect(interior).toMatch(/rendered controls:\s*0/iu);
    expect(frameText(app)).not.toContain('\x1b');
    app.loop.dispose();
  });

  test('should sanitize and redact through reachable keyboard actions with exact feedback', async () => {
    const { app, dialog } = buildLabExample(LAB_ID, await loadDefinition());
    const panel = panelIn(dialog);
    expect(panel.unsafeControlCount).toBeGreaterThan(0);
    expect(panel.renderedControlCount).toBe(0);
    dispatchExampleAction(app, { kind: 'key', key: 'S', modifiers: ['Alt'] });
    expect(panel.sanitizations).toBe(1);
    expect(panel.renderedControlCount).toBe(0);
    expect(frameText(app)).toMatch(/sanitize(?:d|r):\s*(?:PASS|OK)|controls removed/iu);
    dispatchExampleAction(app, { kind: 'key', key: 'R', modifiers: ['Alt'] });
    expect(panel.redactions).toBe(1);
    expect(panel.leakedPayloads).toBe(0);
    expect(frameText(app)).toMatch(/redaction:\s*(?:PASS|OK)|payloads leaked:\s*0/iu);
    app.loop.dispose();
  });

  test('should switch bounded hostile fixtures by keyboard and sanitize by mouse', async () => {
    const { app, dialog } = buildLabExample(LAB_ID, await loadDefinition());
    const panel = panelIn(dialog);
    const before = panel.sampleIndex;
    dispatchExampleAction(app, { kind: 'key', key: 'N', modifiers: ['Alt'] });
    expect(panel.sampleIndex).not.toBe(before);
    expect(frameText(app)).toMatch(/(?:OSC|CSI|multiline|Unicode|controls)/iu);
    clickButton(app, dialog, 'Sanitize');
    expect(panel.sanitizations).toBe(1);
    expect(panel.renderedControlCount).toBe(0);
    app.loop.dispose();
  });

  test('should remain padded and unclipped through resize, maximize, and restore', async () => {
    const { app, dialog } = buildLabExample(LAB_ID, await loadDefinition());
    const compact = { ...dialog.bounds };
    resizeDialog(app, dialog);
    collectTemplate1Evidence(app, dialog, { startup: 'resized' });
    expect(frameText(app)).toMatch(/unsafe|sanitized|Alt\+S/iu);
    dispatchExampleAction(app, { kind: 'key', key: 'z', modifiers: ['Alt'] });
    collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
    expect(frameText(app)).toMatch(/rendered controls:\s*0/iu);
    dispatchExampleAction(app, { kind: 'key', key: 'z', modifiers: ['Alt'] });
    expect(dialog.bounds).not.toEqual(compact);
    collectTemplate1Evidence(app, dialog, { startup: 'resized' });
    app.loop.dispose();
  });

  test('should expose non-colour safety cues and clean up owned work exactly once', async () => {
    const { app, dialog } = buildLabExample(LAB_ID, await loadDefinition());
    const panel = panelIn(dialog);
    expect(frameText(app)).toMatch(/(?:UNSAFE|SAFE|PASS|WARN)[\s\S]*(?:controls|payload|escaped)/iu);
    app.loop.dispose();
    expect(panel.cleanupCount).toBe(1);
    expect(() => app.loop.dispose()).not.toThrow();
    expect(panel.cleanupCount).toBe(1);
  });
});
