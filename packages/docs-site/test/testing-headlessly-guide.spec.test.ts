/**
 * Immutable oracle for the Testing headlessly course and its authentic test artifact.
 *
 * Public controls prove exact rendered-cell inspection, routed input and focus, deterministic resize
 * and scheduling, modal settlement, failure isolation, and idempotent cleanup without a TTY or DOM.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createLogger, resolveCapabilities } from '@jsvision/core';
import { Group, Text, View, createApplication, createEventLoop, createRenderRoot } from '@jsvision/ui';
import type { DispatchEvent, DrawContext, Size2D } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import { EXAMPLES } from '../examples/index.js';
import { parseGuideCatalog } from '../src/guides/guide-catalog.mjs';
import { key } from './example-lab-harness.js';

const guidePath = fileURLToPath(new URL('../guide/testing-headlessly.md', import.meta.url));
const catalogPath = fileURLToPath(new URL('../guides.json', import.meta.url));
const fixturePath = fileURLToPath(
  new URL('../src/example-fixtures/testing-headlessly/application-fixture.ts', import.meta.url),
);
const artifactPath = fileURLToPath(new URL('./testing-headlessly-example.spec.test.ts', import.meta.url));
const source = existsSync(guidePath) ? readFileSync(guidePath, 'utf8') : '';
const fixtureSource = existsSync(fixturePath) ? readFileSync(fixturePath, 'utf8') : '';
const artifactSource = existsSync(artifactPath) ? readFileSync(artifactPath, 'utf8') : '';
const catalog = parseGuideCatalog(readFileSync(catalogPath, 'utf8'));
const guide = catalog.entries.find((candidate) => candidate.id === 'testing-headlessly');
const exactException =
  'The authentic runnable artifact is a test module and test-runner output, not an interactive terminal demonstration.';
const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: {
    colorDepth: 'truecolor',
    unicode: { utf8: true, widthMode: 'wcwidth', emoji: 'narrow' },
  },
}).profile;

class InputProbe extends View {
  events = 0;
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
    return { width: Math.min(8, available.width), height: Math.min(1, available.height) };
  }

  override draw(ctx: DrawContext): void {
    ctx.fill(' ', ctx.color(this.state.focused ? 'buttonFocused' : 'button'));
    ctx.text(0, 0, `E:${this.events}`, ctx.color(this.state.focused ? 'buttonFocused' : 'button'));
  }

  override onEvent(event: DispatchEvent): void {
    if (event.event.type === 'key' && event.event.key === 'x') {
      this.events += 1;
      event.handled = true;
      this.invalidate();
    }
  }
}

class PaintView extends View {
  draws = 0;

  constructor(private readonly glyph: string) {
    super();
  }

  override measure(available: Size2D): Size2D {
    return { width: Math.min(3, available.width), height: Math.min(1, available.height) };
  }

  override draw(ctx: DrawContext): void {
    this.draws += 1;
    ctx.fill(this.glyph);
  }
}

class ThrowingView extends View {
  override measure(available: Size2D): Size2D {
    return { width: Math.min(3, available.width), height: Math.min(1, available.height) };
  }

  override draw(): void {
    throw new Error('intentional test failure');
  }
}

function snippets(): string[] {
  return [...source.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/g)].map((match) => match[1] ?? '');
}

function frameLines(loop: ReturnType<typeof createEventLoop>): string[] {
  return loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''));
}

describe('Testing headlessly course and authentic artifact contract', () => {
  test('should publish the completed zero-lab course with the exact authentic-artifact exception', () => {
    expect(source).not.toBe('');
    expect(guide).toMatchObject({
      title: 'Testing headlessly',
      page: '/guide/testing-headlessly',
      profile: 'course',
      stage: 'complete',
      prerequisites: ['application-shell', 'events-commands-and-keymaps'],
      learningOutcomes: [
        'Mount views and applications without a real terminal and inspect rendered cells.',
        'Drive input, modal flows, resize, cleanup, and failure paths deterministically.',
      ],
      requiredLiveExamples: 0,
      liveExampleException: exactException,
      examples: [],
    });
    expect(source).toContain('](/guide/application-shell)');
    expect(source).toContain('](/guide/events-commands-and-keymaps)');
    expect(source).not.toContain('<PlayExample');
    expect(EXAMPLES.some((candidate) => candidate.id.startsWith('guides/testing-headlessly'))).toBe(false);
  });

  test('should state the learner contract and follow the complete question-led course backbone', () => {
    const sections = [
      '## Who is this course for?',
      '## What is the headless-testing mental model?',
      '## How do I get the first useful rendered result?',
      '## What is the authentic runnable artifact?',
      '## How do I inspect exact rendered cells and frames?',
      '## How do I make capabilities, viewport, and scheduling deterministic?',
      '## How do I drive input, focus, and commands?',
      '## How do I settle modal workflows?',
      '## How do I verify resize and reflow?',
      '## How do I prove cleanup and suppress late work?',
      '## How do I test failure paths?',
      '## How do specification, implementation, and browser evidence differ?',
      '## How do I compose a reusable headless fixture?',
      '## What belongs in advanced headless testing?',
      '## How do I diagnose false or flaky evidence?',
      '## What are the best practices?',
      '## What should I practice next?',
    ];
    let previous = -1;
    for (const section of sections) {
      const index = source.indexOf(section);
      expect(index, `missing or misplaced ${section}`).toBeGreaterThan(previous);
      previous = index;
    }
    expect(source).toMatch(/^description:\s*.+(?:headless|no TTY).+(?:frame|input|deterministic)/imu);
    expect(source).toMatch(/\bbuild\b[\s\S]*\bexplain\b[\s\S]*\bdiagnos(?:e|is)\b[\s\S]*\bverify\b/iu);
  });

  test('should teach direct public seams before introducing the reusable fixture', () => {
    const direct = source.search(/createEventLoop\(|createRenderRoot\(/u);
    const fixture = source.search(/(?:reusable|application) fixture/iu);
    expect(direct).toBeGreaterThanOrEqual(0);
    expect(fixture).toBeGreaterThan(direct);
    expect(source).toMatch(/resolveCapabilities\([\s\S]{0,450}(?:env|platform|override)/iu);
    expect(source).toMatch(/createApplication\([\s\S]{0,400}(?:caps|viewport)/iu);
    expect(source).toMatch(/createEventLoop\([\s\S]{0,400}(?:caps|viewport|width|height)/iu);
    expect(source).toMatch(/createRenderRoot\([\s\S]{0,400}(?:caps|schedule)/iu);
  });

  test('should teach exact cell and frame evidence rather than self-authored status', () => {
    expect(source).toMatch(/renderRoot\.buffer\(\)[\s\S]{0,450}(?:rows\(\)|get\()/iu);
    expect(source).toMatch(/(?:cell|char)[\s\S]{0,350}(?:fg|bg|attrs|style)/iu);
    expect(source).toMatch(/(?:exact|specific)[\s\S]{0,300}(?:row|cell|frame)[\s\S]{0,250}(?:expect|assert)/iu);
    expect(source).toMatch(/(?:do not|never|avoid)[\s\S]{0,350}(?:status flag|self-reported|self-authored)/iu);
    expect(source).toMatch(/(?:snapshot)[\s\S]{0,350}(?:bounded|deterministic|review|specific)/iu);
  });

  test('should teach deterministic capabilities, viewport, scheduler, input, focus, and commands', () => {
    expect(source).toMatch(/(?:fixed|injected)[\s\S]{0,250}capabilit/iu);
    expect(source).toMatch(/(?:fixed|explicit)[\s\S]{0,250}(?:viewport|width|height)/iu);
    expect(source).toMatch(/scheduleMicrotask[\s\S]{0,400}(?:queue|capture|flush|drain)/iu);
    expect(source).toMatch(/(?:do not|never|avoid)[\s\S]{0,300}(?:sleep|setTimeout|timing)/iu);
    expect(source).toMatch(/loop\.dispatch\([\s\S]{0,400}(?:key|mouse|command)/iu);
    expect(source).toMatch(/focusView\([\s\S]{0,300}getFocused\(\)/iu);
    expect(source).toMatch(/(?:handled|command handler|visible frame)[\s\S]{0,350}(?:assert|expect|evidence)/iu);
  });

  test('should teach modal settlement, resize, cleanup, late work, and failures', () => {
    expect(source).toMatch(/execView[\s\S]{0,350}endModal[\s\S]{0,350}(?:await|resolves)/iu);
    expect(source).toMatch(/(?:modal|dialog)[\s\S]{0,350}(?:focus|input confinement)[\s\S]{0,300}(?:restore|settle)/iu);
    expect(source).toMatch(/loop\.resize\([\s\S]{0,350}(?:bounds|buffer|reflow|width|height)/iu);
    expect(source).toMatch(/dispose\(\)[\s\S]{0,350}(?:idempotent|twice|exactly once)/iu);
    expect(source).toMatch(/onCleanup[\s\S]{0,350}(?:timer|subscription|listener|resource)/iu);
    expect(source).toMatch(/(?:late|stale)[\s\S]{0,350}(?:after disposal|publish|ignored|suppressed)/iu);
    expect(source).toMatch(
      /(?:draw|handler|fixture)[\s\S]{0,350}(?:throw|reject|failure)[\s\S]{0,350}(?:logged|isolated|unchanged)/iu,
    );
  });

  test('should distinguish specification, implementation, and browser-integration evidence', () => {
    expect(source).toMatch(/specification[\s\S]{0,500}implementation[\s\S]{0,500}browser(?: integration)?/iu);
    expect(source).toMatch(/specification[\s\S]{0,350}(?:public behavior|contract|outcome)/iu);
    expect(source).toMatch(/implementation[\s\S]{0,350}(?:edge|internal|hardening)/iu);
    expect(source).toMatch(/browser[\s\S]{0,350}(?:xterm|DOM|host|integration)/iu);
    expect(source).toMatch(/(?:TTY|DOM)[\s\S]{0,350}(?:not required|separate|browser evidence)/iu);
    expect(source).toMatch(/(?:mock|stub)[\s\S]{0,400}(?:host external|boundary|avoid|real objects)/iu);
  });

  test('should keep snippets concise and public and close with diagnosis, practice, and API links', () => {
    const code = snippets();
    expect(code.length).toBeGreaterThanOrEqual(10);
    for (const snippet of code) {
      expect(snippet.split('\n').filter((line) => line.trim() !== '').length).toBeLessThanOrEqual(28);
      expect(snippet).not.toMatch(/(?:demoApp|Template1Dialog|defineExample|packages\/(?:core|ui)\/src)/u);
      for (const imported of snippet.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu)) {
        expect(['@jsvision/core', '@jsvision/ui', 'vitest']).toContain(imported[1]);
      }
    }
    const joined = code.join('\n');
    for (const api of [
      'resolveCapabilities',
      'createApplication',
      'createEventLoop',
      'createRenderRoot',
      'renderRoot',
      'dispatch',
      'resize',
      'execView',
      'dispose',
    ]) {
      expect(joined).toMatch(new RegExp(`\\b${api}\\b`, 'u'));
    }
    expect(source).toMatch(/symptom[\s\S]{0,300}cause[\s\S]{0,300}(?:correction|fix)[\s\S]{0,300}evidence/iu);
    expect(source).toMatch(/(?:exercise|experiment)[\s\S]{0,1000}(?:frame|input|modal|resize|cleanup|failure)/iu);
    expect(source).toContain('](/api/ui/functions/createApplication)');
    expect(source).toContain('](/api/ui/functions/createEventLoop)');
    expect(source).toContain('](/api/ui/functions/createRenderRoot)');
    expect(source).toContain('](/api/core/functions/resolveCapabilities)');
  });

  test('should provide a real reusable fixture and Vitest module as the authentic runnable artifact', () => {
    expect(fixtureSource, 'missing reusable application fixture').not.toBe('');
    expect(artifactSource, 'missing authentic headless Vitest artifact').not.toBe('');
    expect(fixtureSource).toMatch(/from\s+['"]@jsvision\/(?:core|ui)['"]/u);
    expect(fixtureSource).toMatch(/createApplication|createEventLoop/u);
    expect(fixtureSource).toMatch(/(?:caps|viewport)[\s\S]{0,500}(?:dispose|cleanup)/iu);
    expect(artifactSource).toMatch(/from\s+['"]vitest['"]/u);
    expect(artifactSource).toMatch(/example-fixtures\/testing-headlessly/u);
    expect(artifactSource).toMatch(/renderRoot\.buffer\(\)[\s\S]{0,400}(?:get\(|rows\(\))/iu);
    expect(artifactSource).toMatch(/dispatch\([\s\S]{0,350}(?:key|mouse)/iu);
    expect(artifactSource).toMatch(/resize\([\s\S]{0,350}dispose\(\)/iu);
    expect(artifactSource).not.toMatch(/(?:setTimeout|sleep|document\.|process\.stdin|\/dev\/tty)/u);
  });
});

describe('public headless controls taught by the course', () => {
  test('should mount an application and inspect exact rendered cells without a terminal', () => {
    const content = new Group();
    const label = new Text('Headless');
    label.setLayout({ position: 'absolute', rect: { x: 2, y: 1, width: 8, height: 1 } });
    content.add(label);
    const app = createApplication({ caps, content, viewport: { width: 30, height: 8 } });
    app.loop.renderRoot.flush();
    const buffer = app.loop.renderRoot.buffer();
    expect(buffer.width).toBe(30);
    expect(buffer.height).toBe(8);
    expect(buffer.get(2, 1)?.char).toBe('H');
    expect(buffer.get(9, 1)?.char).toBe('s');
    expect(buffer.get(2, 1)?.bg).toBeDefined();
    app.loop.dispose();
  });

  test('should route input and focus, inspect the changed frame, and reflow on resize', () => {
    const probe = new InputProbe();
    const root = new Group();
    root.add(probe);
    const loop = createEventLoop({ width: 12, height: 3 }, { caps });
    loop.mount(root);
    loop.focusView(probe);
    expect(loop.getFocused()).toBe(probe);
    loop.dispatch(key('x'));
    loop.renderRoot.flush();
    expect(probe.events).toBe(1);
    expect(frameLines(loop)[0]).toContain('E:1');
    loop.resize({ width: 20, height: 5 });
    expect(loop.renderRoot.buffer().width).toBe(20);
    expect(loop.renderRoot.buffer().height).toBe(5);
    expect(root.bounds).toMatchObject({ width: 20, height: 5 });
    loop.dispose();
  });

  test('should settle a modal deterministically and restore focus', async () => {
    const outer = new InputProbe();
    const modalLeaf = new InputProbe();
    const modal = new Group();
    modal.add(modalLeaf);
    const root = new Group();
    root.add(outer);
    root.add(modal);
    const loop = createEventLoop({ width: 20, height: 6 }, { caps });
    loop.mount(root);
    loop.focusView(outer);
    const result = loop.execView<string>(modal);
    expect(loop.getFocused()).toBe(modalLeaf);
    loop.endModal('accepted');
    await expect(result).resolves.toBe('accepted');
    expect(loop.getFocused()).toBe(outer);
    loop.dispose();
  });

  test('should expose deferred repaint through an injected scheduler without timing', () => {
    const pending: Array<() => void> = [];
    const view = new PaintView('A');
    const loop = createEventLoop(
      { width: 3, height: 1 },
      {
        caps,
        scheduleMicrotask: (flush) => pending.push(flush),
      },
    );
    loop.mount(view);
    const initialDraws = view.draws;
    view.invalidate();
    expect(pending).toHaveLength(1);
    expect(view.draws).toBe(initialDraws);
    pending.shift()?.();
    expect(view.draws).toBeGreaterThan(initialDraws);
    loop.dispose();
  });

  test('should isolate draw failure, preserve sibling evidence, and record a bounded diagnostic', () => {
    const logger = createLogger({ sink: 'ring', size: 10 });
    const bad = new ThrowingView();
    const good = new PaintView('G');
    const root = new Group();
    root.setLayout({ direction: 'row' });
    root.add(bad);
    root.add(good);
    const render = createRenderRoot({ width: 6, height: 1 }, { caps, logger });
    render.mount(root);
    expect(render.buffer().get(3, 0)?.char).toBe('G');
    expect(logger.entries()).toHaveLength(1);
    expect(logger.entries()[0]?.msg).not.toContain('intentional test failure');
    render.unmount();
  });

  test('should dispose mounted ownership exactly once and settle pending modal work', async () => {
    const probe = new InputProbe();
    const loop = createEventLoop({ width: 8, height: 2 }, { caps });
    loop.mount(probe);
    const modal = new Group();
    const result = loop.execView<string>(modal);
    loop.dispose();
    expect(() => loop.dispose()).not.toThrow();
    await expect(result).resolves.toBeUndefined();
    expect(probe.cleanups).toBe(1);
    expect(probe.mounted).toBe(false);
  });
});
