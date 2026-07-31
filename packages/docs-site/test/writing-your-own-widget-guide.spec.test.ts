/**
 * Immutable oracle for the Writing your own widget course and its two laboratories.
 *
 * Public controls prove intrinsic measurement, clipped capability-aware drawing, owned reactive
 * repaint, handled input, focus, composition, cleanup, and deterministic headless evidence.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveCapabilities } from '@jsvision/core';
import { Button, Group, View, createEventLoop, createRenderRoot, createRoot, signal } from '@jsvision/ui';
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

const guidePath = fileURLToPath(new URL('../guide/writing-your-own-widget.md', import.meta.url));
const catalogPath = fileURLToPath(new URL('../guides.json', import.meta.url));
const source = existsSync(guidePath) ? readFileSync(guidePath, 'utf8') : '';
const catalog = parseGuideCatalog(readFileSync(catalogPath, 'utf8'));
const guide = catalog.entries.find((candidate) => candidate.id === 'writing-your-own-widget');
const anatomyLabId = 'guides/widget-anatomy';
const compositionLabId = 'guides/widget-composition';
const labIds = [anatomyLabId, compositionLabId] as const;
const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: {
    colorDepth: 'truecolor',
    unicode: { utf8: true },
    glyphs: { halfBlocks: true },
  },
}).profile;

interface WidgetAnatomyPanel extends View {
  readonly lessonName: 'Widget anatomy';
  readonly measurements: number;
  readonly draws: number;
  readonly keyboardActions: number;
  readonly mouseActions: number;
  readonly handledEvents: number;
  readonly cleanupCount: number;
}

interface WidgetCompositionPanel extends View {
  readonly lessonName: 'Widget composition and evidence';
  readonly repaintChecks: number;
  readonly reflowChecks: number;
  readonly clippingChecks: number;
  readonly capabilityChecks: number;
  readonly cleanupCount: number;
}

class MeterWidget extends View {
  draws = 0;
  measurements = 0;
  handled = 0;
  cleanups = 0;

  constructor(readonly value: ReturnType<typeof signal<number>>) {
    super();
    this.focusable = true;
    this.onMount(() => {
      this.bind(
        () => this.value(),
        () => {},
      );
      this.onCleanup(() => {
        this.cleanups += 1;
      });
    });
  }

  override measure(available: Size2D): Size2D {
    this.measurements += 1;
    return { width: Math.min(12, available.width), height: Math.min(1, available.height) };
  }

  override draw(ctx: DrawContext): void {
    this.draws += 1;
    const role = this.state.focused ? 'buttonFocused' : 'button';
    const glyph = ctx.caps.glyphs.halfBlocks ? '█' : '#';
    ctx.fill(' ', ctx.color(role));
    ctx.text(0, 0, `${glyph} ${this.value()}`, ctx.color(role));
    ctx.text(ctx.size.width + 10, 0, 'outside', ctx.color(role));
  }

  override onEvent(event: DispatchEvent): void {
    const input = event.event;
    if (
      (input.type === 'key' && (input.key === 'right' || input.key === 'enter')) ||
      (input.type === 'mouse' && input.kind === 'down' && event.local !== undefined)
    ) {
      this.value.update((current) => current + 1);
      this.handled += 1;
      event.handled = true;
    }
  }
}

class DrawCounter extends View {
  draws = 0;

  constructor(private readonly glyph: string) {
    super();
  }

  override measure(available: Size2D): Size2D {
    return { width: Math.min(2, available.width), height: Math.min(1, available.height) };
  }

  override draw(ctx: DrawContext): void {
    this.draws += 1;
    ctx.fill(this.glyph, ctx.color('staticText'));
  }
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

function isAnatomyPanel(view: View): view is WidgetAnatomyPanel {
  return (
    view.constructor.name === 'WidgetAnatomyPanel' &&
    'lessonName' in view &&
    view.lessonName === 'Widget anatomy' &&
    'measurements' in view &&
    typeof view.measurements === 'number' &&
    'draws' in view &&
    typeof view.draws === 'number' &&
    'keyboardActions' in view &&
    typeof view.keyboardActions === 'number' &&
    'mouseActions' in view &&
    typeof view.mouseActions === 'number' &&
    'handledEvents' in view &&
    typeof view.handledEvents === 'number' &&
    'cleanupCount' in view &&
    typeof view.cleanupCount === 'number'
  );
}

function isCompositionPanel(view: View): view is WidgetCompositionPanel {
  return (
    view.constructor.name === 'WidgetCompositionPanel' &&
    'lessonName' in view &&
    view.lessonName === 'Widget composition and evidence' &&
    'repaintChecks' in view &&
    typeof view.repaintChecks === 'number' &&
    'reflowChecks' in view &&
    typeof view.reflowChecks === 'number' &&
    'clippingChecks' in view &&
    typeof view.clippingChecks === 'number' &&
    'capabilityChecks' in view &&
    typeof view.capabilityChecks === 'number' &&
    'cleanupCount' in view &&
    typeof view.cleanupCount === 'number'
  );
}

function anatomyPanelIn(dialog: View): WidgetAnatomyPanel {
  const panel = viewsIn(dialog).find(isAnatomyPanel);
  if (panel === undefined) throw new Error('Widget-anatomy laboratory is missing its teaching panel');
  return panel;
}

function compositionPanelIn(dialog: View): WidgetCompositionPanel {
  const panel = viewsIn(dialog).find(isCompositionPanel);
  if (panel === undefined) throw new Error('Widget-composition laboratory is missing its teaching panel');
  return panel;
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

function capturingScheduler(): {
  readonly schedule: (flush: () => void) => void;
  readonly run: () => void;
} {
  let pending: (() => void) | null = null;
  return {
    schedule: (flush) => {
      pending = flush;
    },
    run: () => {
      const flush = pending;
      pending = null;
      flush?.();
    },
  };
}

describe('Writing your own widget course contract', () => {
  test('should publish the completed catalog course with exact prerequisites, outcomes, and labs', () => {
    expect(source).not.toBe('');
    expect(guide).toMatchObject({
      title: 'Writing your own widget',
      page: '/guide/writing-your-own-widget',
      profile: 'course',
      stage: 'complete',
      prerequisites: ['layout', 'reactive-state', 'views-and-focus', 'events-commands-and-keymaps'],
      learningOutcomes: [
        'Implement measurement, drawing, invalidation, focus, and input for a custom View.',
        'Compose and test reusable widgets without bypassing ownership or clipping boundaries.',
      ],
      requiredLiveExamples: 2,
      liveExampleException: null,
      examples: [...labIds],
    });
    for (const prerequisite of ['layout', 'reactive-state', 'views-and-focus', 'events-commands-and-keymaps']) {
      expect(source).toContain(`](/guide/${prerequisite})`);
    }
  });

  test('should state the learner contract and follow the complete question-led course backbone', () => {
    const sections = [
      '## Who is this course for?',
      '## What is the custom-widget mental model?',
      '## How do I build the first useful custom View?',
      '## Laboratory: widget anatomy',
      '## How does intrinsic measurement work?',
      '## How do I draw safely inside local clipped bounds?',
      '## How do focus and input become widget behavior?',
      '## How does reactive state request repaint or reflow?',
      '## How do semantic themes and capabilities shape drawing?',
      '## Laboratory: widget composition and evidence',
      '## How do I compose a reusable widget?',
      '## How do I test a widget headlessly?',
      '## What belongs in advanced widget ownership?',
      '## How do I diagnose widget failures?',
      '## What are the best practices?',
      '## What should I practice next?',
    ];
    let previous = -1;
    for (const section of sections) {
      const index = source.indexOf(section);
      expect(index, `missing or misplaced ${section}`).toBeGreaterThan(previous);
      previous = index;
    }
    expect(source).toMatch(/^description:\s*.+(?:custom View|widget).+(?:measure|draw|input|cleanup)/imu);
    expect(source).toMatch(/\bbuild\b[\s\S]*\bexplain\b[\s\S]*\bdiagnos(?:e|is)\b[\s\S]*\bverify\b/iu);
    expect(source).toContain(`<PlayExample id="${anatomyLabId}"`);
    expect(source).toContain(`<PlayExample id="${compositionLabId}"`);
  });

  test('should teach intrinsic measurement and clipped capability-aware drawing', () => {
    expect(source).toMatch(/class\s+\w+\s+extends\s+View/iu);
    expect(source).toMatch(/measure\(\s*available[\s\S]{0,400}(?:width|height)[\s\S]{0,250}return/iu);
    expect(source).toMatch(/auto[\s\S]{0,350}(?:measure|natural size)[\s\S]{0,300}(?:zero|0×|disappear)/iu);
    expect(source).toMatch(/DrawContext[\s\S]{0,350}(?:local|0,\s*0)[\s\S]{0,350}clip/iu);
    expect(source).toMatch(/ctx\.size[\s\S]{0,350}(?:width|height|available)/iu);
    expect(source).toMatch(/ctx\.caps[\s\S]{0,350}(?:Unicode|ASCII|glyph)/iu);
    expect(source).toMatch(/ctx\.color\([\s\S]{0,350}(?:semantic|theme role)/iu);
    expect(source).toMatch(/(?:do not|never)[\s\S]{0,300}(?:screen|absolute)[ -](?:coordinates|bounds)/iu);
  });

  test('should teach focus, keyboard, mouse, local coordinates, and handled ownership', () => {
    expect(source).toMatch(/focusable\s*=\s*true[\s\S]{0,400}(?:focused|state\.focused)/iu);
    expect(source).toMatch(/onEvent\(\s*(?:event|ev)[\s\S]{0,500}(?:key|keyboard)[\s\S]{0,350}mouse/iu);
    expect(source).toMatch(/event\.local|ev\.local/u);
    expect(source).toMatch(/handled\s*=\s*true[\s\S]{0,300}(?:consume|stop|owned)/iu);
    expect(source).toMatch(/(?:do not|never|avoid)[\s\S]{0,350}(?:owned|recognized)[\s\S]{0,250}unhandled/iu);
    expect(source).toMatch(/(?:focus|selected)[\s\S]{0,400}(?:border|glyph|label|attribute)[\s\S]{0,250}non-colou?r/iu);
    expect(source).toMatch(/(?:keyboard|Enter|Space|arrow)[\s\S]{0,350}mouse/iu);
  });

  test('should teach owned reactivity, repaint versus reflow, layout, and exact cleanup', () => {
    expect(source).toMatch(/onMount\([\s\S]{0,350}\.bind\(/iu);
    expect(source).toMatch(/(?:constructor|before mount)[\s\S]{0,350}(?:do not|never|throws)[\s\S]{0,250}bind/iu);
    expect(source).toMatch(/invalidate\(\)[\s\S]{0,450}(?:paint|repaint)[\s\S]{0,450}invalidateLayout\(\)/iu);
    expect(source).toMatch(/invalidateLayout\(\)[\s\S]{0,350}(?:measure|geometry|reflow)/iu);
    expect(source).toMatch(/setLayout\([\s\S]{0,350}(?:size|direction|padding|rect)/iu);
    expect(source).toMatch(/(?:readonly|read-only)[\s\S]{0,250}layout[\s\S]{0,300}(?:do not|never|setLayout)/iu);
    expect(source).toMatch(/onMount\([\s\S]{0,500}onCleanup\([\s\S]{0,350}(?:timer|subscription|listener)/iu);
    expect(source).toMatch(/(?:exactly once|idempotent)[\s\S]{0,300}(?:cleanup|dispose)/iu);
  });

  test('should teach responsive composition, constrained output, and headless evidence', () => {
    expect(source).toMatch(/(?:Group|row|col)\([\s\S]{0,450}(?:setLayout|fixed|grow|gap)/iu);
    expect(source).toMatch(/(?:parent|container)[\s\S]{0,350}(?:owns|mounts|removes)[\s\S]{0,300}(?:child|widget)/iu);
    expect(source).toMatch(
      /(?:small|constrained|reduced)[ -](?:viewport|geometry)[\s\S]{0,400}(?:clip|wrap|truncate)/iu,
    );
    expect(source).toMatch(/Unicode[\s\S]{0,350}ASCII[\s\S]{0,300}(?:same meaning|fallback|cue)/iu);
    expect(source).toMatch(/createRenderRoot\([\s\S]{0,450}(?:buffer|rows|cells|flush)/iu);
    expect(source).toMatch(/createEventLoop\([\s\S]{0,450}(?:dispatch|focus|mouse|key)/iu);
    expect(source).toMatch(/(?:measure|bounds|buffer|handled|cleanup)[\s\S]{0,600}(?:assert|expect|evidence)/iu);
  });

  test('should keep snippets public and close with diagnosis, practice, and owning links', () => {
    const code = snippets();
    expect(code.length).toBeGreaterThanOrEqual(10);
    for (const snippet of code) {
      expect(snippet.split('\n').filter((line) => line.trim() !== '').length).toBeLessThanOrEqual(28);
      expect(snippet).not.toMatch(/(?:demoApp|Template1Dialog|defineExample|packages\/ui\/src|@jsvision\/ui\/src)/u);
      for (const imported of snippet.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu)) {
        expect(imported[1]).toBe('@jsvision/ui');
      }
    }
    const joined = code.join('\n');
    for (const api of [
      'View',
      'DrawContext',
      'measure',
      'onEvent',
      'invalidate',
      'invalidateLayout',
      'setLayout',
      'onMount',
      'onCleanup',
      'createRenderRoot',
      'createEventLoop',
    ]) {
      expect(joined).toMatch(new RegExp(`\\b${api}\\b`, 'u'));
    }
    expect(source).toMatch(/symptom[\s\S]{0,300}cause[\s\S]{0,300}(?:correction|fix)[\s\S]{0,300}evidence/iu);
    expect(source).toMatch(/(?:exercise|experiment)[\s\S]{0,900}(?:measure|clip|input|cleanup|ASCII)/iu);
    expect(source).toContain('](/api/ui/classes/View)');
    expect(source).toContain('](/api/ui/functions/createRenderRoot)');
    expect(source).toContain('](/api/ui/functions/createEventLoop)');
  });
});

describe('public custom-widget controls taught by the course', () => {
  test('should measure, draw locally, clip overflow, repaint reactively, handle input, focus, and clean up', () => {
    const value = signal(1);
    const widget = new MeterWidget(value);
    expect(widget.measure?.({ width: 12, height: 1 })).toEqual({ width: 12, height: 1 });
    const loop = createEventLoop({ width: 12, height: 1 }, { caps });
    loop.mount(widget);
    expect(widget.bounds).toEqual({ x: 0, y: 0, width: 12, height: 1 });
    expect(widget.measurements).toBeGreaterThan(0);
    expect(widget.draws).toBeGreaterThan(0);
    expect(
      loop.renderRoot
        .buffer()
        .rows()[0]
        ?.map((cell) => cell.char)
        .join(''),
    ).not.toContain('outside');

    loop.focusView(widget);
    expect(widget.state.focused).toBe(true);
    const keyboard: DispatchEvent = { event: key('right'), handled: false };
    widget.onEvent(keyboard);
    expect(value()).toBe(2);
    expect(widget.handled).toBe(1);
    expect(keyboard.handled).toBe(true);
    loop.renderRoot.flush();
    expect(widget.draws).toBeGreaterThan(1);

    const mouse: DispatchEvent = {
      event: { type: 'mouse', kind: 'down', button: 0, x: 2, y: 1 },
      handled: false,
      local: { x: 1, y: 0 },
    };
    widget.onEvent(mouse);
    expect(value()).toBe(3);
    expect(widget.handled).toBe(2);
    expect(mouse.handled).toBe(true);
    loop.dispose();
    expect(widget.cleanups).toBe(1);
    expect(widget.mounted).toBe(false);
  });

  test('should keep repaint local while relayout recomposes siblings', () => {
    const first = new DrawCounter('A');
    const second = new DrawCounter('B');
    const root = new Group();
    root.setLayout({ direction: 'row' });
    root.add(first);
    root.add(second);
    const scheduler = capturingScheduler();
    const render = createRenderRoot(
      { width: 4, height: 1 },
      {
        caps,
        schedule: scheduler.schedule,
      },
    );
    render.mount(root);
    const initialSecondDraws = second.draws;
    first.invalidate();
    scheduler.run();
    expect(first.draws).toBeGreaterThan(1);
    expect(second.draws).toBe(initialSecondDraws);
    first.invalidateLayout();
    scheduler.run();
    expect(second.draws).toBeGreaterThan(initialSecondDraws);
    render.unmount();
  });

  test('should preserve capability-aware Unicode and ASCII meaning in bounded buffers', () => {
    const value = signal(4);
    const unicodeWidget = new MeterWidget(value);
    const unicode = createRenderRoot({ width: 8, height: 1 }, { caps });
    unicode.mount(unicodeWidget);
    const unicodeText = unicode
      .buffer()
      .rows()[0]
      ?.map((cell) => cell.char)
      .join('');
    expect(unicodeText).toContain('█');
    unicode.unmount();

    const asciiCaps = resolveCapabilities({
      env: {},
      platform: 'linux',
      override: { glyphs: { halfBlocks: false }, unicode: { utf8: false } },
    }).profile;
    const asciiWidget = new MeterWidget(value);
    const ascii = createRenderRoot({ width: 4, height: 1 }, { caps: asciiCaps });
    ascii.mount(asciiWidget);
    const asciiText = ascii
      .buffer()
      .rows()[0]
      ?.map((cell) => cell.char)
      .join('');
    expect(asciiText).toContain('#');
    expect(asciiText).not.toContain('█');
    expect(ascii.buffer().width).toBe(4);
    ascii.unmount();
  });
});

describe('Writing your own widget laboratory contract', () => {
  test('should register two applications with objective-specific titles and blurbs', async () => {
    expect(registryEntry(anatomyLabId)).toMatchObject({
      kind: 'app',
      sourcePath: 'examples/guides/widget-anatomy.ts',
    });
    expect(registryEntry(compositionLabId)).toMatchObject({
      kind: 'app',
      sourcePath: 'examples/guides/widget-composition.ts',
    });
    const anatomy = await loadDefinition(anatomyLabId);
    const composition = await loadDefinition(compositionLabId);
    expect(anatomy.title).toMatch(/Widget Anatomy (?:Laboratory|Workshop)/iu);
    expect(anatomy.blurb).toMatch(/measure[\s\S]*draw[\s\S]*(?:reactive|repaint)[\s\S]*(?:keyboard|mouse)/iu);
    expect(composition.title).toMatch(/Widget Composition (?:Laboratory|Workshop)/iu);
    expect(composition.blurb).toMatch(/repaint[\s\S]*reflow[\s\S]*clip[\s\S]*(?:cleanup|headless)/iu);
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
      dispose();
    });
  });

  test.each(labIds)(
    'should remain clipped at constrained size and padded through resize, maximize, restore',
    async (id) => {
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
    },
  );

  test('should prove anatomy through real measure, draw, focus, reactive, keyboard, and mouse evidence', async () => {
    const definition = await loadDefinition(anatomyLabId);
    let panel: WidgetAnatomyPanel | undefined;
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(anatomyLabId, definition);
      panel = anatomyPanelIn(dialog);
      expect(panel.measurements).toBeGreaterThan(0);
      expect(panel.draws).toBeGreaterThan(0);
      expect(frameText(app)).toMatch(/Measure:\s*(?:pass|\d+x\d+)[\s\S]*Clipped draw:\s*pass/iu);
      app.loop.dispatch(key('right'));
      expect(panel.keyboardActions).toBe(1);
      expect(panel.handledEvents).toBe(1);
      expect(frameText(app)).toMatch(/Focus:\s*(?:yes|visible)[\s\S]*Event:\s*handled/iu);
      clickButton(app, dialog, 'Increment');
      expect(panel.mouseActions).toBe(1);
      expect(panel.handledEvents).toBe(2);
      expect(frameText(app)).toMatch(/Action source:\s*mouse[\s\S]*(?:non-colou?r|text cue)/iu);
      app.loop.dispose();
      dispose();
    });
    expect(panel?.cleanupCount).toBe(1);
  });

  test('should prove composition, repaint/reflow, clipping, capabilities, headless evidence, and cleanup', async () => {
    const definition = await loadDefinition(compositionLabId);
    let panel: WidgetCompositionPanel | undefined;
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(compositionLabId, definition);
      panel = compositionPanelIn(dialog);
      expect(frameText(app)).toMatch(/Viewport:\s*bounded[\s\S]*Ownership:\s*mounted/iu);
      app.loop.dispatch(key('p', { alt: true }));
      expect(panel.repaintChecks).toBe(1);
      expect(frameText(app)).toMatch(/Repaint:\s*local[\s\S]*Sibling draws:\s*unchanged/iu);
      app.loop.dispatch(key('r', { alt: true }));
      expect(panel.reflowChecks).toBe(1);
      expect(frameText(app)).toMatch(/Reflow:\s*full[\s\S]*Sibling draws:\s*changed/iu);
      app.loop.dispatch(key('c', { alt: true }));
      expect(panel.clippingChecks).toBe(1);
      expect(frameText(app)).toMatch(/Clipping:\s*pass[\s\S]*Overflow:\s*none/iu);
      app.loop.dispatch(key('a', { alt: true }));
      expect(panel.capabilityChecks).toBe(1);
      expect(frameText(app)).toMatch(/Unicode:\s*█[\s\S]*ASCII:\s*#[\s\S]*Meaning:\s*same/iu);
      clickButton(app, dialog, 'Headless check');
      expect(frameText(app)).toMatch(/Headless:\s*pass[\s\S]*Action source:\s*mouse/iu);
      app.loop.dispose();
      dispose();
    });
    expect(panel?.cleanupCount).toBeGreaterThanOrEqual(2);
  });

  test('should expose keyboard-complete non-colour status and release every mounted view', async () => {
    for (const id of labIds) {
      const definition = await loadDefinition(id);
      let mounted: View[] = [];
      createRoot((dispose) => {
        const { app, dialog } = buildLabExample(id, definition);
        mounted = viewsIn(dialog);
        expect(frameText(app)).toMatch(/Alt\+[A-Z]|(?:Enter|arrow)/iu);
        expect(frameText(app)).toMatch(/(?:Measure|Draw|Focus|Event|Repaint|Reflow|Clipping|Headless|Action):/iu);
        expect(frameText(app)).toMatch(/(?:ASCII|monochrome|text status|non-colou?r)/iu);
        expect(
          viewsIn(dialog)
            .filter((view) => view instanceof Button)
            .every((button) => button.focusable),
        ).toBe(true);
        app.loop.dispose();
        dispose();
      });
      expect(mounted.every((view) => !view.mounted && view.scope === null)).toBe(true);
    }
  });
});
