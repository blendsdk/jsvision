/**
 * Immutable oracle for the Debugging course and its evidence-ladder laboratory.
 *
 * The course must teach diagnosis as a repeatable observation process. Public controls pin safe,
 * bounded diagnostics and real geometry, focus, event, rendering, capability, and cleanup evidence.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createLogger, dumpCaps, redactEvent, resolveCapabilities } from '@jsvision/core';
import { Button, Group, View, createEventLoop } from '@jsvision/ui';
import type { DispatchEvent, DrawContext, Size2D } from '@jsvision/ui';
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

const guidePath = fileURLToPath(new URL('../guide/debugging.md', import.meta.url));
const catalogPath = fileURLToPath(new URL('../guides.json', import.meta.url));
const source = existsSync(guidePath) ? readFileSync(guidePath, 'utf8') : '';
const catalog = parseGuideCatalog(readFileSync(catalogPath, 'utf8'));
const guide = catalog.entries.find((candidate) => candidate.id === 'debugging');
const LAB_ID = 'guides/debugging-evidence';
const capsResolution = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: {
    colorDepth: 'truecolor',
    unicode: { utf8: true, widthMode: 'wcwidth', emoji: 'narrow' },
  },
});
const caps = capsResolution.profile;

interface DebuggingEvidencePanel extends View {
  readonly lessonName: 'Debugging evidence ladder';
  readonly layoutDiagnoses: number;
  readonly focusDiagnoses: number;
  readonly commandDiagnoses: number;
  readonly renderDiagnoses: number;
  readonly capabilityDiagnoses: number;
  readonly lifecycleDiagnoses: number;
  readonly corrections: number;
  readonly diagnosticCount: number;
  readonly diagnosticCapacity: number;
  readonly leakedPayloads: number;
  readonly cleanupCount: number;
}

class EvidenceProbe extends View {
  events = 0;
  draws = 0;
  cleanups = 0;

  constructor() {
    super();
    this.focusable = true;
    this.onMount(() => {
      this.onCleanup(() => {
        this.cleanups += 1;
      });
    });
  }

  override measure(available: Size2D): Size2D {
    return { width: Math.min(12, available.width), height: Math.min(1, available.height) };
  }

  override draw(ctx: DrawContext): void {
    this.draws += 1;
    ctx.fill(' ', ctx.color(this.state.focused ? 'buttonFocused' : 'button'));
    ctx.text(0, 0, `events:${this.events}`, ctx.color(this.state.focused ? 'buttonFocused' : 'button'));
  }

  override onEvent(event: DispatchEvent): void {
    if (event.event.type === 'key' && event.event.key === 'x') {
      this.events += 1;
      event.handled = true;
      this.invalidate();
    }
  }
}

function snippets(): string[] {
  return [...source.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/gu)].map((match) => match[1] ?? '');
}

async function loadDefinition(): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === LAB_ID);
  if (entry === undefined) throw new Error(`missing example registry entry: ${LAB_ID}`);
  return (await entry.load()).default;
}

function panelIn(dialog: ReturnType<typeof buildLabExample>['dialog']): DebuggingEvidencePanel {
  const panel = viewsIn(dialog).find(
    (view): view is DebuggingEvidencePanel => 'lessonName' in view && view.lessonName === 'Debugging evidence ladder',
  );
  if (panel === undefined) throw new Error('the debugging laboratory is missing its evidence panel');
  return panel;
}

function clickButton(
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
  label: string,
): void {
  const button = viewsIn(dialog).find(
    (view): view is Button => view instanceof Button && view.activation.label === label,
  );
  if (button === undefined) throw new Error(`the debugging laboratory is missing the "${label}" button`);
  const origin = absoluteOrigin(button);
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'click',
    at: {
      x: origin.x + Math.floor(button.bounds.width / 2),
      y: origin.y,
    },
  });
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
    to: { x: from.x + 10, y: from.y + 3 },
  });
}

describe('Debugging course content contract', () => {
  test('should publish the completed catalog-owned course and its single application laboratory', () => {
    expect(source).not.toBe('');
    expect(guide).toMatchObject({
      title: 'Debugging',
      group: 'Operating a real app',
      page: '/guide/debugging',
      profile: 'course',
      stage: 'complete',
      sidebarOrder: 1,
      prerequisites: ['application-shell', 'testing-headlessly'],
      learningOutcomes: [
        'Diagnose layout, focus, command, rendering, capability, and host-lifecycle failures.',
        'Collect safe logs, frame evidence, and minimal reproductions without corrupting the terminal.',
      ],
      requiredLiveExamples: 1,
      liveExampleException: null,
      examples: [LAB_ID],
    });
    expect(source).toContain('](/guide/application-shell)');
    expect(source).toContain('](/guide/testing-headlessly)');
    expect(source).toContain(`<PlayExample id="${LAB_ID}"`);
    expect(EXAMPLES.filter((candidate) => candidate.id === LAB_ID)).toHaveLength(1);
  });

  test('should state the learner contract and follow a question-led diagnosis course backbone', () => {
    const sections = [
      '## Who is this course for?',
      '## What is the debugging mental model?',
      '## How do I get the first useful diagnosis?',
      '## Laboratory: debugging evidence',
      '## How do I reproduce and minimize a failure?',
      '## How do I classify the failing boundary?',
      '## How do I inspect layout and clipping evidence?',
      '## How do I inspect focus and input routing?',
      '## How do I inspect commands and reactive rendering?',
      '## How do capabilities explain degraded behavior?',
      '## How do I collect screen-safe logs and frame evidence?',
      '## How do I investigate host lifecycle and cleanup?',
      '## How do I choose headless, terminal, or browser evidence?',
      '## What belongs in advanced failure isolation?',
      '## How do I diagnose debugging failures?',
      '## What are the best practices?',
      '## What should I practice next?',
    ];
    let previous = -1;
    for (const section of sections) {
      const index = source.indexOf(section);
      expect(index, `missing or misplaced ${section}`).toBeGreaterThan(previous);
      previous = index;
    }
    expect(source).toMatch(/^description:\s*.+diagnos.+(?:layout|focus|render).+(?:safe|evidence)/imu);
    expect(source).toMatch(/\bbuild\b[\s\S]*\bexplain\b[\s\S]*\bdiagnos(?:e|is)\b[\s\S]*\bverify\b/iu);
  });

  test('should teach one systematic observation ladder before subsystem-specific tools', () => {
    const ladder = [
      /reproduce/iu,
      /minimi[sz]e/iu,
      /classify/iu,
      /(?:geometry|layout)/iu,
      /focus/iu,
      /(?:event|command)/iu,
      /(?:reactive|render)/iu,
      /capabilit/iu,
      /(?:host|lifecycle)/iu,
      /correct/iu,
      /verify/iu,
    ];
    const mentalModel = source.slice(
      source.indexOf('## What is the debugging mental model?'),
      source.indexOf('## Laboratory: debugging evidence'),
    );
    let previous = -1;
    for (const step of ladder) {
      const match = step.exec(mentalModel);
      expect(match?.index ?? -1, `missing observation-ladder step ${String(step)}`).toBeGreaterThan(previous);
      previous = match?.index ?? previous;
    }
    expect(source).toMatch(
      /same (?:input|fixture|reproduction)[\s\S]{0,350}(?:one boundary|one variable|change one)/iu,
    );
    expect(source).toMatch(/(?:observable|evidence)[\s\S]{0,350}(?:hypothesis|guess)/iu);
  });

  test('should diagnose geometry, focus, command routing, and reactive rendering with public evidence', () => {
    expect(source).toMatch(/(?:bounds|rect)[\s\S]{0,300}(?:parent|absolute|clip|viewport)/iu);
    expect(source).toMatch(/(?:measure|layout)[\s\S]{0,300}(?:draw|buffer|frame)/iu);
    expect(source).toMatch(/getFocused\(\)[\s\S]{0,300}(?:focusable|ancestor|modal|focus chain)/iu);
    expect(source).toMatch(/(?:event\.handled|handled)[\s\S]{0,350}(?:onCommand|emitCommand|command)/iu);
    expect(source).toMatch(/(?:signal|computed|effect|dependency)[\s\S]{0,350}(?:invalidate|draw|frame)/iu);
    expect(source).toMatch(/renderRoot\.buffer\(\)[\s\S]{0,300}(?:get\(|rows\(\))/iu);
    expect(source).toMatch(/(?:symptom|evidence)[\s\S]{0,350}(?:layout|focus|command|render)/iu);
  });

  test('should collect bounded redacted diagnostics without writing into the active UI stream', () => {
    expect(source).toMatch(/console\.log[\s\S]{0,400}(?:corrupt|scribble|active terminal|UI stream)/iu);
    expect(source).toMatch(/createLogger\([\s\S]{0,450}(?:ring|file|stderr)[\s\S]{0,350}(?:size|bounded)/iu);
    expect(source).toMatch(/redactEvent\([\s\S]{0,300}(?:paste|printable|payload|secret)/iu);
    expect(source).toMatch(/dumpCaps\([\s\S]{0,300}(?:reason|layer|decision)/iu);
    expect(source).toMatch(/(?:never|do not|avoid)[\s\S]{0,350}(?:raw input|paste text|token|secret)/iu);
    expect(source).toMatch(/(?:frame|cell)[\s\S]{0,350}(?:bounded|crop|region|coordinates)/iu);
    expect(source).toMatch(/(?:redact|sanitize)[\s\S]{0,350}(?:diagnostic|log|reproduction)/iu);
  });

  test('should teach capability reasoning, lifecycle evidence, and failure isolation', () => {
    expect(source).toMatch(/resolveCapabilities\([\s\S]{0,400}(?:reason|override|profile)/iu);
    expect(source).toMatch(/(?:degraded|fallback)[\s\S]{0,350}(?:unicode|colour|color|mouse|capabilit)/iu);
    expect(source).toMatch(/(?:onCleanup|dispose)[\s\S]{0,350}(?:timer|subscription|listener|resource)/iu);
    expect(source).toMatch(/(?:late|stale)[\s\S]{0,350}(?:generation|abort|disposed|ignored|suppressed)/iu);
    expect(source).toMatch(/(?:terminal|host)[\s\S]{0,350}(?:restore|raw mode|alternate screen|cursor)/iu);
    expect(source).toMatch(/(?:throw|reject|failure)[\s\S]{0,350}(?:isolat|sibling|boundary|diagnostic)/iu);
    expect(source).toMatch(/(?:acquire|start|open)[\s\S]{0,350}(?:cleanup|release|close|dispose)/iu);
  });

  test('should choose the narrowest evidence environment without duplicating prerequisite courses', () => {
    expect(source).toMatch(/headless[\s\S]{0,400}terminal[\s\S]{0,400}browser/iu);
    expect(source).toMatch(/headless[\s\S]{0,350}(?:cells|focus|command|deterministic)/iu);
    expect(source).toMatch(/terminal[\s\S]{0,350}(?:TTY|raw mode|escape|host restoration)/iu);
    expect(source).toMatch(/browser[\s\S]{0,350}(?:DOM|xterm|authorization|web host)/iu);
    expect(source).toMatch(/(?:start|prefer)[\s\S]{0,350}(?:smallest|narrowest|headless)/iu);
    expect(source).not.toMatch(/^## How do I (?:mount|settle a modal|write) headless/imu);
  });

  test('should keep snippets public and concise and close with diagnosis, practices, and exercises', () => {
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
      'createLogger',
      'redactEvent',
      'dumpCaps',
      'resolveCapabilities',
      'getFocused',
      'renderRoot',
      'onCleanup',
      'dispose',
    ]) {
      expect(joined).toMatch(new RegExp(`\\b${api}\\b`, 'u'));
    }
    expect(source).toMatch(/symptom[\s\S]{0,300}cause[\s\S]{0,300}(?:correction|fix)[\s\S]{0,300}evidence/iu);
    expect(source).toMatch(/(?:consequence|otherwise|because)[\s\S]{0,700}(?:bounded|redact|minimal|cleanup)/iu);
    expect(source).toMatch(
      /(?:exercise|experiment)[\s\S]{0,1100}(?:layout|focus|command|render|capabilit|lifecycle)/iu,
    );
    expect(source).toContain('](/api/core/functions/createLogger)');
    expect(source).toContain('](/api/core/functions/redactEvent)');
    expect(source).toContain('](/api/core/functions/dumpCaps)');
    expect(source).toContain('](/api/ui/functions/createEventLoop)');
  });
});

describe('public debugging controls taught by the course', () => {
  test('should retain only bounded redacted input evidence', () => {
    const logger = createLogger({ sink: 'ring', size: 2 });
    const secret = 'visitor-secret-token';
    logger.debug('input', 'first', {
      event: redactEvent({ type: 'paste', text: secret, truncated: false }),
    });
    logger.info('focus', 'second', { target: 'editor' });
    logger.warn('command', 'third', { command: 'workspace.save', handled: false });

    expect(logger.entries()).toHaveLength(2);
    expect(logger.entries().map((entry) => entry.msg)).toEqual(['second', 'third']);
    expect(JSON.stringify(logger.entries())).not.toContain(secret);
    expect(redactEvent({ type: 'paste', text: secret, truncated: false })).toEqual({
      type: 'paste',
      length: secret.length,
      truncated: false,
    });
  });

  test('should expose capability decisions without input payloads', () => {
    const evidence = dumpCaps(capsResolution);
    expect(evidence).toContain('colorDepth=truecolor');
    expect(evidence).toContain('unicode=utf8,widthMode:wcwidth,emoji:narrow (override)');
    expect(evidence).not.toContain('visitor-secret');
    expect(evidence).not.toContain('\n');
  });

  test('should correlate geometry, focus, routed input, repaint, and exact frame evidence', () => {
    const probe = new EvidenceProbe();
    probe.setLayout({ position: 'absolute', rect: { x: 3, y: 1, width: 12, height: 1 } });
    const root = new Group();
    root.add(probe);
    const loop = createEventLoop({ width: 24, height: 4 }, { caps });
    loop.mount(root);
    loop.focusView(probe);
    const before = probe.draws;
    loop.dispatch(key('x'));
    loop.renderRoot.flush();

    expect(probe.bounds).toMatchObject({ x: 3, y: 1, width: 12, height: 1 });
    expect(loop.getFocused()).toBe(probe);
    expect(probe.events).toBe(1);
    expect(probe.draws).toBeGreaterThan(before);
    expect(loop.renderRoot.buffer().get(3, 1)?.char).toBe('e');
    expect(
      loop.renderRoot
        .buffer()
        .rows()[1]
        ?.map((cell) => cell.char)
        .join(''),
    ).toContain('events:1');
    loop.dispose();
    expect(probe.cleanups).toBe(1);
  });

  test('should make cleanup idempotent and suppress post-disposal repaint work', () => {
    const pending: Array<() => void> = [];
    const probe = new EvidenceProbe();
    const loop = createEventLoop({ width: 16, height: 2 }, { caps, scheduleMicrotask: (flush) => pending.push(flush) });
    loop.mount(probe);
    const draws = probe.draws;
    probe.invalidate();
    expect(pending).toHaveLength(1);
    loop.dispose();
    expect(() => loop.dispose()).not.toThrow();
    pending.shift()?.();
    expect(probe.cleanups).toBe(1);
    expect(probe.draws).toBe(draws);
  });
});

describe('Debugging evidence laboratory contract', () => {
  test('should register one accurately described application laboratory', async () => {
    const entry = EXAMPLES.find((candidate) => candidate.id === LAB_ID);
    expect(entry).toMatchObject({
      id: LAB_ID,
      kind: 'app',
      themeMenu: true,
      sourcePath: 'examples/guides/debugging-evidence.ts',
    });
    const debuggingExample = await loadDefinition();
    expect(debuggingExample.title).toMatch(/debugging|evidence/iu);
    expect(debuggingExample.blurb).toMatch(/layout.+focus.+command.+render.+capabilit.+lifecycle/iu);
  });

  test('should open as a centered compact Classic template1 application', async () => {
    const { app, dialog } = buildLabExample(LAB_ID, await loadDefinition());
    const evidence = collectTemplate1Evidence(app, dialog);
    expect(evidence.viewport).toEqual({ width: 80, height: 24 });
    expect(evidence.dialogInterior.join('\n')).toMatch(/reproduce.+classify.+evidence.+correct.+verify/isu);
    expect(frameText(app)).toMatch(/Alt\+(?:L|F|C|R|P|H|V)/u);
    app.loop.dispose();
  });

  test('should diagnose every required boundary through reachable keyboard actions', async () => {
    const { app, dialog } = buildLabExample(LAB_ID, await loadDefinition());
    const panel = panelIn(dialog);
    const actions = [
      ['L', 'layoutDiagnoses'],
      ['F', 'focusDiagnoses'],
      ['C', 'commandDiagnoses'],
      ['R', 'renderDiagnoses'],
      ['P', 'capabilityDiagnoses'],
      ['H', 'lifecycleDiagnoses'],
    ] as const;

    for (const [hotkey, field] of actions) {
      const before = panel[field];
      dispatchExampleAction(app, { kind: 'key', key: hotkey, modifiers: ['Alt'] });
      expect(panel[field]).toBe(before + 1);
      expect(frameText(app)).toMatch(/symptom|cause|evidence|correction/iu);
    }
    dispatchExampleAction(app, { kind: 'key', key: 'V', modifiers: ['Alt'] });
    expect(panel.corrections).toBe(1);
    expect(frameText(app)).toMatch(/verified|verification passed/iu);
    app.loop.dispose();
  });

  test('should provide mouse diagnosis and bounded redacted diagnostic feedback', async () => {
    const { app, dialog } = buildLabExample(LAB_ID, await loadDefinition());
    const panel = panelIn(dialog);
    clickButton(app, dialog, 'Inspect layout');
    expect(panel.layoutDiagnoses).toBe(1);
    expect(panel.diagnosticCount).toBeGreaterThan(0);
    expect(panel.diagnosticCount).toBeLessThanOrEqual(panel.diagnosticCapacity);
    expect(panel.leakedPayloads).toBe(0);
    expect(frameText(app)).toMatch(/redaction.+pass|payloads leaked:\s*0/iu);
    app.loop.dispose();
  });

  test('should remain responsive and unclipped through resize, maximize, and restore', async () => {
    const { app, dialog } = buildLabExample(LAB_ID, await loadDefinition());
    const compact = { ...dialog.bounds };
    resizeDialog(app, dialog);
    collectTemplate1Evidence(app, dialog, { startup: 'resized' });
    expect(frameText(app)).toMatch(/evidence ladder|diagnostic/iu);
    dispatchExampleAction(app, { kind: 'key', key: 'z', modifiers: ['Alt'] });
    collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
    expect(frameText(app)).toMatch(/Inspect layout|Alt\+L/iu);
    dispatchExampleAction(app, { kind: 'key', key: 'z', modifiers: ['Alt'] });
    expect(dialog.bounds).not.toEqual(compact);
    collectTemplate1Evidence(app, dialog, { startup: 'resized' });
    app.loop.dispose();
  });

  test('should expose non-colour status cues and release owned work exactly once', async () => {
    const { app, dialog } = buildLabExample(LAB_ID, await loadDefinition());
    const panel = panelIn(dialog);
    dispatchExampleAction(app, { kind: 'key', key: 'P', modifiers: ['Alt'] });
    expect(frameText(app)).toMatch(/(?:PASS|WARN|FAIL|OK)[\s\S]*(?:ASCII|fallback|reason)/iu);
    app.loop.dispose();
    expect(panel.cleanupCount).toBe(1);
    expect(() => app.loop.dispose()).not.toThrow();
    expect(panel.cleanupCount).toBe(1);
  });
});
