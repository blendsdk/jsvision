/**
 * Immutable oracle for the Application architecture & best practices course and laboratories.
 *
 * Public controls prove one command vocabulary, injected services, reactive application state,
 * screen ownership, failure isolation, stale-work suppression, and exact disposal.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveCapabilities } from '@jsvision/core';
import { Button, Group, Text, View, createApplication, createRoot, createRouter, signal } from '@jsvision/ui';
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

const guidePath = fileURLToPath(new URL('../guide/application-architecture.md', import.meta.url));
const catalogPath = fileURLToPath(new URL('../guides.json', import.meta.url));
const source = existsSync(guidePath) ? readFileSync(guidePath, 'utf8') : '';
const catalog = parseGuideCatalog(readFileSync(catalogPath, 'utf8'));
const guide = catalog.entries.find((candidate) => candidate.id === 'application-architecture');
const boundariesLabId = 'guides/architecture-boundaries';
const ownershipLabId = 'guides/architecture-ownership';
const labIds = [boundariesLabId, ownershipLabId] as const;
const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

interface ArchitectureBoundariesPanel extends View {
  readonly lessonName: 'Architecture boundaries';
  readonly coupledMutations: number;
  readonly commandRuns: number;
  readonly serviceCalls: number;
  readonly statePublications: number;
  readonly cleanupCount: number;
}

interface ArchitectureOwnershipPanel extends View {
  readonly lessonName: 'Architecture ownership';
  readonly applicationResources: number;
  readonly screenCleanups: number;
  readonly widgetCleanups: number;
  readonly isolatedFailures: number;
  readonly staleResultsSuppressed: number;
  readonly cleanupCount: number;
}

interface CounterService {
  increment(current: number): Promise<{ ok: true; value: number } | { ok: false; code: 'unavailable' }>;
}

class CounterModel {
  readonly value = signal(0);
  readonly status = signal<'idle' | 'working' | 'ready' | 'error'>('idle');
  readonly errorCode = signal<string | null>(null);
  private generation = 0;
  private disposed = false;

  constructor(private readonly service: CounterService) {}

  async increment(): Promise<void> {
    const generation = ++this.generation;
    this.status.set('working');
    const result = await this.service.increment(this.value());
    if (this.disposed || generation !== this.generation) return;
    if (result.ok) {
      this.value.set(result.value);
      this.errorCode.set(null);
      this.status.set('ready');
    } else {
      this.errorCode.set(result.code);
      this.status.set('error');
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
  }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
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

function isBoundariesPanel(view: View): view is ArchitectureBoundariesPanel {
  return (
    view.constructor.name === 'ArchitectureBoundariesPanel' &&
    'lessonName' in view &&
    view.lessonName === 'Architecture boundaries' &&
    'coupledMutations' in view &&
    typeof view.coupledMutations === 'number' &&
    'commandRuns' in view &&
    typeof view.commandRuns === 'number' &&
    'serviceCalls' in view &&
    typeof view.serviceCalls === 'number' &&
    'statePublications' in view &&
    typeof view.statePublications === 'number' &&
    'cleanupCount' in view &&
    typeof view.cleanupCount === 'number'
  );
}

function isOwnershipPanel(view: View): view is ArchitectureOwnershipPanel {
  return (
    view.constructor.name === 'ArchitectureOwnershipPanel' &&
    'lessonName' in view &&
    view.lessonName === 'Architecture ownership' &&
    'applicationResources' in view &&
    typeof view.applicationResources === 'number' &&
    'screenCleanups' in view &&
    typeof view.screenCleanups === 'number' &&
    'widgetCleanups' in view &&
    typeof view.widgetCleanups === 'number' &&
    'isolatedFailures' in view &&
    typeof view.isolatedFailures === 'number' &&
    'staleResultsSuppressed' in view &&
    typeof view.staleResultsSuppressed === 'number' &&
    'cleanupCount' in view &&
    typeof view.cleanupCount === 'number'
  );
}

function boundariesPanelIn(dialog: View): ArchitectureBoundariesPanel {
  const panel = viewsIn(dialog).find(isBoundariesPanel);
  if (panel === undefined) throw new Error('Architecture-boundaries laboratory is missing its teaching panel');
  return panel;
}

function ownershipPanelIn(dialog: View): ArchitectureOwnershipPanel {
  const panel = viewsIn(dialog).find(isOwnershipPanel);
  if (panel === undefined) throw new Error('Architecture-ownership laboratory is missing its teaching panel');
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

async function settle(): Promise<void> {
  for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
}

describe('Application architecture course contract', () => {
  test('should publish the completed catalog course with exact prerequisites, outcomes, and labs', () => {
    expect(source).not.toBe('');
    expect(guide).toMatchObject({
      title: 'Application architecture & best practices',
      page: '/guide/application-architecture',
      profile: 'course',
      stage: 'complete',
      prerequisites: ['application-shell', 'reactive-state', 'screens-and-routing'],
      learningOutcomes: [
        'Separate domain state, services, commands, screens, and view composition into durable boundaries.',
        'Choose ownership and dependency directions that keep a growing application testable and disposable.',
      ],
      requiredLiveExamples: 2,
      liveExampleException: null,
      examples: [...labIds],
    });
    for (const prerequisite of ['application-shell', 'reactive-state', 'screens-and-routing']) {
      expect(source).toContain(`](/guide/${prerequisite})`);
    }
  });

  test('should state the learner contract and progress from beginner boundaries to production judgment', () => {
    const sections = [
      '## Who is this course for?',
      '## What is the application-architecture mental model?',
      '## How do I build the first useful layered feature?',
      '## Laboratory: architecture boundaries',
      '## What belongs in the domain layer?',
      '## How do injected services cross host boundaries?',
      '## How do reactive state and actions coordinate work?',
      '## What belongs in JSVision presentation?',
      '## How does one command vocabulary connect the layers?',
      '## How do I choose state ownership by lifetime?',
      '## Laboratory: architecture ownership',
      '## How should dependencies point across packages and features?',
      '## How do screens and widgets compose without owning the domain?',
      '## What belongs in advanced application architecture?',
      '## How do I diagnose architectural failures?',
      '## What are the best practices?',
      '## What should I practice next?',
    ];
    let previous = -1;
    for (const section of sections) {
      const index = source.indexOf(section);
      expect(index, `missing or misplaced ${section}`).toBeGreaterThan(previous);
      previous = index;
    }
    expect(source).toMatch(/^description:\s*.+(?:architecture|boundaries).+(?:ownership|services|testability)/imu);
    expect(source).toMatch(/\bbuild\b[\s\S]*\bexplain\b[\s\S]*\bdiagnos(?:e|is)\b[\s\S]*\bverify\b/iu);
    expect(source).toContain(`<PlayExample id="${boundariesLabId}"`);
    expect(source).toContain(`<PlayExample id="${ownershipLabId}"`);
  });

  test('should teach four durable layers and dependency direction', () => {
    expect(source).toMatch(
      /domain invariants[\s\S]{0,450}injected services[\s\S]{0,450}reactive state[\s\S]{0,450}(?:JSVision )?presentation/iu,
    );
    expect(source).toMatch(/domain[\s\S]{0,350}(?:pure|framework-independent|no JSVision)/iu);
    expect(source).toMatch(/service[\s\S]{0,350}(?:interface|port|injected)[\s\S]{0,300}(?:host|adapter)/iu);
    expect(source).toMatch(/(?:state|actions)[\s\S]{0,350}(?:signal|computed)[\s\S]{0,300}(?:result|status|error)/iu);
    expect(source).toMatch(
      /presentation[\s\S]{0,350}(?:View|screen|layout)[\s\S]{0,300}(?:reads|dispatches|command)/iu,
    );
    expect(source).toMatch(/dependenc(?:y|ies)[\s\S]{0,350}(?:inward|toward|direction)/iu);
    expect(source).toMatch(/circular dependenc[\s\S]{0,450}(?:extract|invert|interface|package boundary)/iu);
  });

  test('should teach one command vocabulary, explicit results, and public package boundaries', () => {
    expect(source).toMatch(/one command vocabulary[\s\S]{0,450}(?:menu|status|button|keymap|screen)/iu);
    expect(source).toMatch(/onCommand\([\s\S]{0,300}emitCommand\(/iu);
    expect(source).toMatch(/(?:command|action)[\s\S]{0,350}(?:service)[\s\S]{0,350}(?:state|result)/iu);
    expect(source).toMatch(/(?:success|ok)[\s\S]{0,250}(?:error|failure)[\s\S]{0,250}(?:result|union|state)/iu);
    expect(source).toMatch(
      /(?:public entry|package entry|public API)[\s\S]{0,400}(?:do not|never|avoid)[\s\S]{0,250}(?:internal|src\/)/iu,
    );
    expect(source).toMatch(/(?:feature|package)[ -](?:boundary|facade)[\s\S]{0,350}(?:export|dependency)/iu);
  });

  test('should teach state ownership by lifetime and exact disposal', () => {
    expect(source).toMatch(/application lifetime[\s\S]{0,400}screen lifetime[\s\S]{0,400}widget lifetime/iu);
    expect(source).toMatch(/application[\s\S]{0,300}(?:session|shared|long-lived)[\s\S]{0,250}(?:service|state)/iu);
    expect(source).toMatch(/screen[\s\S]{0,350}(?:route|navigation|leave)[\s\S]{0,300}(?:cleanup|dispose|keepAlive)/iu);
    expect(source).toMatch(/widget[\s\S]{0,350}(?:onMount|onCleanup|mounted scope)/iu);
    expect(source).toMatch(
      /(?:acquire|start)[\s\S]{0,300}(?:release|cleanup)[\s\S]{0,250}(?:same owner|same lifetime)/iu,
    );
    expect(source).toMatch(/(?:exactly once|idempotent)[\s\S]{0,300}(?:dispose|cleanup)/iu);
  });

  test('should teach failure isolation, stale-work suppression, and safe diagnostics', () => {
    expect(source).toMatch(
      /(?:failure|error)[\s\S]{0,350}(?:isolat|boundary)[\s\S]{0,300}(?:other screen|rest of app|unchanged)/iu,
    );
    expect(source).toMatch(/(?:generation|stale)[\s\S]{0,400}(?:abort|cancel)[\s\S]{0,300}(?:dispose|late result)/iu);
    expect(source).toMatch(
      /(?:disposed|inactive) owner[\s\S]{0,350}(?:must not|never)[\s\S]{0,250}(?:publish|mutate)/iu,
    );
    expect(source).toMatch(/(?:bounded|limit)[\s\S]{0,250}diagnostic/iu);
    expect(source).toMatch(/(?:redact|value-free)[\s\S]{0,300}(?:secret|token|payload|diagnostic)/iu);
    expect(source).toMatch(/(?:user-visible|explicit)[\s\S]{0,300}(?:error state|retry|failure feedback)/iu);
  });

  test('should keep snippets public and close with failures, practices, exercises, and owning links', () => {
    const code = snippets();
    expect(code.length).toBeGreaterThanOrEqual(10);
    for (const snippet of code) {
      expect(snippet.split('\n').filter((line) => line.trim() !== '').length).toBeLessThanOrEqual(28);
      expect(snippet).not.toMatch(
        /(?:demoApp|Template1Dialog|defineExample|packages\/[^'"]+\/src|@jsvision\/ui\/src)/u,
      );
      for (const imported of snippet.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu)) {
        expect(['@jsvision/ui']).toContain(imported[1]);
      }
    }
    expect(source).toMatch(/symptom[\s\S]{0,300}cause[\s\S]{0,300}(?:correction|fix)[\s\S]{0,300}evidence/iu);
    for (const failure of [
      /circular dependenc/iu,
      /(?:screen|widget).+(?:owns|mutates).+(?:domain|application state)/iu,
      /(?:stale|late).+(?:result|work)/iu,
      /(?:leak|cleanup|dispose)/iu,
      /(?:error|failure).+(?:hidden|swallowed)/iu,
    ]) {
      expect(source).toMatch(failure);
    }
    expect(source).toMatch(/(?:exercise|experiment)[\s\S]{0,1000}(?:boundary|command|lifetime|failure|cleanup)/iu);
    expect(source).toContain('](/components/application/router)');
    expect(source).toContain('](/components/data-grid/)');
    expect(source).toContain('](/components/code-editor/)');
    expect(source).toContain('](/api/ui/functions/createApplication)');
    expect(source).toContain('](/api/ui/functions/createRouter)');
  });
});

describe('public architectural controls taught by the course', () => {
  test('should route one command through an injected service into explicit reactive state', async () => {
    const calls: number[] = [];
    const service: CounterService = {
      increment: async (current) => {
        calls.push(current);
        return { ok: true, value: current + 1 };
      },
    };
    const model = new CounterModel(service);
    const app = createApplication({ caps, viewport: { width: 20, height: 6 } });
    const stop = app.onCommand('counter.increment', () => {
      void model.increment();
    });
    app.loop.emitCommand('counter.increment');
    await settle();
    expect(calls).toEqual([0]);
    expect(model.value()).toBe(1);
    expect(model.status()).toBe('ready');
    expect(model.errorCode()).toBeNull();
    stop();
    app.loop.emitCommand('counter.increment');
    await settle();
    expect(calls).toEqual([0]);
    model.dispose();
    app.loop.dispose();
  });

  test('should publish explicit service failure without corrupting domain state', async () => {
    const model = new CounterModel({
      increment: async () => ({ ok: false, code: 'unavailable' }),
    });
    await model.increment();
    expect(model.value()).toBe(0);
    expect(model.status()).toBe('error');
    expect(model.errorCode()).toBe('unavailable');
    model.dispose();
  });

  test('should suppress stale and post-disposal service results', async () => {
    const first = deferred<Awaited<ReturnType<CounterService['increment']>>>();
    const second = deferred<Awaited<ReturnType<CounterService['increment']>>>();
    const third = deferred<Awaited<ReturnType<CounterService['increment']>>>();
    const requests = [first, second, third];
    let call = 0;
    const model = new CounterModel({
      increment: () => requests[call++]?.promise ?? Promise.resolve({ ok: false, code: 'unavailable' }),
    });
    const older = model.increment();
    const newer = model.increment();
    second.resolve({ ok: true, value: 2 });
    await newer;
    first.resolve({ ok: true, value: 1 });
    await older;
    expect(model.value()).toBe(2);
    const late = model.increment();
    model.dispose();
    third.resolve({ ok: true, value: 99 });
    await late;
    expect(model.value()).toBe(2);
  });

  test('should give application, screen, and widget owners distinct exact lifetimes', () => {
    type Routes = { home: void; detail: void };
    let homeCleanups = 0;
    let detailCleanups = 0;
    let widgetCleanups = 0;
    const homeBuilds: Group[] = [];
    const router = createRouter<Routes>({
      initial: { name: 'home' },
      routes: {
        home: {
          build: () => {
            const screen = new Group();
            const widget = new Text('Home');
            widget.onMount(() => widget.onCleanup(() => (widgetCleanups += 1)));
            screen.onMount(() => screen.onCleanup(() => (homeCleanups += 1)));
            screen.add(widget);
            homeBuilds.push(screen);
            return { view: screen };
          },
        },
        detail: {
          build: () => {
            const screen = new Group();
            screen.onMount(() => screen.onCleanup(() => (detailCleanups += 1)));
            screen.add(new Text('Detail'));
            return { view: screen };
          },
        },
      },
    });
    const app = createApplication({ caps, content: router, viewport: { width: 20, height: 6 } });
    router.push('detail');
    app.loop.renderRoot.flush();
    expect(homeCleanups).toBe(1);
    expect(widgetCleanups).toBe(1);
    router.back();
    app.loop.renderRoot.flush();
    expect(detailCleanups).toBe(1);
    expect(homeBuilds).toHaveLength(2);
    app.loop.dispose();
    expect(homeCleanups).toBe(2);
    expect(widgetCleanups).toBe(2);
  });
});

describe('Application architecture laboratory contract', () => {
  test('should register two application labs with objective-specific titles and blurbs', async () => {
    expect(registryEntry(boundariesLabId)).toMatchObject({
      kind: 'app',
      sourcePath: 'examples/guides/architecture-boundaries.ts',
      themeMenu: true,
    });
    expect(registryEntry(ownershipLabId)).toMatchObject({
      kind: 'app',
      sourcePath: 'examples/guides/architecture-ownership.ts',
      themeMenu: true,
    });
    const boundaries = await loadDefinition(boundariesLabId);
    const ownership = await loadDefinition(ownershipLabId);
    expect(boundaries.title).toMatch(/Architecture Boundaries (?:Laboratory|Workshop)/iu);
    expect(boundaries.blurb).toMatch(/coupled[\s\S]*(?:layered|command)[\s\S]*service[\s\S]*state/iu);
    expect(ownership.title).toMatch(/Architecture Ownership (?:Laboratory|Workshop)/iu);
    expect(ownership.blurb).toMatch(/application[\s\S]*screen[\s\S]*widget[\s\S]*(?:stale|failure)[\s\S]*cleanup/iu);
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

  test.each(labIds)('should remain padded and unclipped through resize, maximize, and restore', async (id) => {
    const definition = await loadDefinition(id);
    createRoot((dispose) => {
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

  test('should compare coupling honestly and prove the recommended command-service-state flow', async () => {
    const definition = await loadDefinition(boundariesLabId);
    let panel: ArchitectureBoundariesPanel | undefined;
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(boundariesLabId, definition);
      panel = boundariesPanelIn(dialog);
      expect(frameText(app)).toMatch(
        /Coupled path:\s*(?:anti-pattern|not recommended)[\s\S]*Layered path:\s*recommended/iu,
      );
      app.loop.dispatch(key('c', { alt: true }));
      expect(panel.coupledMutations).toBe(1);
      expect(frameText(app)).toMatch(/Coupled evidence:\s*(?:direct mutation|boundary bypass)/iu);
      app.loop.dispatch(key('l', { alt: true }));
      expect(panel.commandRuns).toBe(1);
      expect(panel.serviceCalls).toBe(1);
      expect(panel.statePublications).toBe(1);
      expect(frameText(app)).toMatch(/Flow:\s*command.+service.+state.+view/iu);
      clickButton(app, dialog, 'Layered flow');
      expect(frameText(app)).toMatch(/Action source:\s*mouse/iu);
      app.loop.dispose();
      dispose();
    });
    expect(panel?.cleanupCount).toBe(1);
  });

  test('should prove lifetime boundaries, failure isolation, stale suppression, and exact cleanup', async () => {
    const definition = await loadDefinition(ownershipLabId);
    let panel: ArchitectureOwnershipPanel | undefined;
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(ownershipLabId, definition);
      panel = ownershipPanelIn(dialog);
      expect(panel.applicationResources).toBe(1);
      expect(frameText(app)).toMatch(/Application:\s*alive[\s\S]*Screen:\s*home[\s\S]*Widget:\s*mounted/iu);
      app.loop.dispatch(key('n', { alt: true }));
      expect(panel.screenCleanups).toBe(1);
      expect(panel.widgetCleanups).toBe(1);
      app.loop.dispatch(key('f', { alt: true }));
      expect(panel.isolatedFailures).toBe(1);
      expect(frameText(app)).toMatch(/Failure:\s*isolated[\s\S]*Application:\s*alive/iu);
      app.loop.dispatch(key('s', { alt: true }));
      expect(panel.staleResultsSuppressed).toBe(1);
      expect(frameText(app)).toMatch(/Stale result:\s*suppressed/iu);
      clickButton(app, dialog, 'Navigate');
      expect(frameText(app)).toMatch(/Action source:\s*mouse/iu);
      app.loop.dispose();
      dispose();
    });
    expect(panel?.cleanupCount).toBeGreaterThanOrEqual(3);
  });

  test('should expose deterministic host-neutral, keyboard-complete, non-colour evidence and release all views', async () => {
    for (const id of labIds) {
      const definition = await loadDefinition(id);
      let mounted: View[] = [];
      createRoot((dispose) => {
        const { app, dialog } = buildLabExample(id, definition);
        mounted = viewsIn(dialog);
        expect(frameText(app)).toMatch(/Alt\+[A-Z]/u);
        expect(frameText(app)).toMatch(
          /(?:Coupled|Layered|Flow|Application|Screen|Widget|Failure|Stale result|Action):/iu,
        );
        expect(frameText(app)).toMatch(/(?:deterministic|in-memory|No network|bounded fixture)/iu);
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
