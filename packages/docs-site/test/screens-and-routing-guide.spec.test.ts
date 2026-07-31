/**
 * Immutable oracle for the Screens & routing course and its two teaching laboratories.
 *
 * The course must teach typed full-screen navigation as an application architecture concern:
 * stack operations, params, shared chrome, screen-state ownership, focus restoration, and exact
 * cleanup. The laboratories prove those outcomes with deterministic local screens.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createLogger, resolveCapabilities } from '@jsvision/core';
import {
  Button,
  Group,
  Input,
  Text,
  View,
  createApplication,
  createRoot,
  createRouter,
  effect,
  signal,
  statusItem,
} from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import type { Logger } from '@jsvision/core';
import type { Route } from '@jsvision/ui';
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

const guidePath = fileURLToPath(new URL('../guide/screens-and-routing.md', import.meta.url));
const catalogPath = fileURLToPath(new URL('../guides.json', import.meta.url));
const source = existsSync(guidePath) ? readFileSync(guidePath, 'utf8') : '';
const catalog = parseGuideCatalog(readFileSync(catalogPath, 'utf8'));
const guide = catalog.entries.find((candidate) => candidate.id === 'screens-and-routing');
const stackLabId = 'guides/routing-stack';
const lifecycleLabId = 'guides/routing-lifecycle';
const stackActionLabels = ['Push Next', 'Replace', 'Back', 'Reset'] as const;
const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;

interface RoutingStackPanel extends View {
  readonly lessonName: 'Typed routes, history, and shared chrome';
  readonly routeName: 'home' | 'detail' | 'settings';
  readonly detailId: number | null;
  readonly pushRuns: number;
  readonly backRuns: number;
  readonly replaceRuns: number;
  readonly resetRuns: number;
  readonly rootBackRuns: number;
  readonly cleanupCount: number;
}

interface RoutingLifecyclePanel extends View {
  readonly lessonName: 'Screen state, focus, and cleanup';
  readonly policy: 'dispose' | 'keep-alive';
  readonly navigationRuns: number;
  readonly listBuilds: number;
  readonly listCleanups: number;
  readonly restoredFocus: string;
  readonly localValue: string;
  readonly sameInstance: boolean;
  readonly cleanupCount: number;
}

/** Find a stable learner-facing panel in a rendered Guide laboratory. */
function panelIn<T extends View>(dialog: View, lessonName: string): T {
  const panel = viewsIn(dialog).find((view): view is T => 'lessonName' in view && view.lessonName === lessonName);
  if (panel === undefined) throw new Error(`Screens & routing lab is missing "${lessonName}"`);
  return panel;
}

/** Return authored TypeScript snippets without treating live-example modules as snippets. */
function snippets(): readonly string[] {
  return [...source.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/gu)].map((match) => match[1] ?? '');
}

/** Load one registered Guide application laboratory. */
async function loadDefinition(id: string): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(`Missing example registry entry: ${id}`);
  return (await entry.load()).default;
}

/** Drag the real resize affordance to prove responsive behavior through the public interaction. */
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
    to: { x: corner.x + 8, y: corner.y + 3 },
  });
}

/** Activate one real Button by mouse through its rendered terminal coordinates. */
function clickButton(app: ReturnType<typeof buildLabExample>['app'], button: Button): void {
  const origin = absoluteOrigin(button);
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'click',
    at: { x: origin.x + 1, y: origin.y },
  });
}

/** Verify every routing action has room for its complete rendered button face. */
function expectStackActionButtonsFit(
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
): void {
  const buttons = viewsIn(dialog).filter((view): view is Button => view instanceof Button);
  for (const label of stackActionLabels) {
    const button = buttons.find((candidate) => candidate.activation.label === label);
    if (button === undefined) throw new Error(`Routing stack lab is missing ${label}`);
    expect(button.bounds.width, `${label} button clips its natural face`).toBeGreaterThanOrEqual(
      button.measure().width,
    );
    expect(frameText(app)).toContain(label);
  }
}

describe('Screens & routing course contract', () => {
  test('should publish the completed course with exact prerequisites, outcomes, and laboratories', () => {
    expect(source).not.toBe('');
    expect(guide).toMatchObject({
      title: 'Screens & routing',
      page: '/guide/screens-and-routing',
      profile: 'course',
      stage: 'complete',
      prerequisites: ['application-shell', 'views-and-focus'],
      learningOutcomes: [
        'Model full-screen navigation with typed routes, parameters, history, and shared chrome.',
        'Preserve or release screen state and focus deliberately across navigation.',
      ],
      requiredLiveExamples: 2,
      liveExampleException: null,
      examples: [stackLabId, lifecycleLabId],
    });
  });

  test('should state the learner contract and follow a complete question-led course backbone', () => {
    const sections = [
      '## Who is this course for?',
      '## What is the routing mental model?',
      '## How do I build the first useful router?',
      '## Laboratory: typed routes, history, and shared chrome',
      '## How do stack operations model navigation intent?',
      '## How do parameters and location state stay typed?',
      '## How does each screen compose with shared chrome?',
      '## Laboratory: screen state, focus, and cleanup',
      '## When should a screen be rebuilt or kept alive?',
      '## How does focus return after navigation?',
      '## How do routing and application architecture integrate?',
      '## What advanced and host-specific behavior matters?',
      '## How do I diagnose routing failures?',
      '## What are the best practices?',
      '## What should I practice next?',
    ];
    let previous = -1;
    for (const section of sections) {
      const index = source.indexOf(section);
      expect(index, `missing or misplaced ${section}`).toBeGreaterThan(previous);
      previous = index;
    }

    expect(source).toMatch(/^description:\s*.+(?:route|screen).+(?:history|focus|state).+$/imu);
    expect(source).toMatch(
      /\bbuild\b[\s\S]{0,500}\bexplain\b[\s\S]{0,500}\bdiagnos(?:e|is)\b[\s\S]{0,500}\bverify\b/iu,
    );
    expect(source).toMatch(
      /(?:assume|already know|comfortable with)[\s\S]{0,450}(?:application shell)[\s\S]{0,350}(?:view|focus)/iu,
    );
    expect(source).toMatch(/beginner[\s\S]{0,450}intermediate[\s\S]{0,450}advanced/iu);
    expect(source).toContain(`<PlayExample id="${stackLabId}"`);
    expect(source).toContain(`<PlayExample id="${lifecycleLabId}"`);
  });

  test('should teach the public typed route model and the four distinct stack operations', () => {
    expect(source).toMatch(
      /type\s+Routes[\s\S]{0,500}home:\s*void[\s\S]{0,300}detail:\s*\{\s*id:\s*(?:number|string)/iu,
    );
    expect(source).toMatch(/createRouter\s*<\s*Routes\s*>[\s\S]{0,500}initial[\s\S]{0,250}routes/iu);
    expect(source).toMatch(/RouteContext|ctx\.params/u);
    expect(source).toMatch(/push[\s\S]{0,250}(?:add|new)[\s\S]{0,250}(?:stack|history)/iu);
    expect(source).toMatch(/back[\s\S]{0,250}(?:pop|previous|root)/iu);
    expect(source).toMatch(/replace[\s\S]{0,250}(?:same|unchanged)[\s\S]{0,250}(?:depth|history)/iu);
    expect(source).toMatch(/reset[\s\S]{0,250}(?:one|single|collapse)[\s\S]{0,250}(?:root|frame|history)/iu);
    expect(source).toMatch(/back\(\)[\s\S]{0,180}false[\s\S]{0,220}(?:root|policy)/iu);
    expect(source).toMatch(/location\(\)[\s\S]{0,300}canGoBack\(\)[\s\S]{0,350}(?:reactive|effect|binding)/iu);

    const firstResult = snippets().find(
      (snippet) =>
        /from ['"]@jsvision\/ui['"]/u.test(snippet) &&
        /\bcreateRouter\s*<\s*Routes\s*>/u.test(snippet) &&
        /\bcreateApplication\s*\(\s*\{\s*content:\s*router/u.test(snippet),
    );
    expect(firstResult, 'minimal public createRouter/createApplication snippet').toBeDefined();
  });

  test('should teach shared chrome, state ownership, retention, and route-owned cleanup', () => {
    expect(source).toMatch(/ScreenBundle[\s\S]{0,450}(?:status|menu)[\s\S]{0,350}(?:replace|base)/iu);
    expect(source).toMatch(/withBase[\s\S]{0,350}(?:global|base)[\s\S]{0,300}(?:screen|route)/iu);
    expect(source).toMatch(/keepAlive[\s\S]{0,350}(?:default|false|opt-in)[\s\S]{0,350}(?:mounted|hidden)/iu);
    expect(source).toMatch(
      /(?:default|dispose)[\s\S]{0,400}(?:navigate away|navigation)[\s\S]{0,350}(?:rebuild|fresh)[\s\S]{0,300}(?:cleanup|onCleanup)/iu,
    );
    expect(source).toMatch(
      /(?:application|long-lived)[ -]state[\s\S]{0,350}(?:above|outside)[\s\S]{0,350}(?:screen|route)[ -]state[\s\S]{0,350}(?:owner|cleanup|dispose)/iu,
    );
    expect(source).toMatch(/timer|subscription|async/iu);
    expect(source).toMatch(/onMount[\s\S]{0,350}onCleanup/iu);
  });

  test('should teach exact, keyed, structural, and fallback focus restoration', () => {
    expect(source).toMatch(/(?:warm|keepAlive)[\s\S]{0,300}exact[\s\S]{0,250}(?:view|focus)/iu);
    expect(source).toMatch(/focusKey[\s\S]{0,350}(?:stable|key)[\s\S]{0,350}(?:rebuild|reshap)/iu);
    expect(source).toMatch(/(?:index|structural)[ -]path[\s\S]{0,350}(?:same position|same-position|rebuild)/iu);
    expect(source).toMatch(/first focusable[\s\S]{0,300}(?:fallback|floor)/iu);
    expect(source).toMatch(
      /(?:hidden|disabled|removed|unmounted)[\s\S]{0,400}(?:ineligible|no-op|fallback)[\s\S]{0,350}(?:visible focus|focus evidence|focused)/iu,
    );
  });

  test('should teach codecs and host boundaries without claiming automatic deep-link restoration', () => {
    expect(source).toMatch(/serialize[\s\S]{0,250}parse[\s\S]{0,350}(?:round-trip|codec)/iu);
    expect(source).toMatch(
      /(?:does not|not)[\s\S]{0,250}(?:automatically|automatic)[\s\S]{0,300}(?:URL|deep link|restore|browser history)/iu,
    );
    expect(source).toMatch(
      /(?:host|application)[\s\S]{0,350}(?:validate|allowlist)[\s\S]{0,350}(?:route|parameter|decoded)/iu,
    );
    expect(source).toMatch(
      /build[\s\S]{0,300}(?:throw|error)[\s\S]{0,350}(?:abort|unchanged|current screen)[\s\S]{0,250}log/iu,
    );
    expect(source).toMatch(/(?:redact|sensitive)[\s\S]{0,300}(?:parameter|diagnostic|log)/iu);
  });

  test('should include concrete diagnosis, practices, exercises, and owning references', () => {
    for (const phrase of ['wrong screen', 'back', 'focus', 'state', 'cleanup', 'clipped', 'build']) {
      expect(source.toLowerCase()).toContain(phrase);
    }
    expect(source).toMatch(/symptom[\s\S]{0,200}cause[\s\S]{0,200}(?:correction|fix)[\s\S]{0,200}evidence/iu);
    expect(source).toMatch(/## What should I practice next\?[\s\S]{0,1800}(?:exercise|experiment)/iu);
    expect(source).toContain('../guide/application-shell');
    expect(source).toContain('../guide/views-and-focus');
    expect(source).toContain('/components/application/router');
    expect(source).toContain('/api/ui/functions/createRouter');
    expect(source).toContain('/api/ui/interfaces/Router');
  });
});

describe('Screens & routing public behavior evidence', () => {
  test('should keep typed location and back availability reactive across every stack operation', () => {
    type Routes = { home: void; detail: { id: number }; settings: void };
    const router = createRouter<Routes>({
      initial: { name: 'home' },
      routes: {
        home: { build: () => ({ view: new Text('Home') }) },
        detail: { build: ({ params }) => ({ view: new Text(`Detail ${params.id}`) }) },
        settings: { build: () => ({ view: new Text('Settings') }) },
      },
    });
    const names: string[] = [];
    const backable: boolean[] = [];
    createRoot((dispose) => {
      effect(() => names.push(String(router.location().name)));
      effect(() => backable.push(router.canGoBack()));

      router.push('detail', { id: 42 });
      router.replace('settings');
      expect(router.back()).toBe(true);
      router.reset('home');
      expect(router.back()).toBe(false);

      expect(names).toEqual(['home', 'detail', 'settings', 'home', 'home']);
      expect(backable).toEqual([false, true, true, false, false]);
      expect(router.location()).toEqual({ name: 'home', params: undefined });
      dispose();
    });
  });

  test('should rebuild default screens but retain an opted-in screen and release both exactly once', () => {
    type Routes = { list: void; detail: void };
    const listBuilds: Group[] = [];
    const cleanups: string[] = [];
    const router = createRouter<Routes>({
      initial: { name: 'list' },
      routes: {
        list: {
          keepAlive: true,
          build: () => {
            const view = new Group();
            listBuilds.push(view);
            view.onMount(() => view.onCleanup(() => cleanups.push('list')));
            return { view };
          },
        },
        detail: {
          build: () => {
            const view = new Group();
            view.onMount(() => view.onCleanup(() => cleanups.push('detail')));
            return { view };
          },
        },
      },
    });
    const app = createApplication({ caps, content: router, viewport: { width: 40, height: 12 } });
    app.loop.renderRoot.flush();

    const retained = listBuilds[0];
    router.push('detail');
    app.loop.renderRoot.flush();
    expect(retained?.mounted).toBe(true);
    expect(retained?.state.visible).toBe(false);
    expect(router.back()).toBe(true);
    app.loop.renderRoot.flush();
    expect(listBuilds).toHaveLength(1);
    expect(cleanups).toEqual(['detail']);

    app.loop.dispose();
    expect(cleanups).toEqual(['detail', 'list']);
  });

  test('should restore rebuilt focus by stable key before structural fallback', () => {
    type Routes = { form: void; detail: void };
    const formFields: Input[][] = [];
    const focusKeys = new WeakMap<View, string>();
    const router = createRouter<Routes>({
      initial: { name: 'form' },
      routes: {
        form: {
          focusKey: (view) => focusKeys.get(view) ?? 'screen',
          build: () => {
            const first = new Input({ value: signal('first') });
            const target = new Input({ value: signal('target') });
            focusKeys.set(first, 'first');
            focusKeys.set(target, 'target');
            const root = new Group();
            root.add(first);
            root.add(target);
            formFields.push([first, target]);
            return { view: root };
          },
        },
        detail: { build: () => ({ view: new Input({ value: signal('detail') }) }) },
      },
    });
    const app = createApplication({ caps, content: router, viewport: { width: 40, height: 12 } });
    app.loop.renderRoot.flush();

    const initialTarget = formFields[0]?.[1];
    if (initialTarget === undefined) throw new Error('Initial target field was not built');
    app.loop.focusView(initialTarget);
    router.push('detail');
    app.loop.renderRoot.flush();
    expect(initialTarget.mounted).toBe(false);

    expect(router.back()).toBe(true);
    app.loop.renderRoot.flush();
    const rebuiltTarget = formFields[1]?.[1];
    if (rebuiltTarget === undefined) throw new Error('Rebuilt target field was not built');
    expect(app.loop.getFocused()).toBe(rebuiltTarget);
    expect(rebuiltTarget).not.toBe(initialTarget);
    app.loop.dispose();
  });

  test('should isolate route-build failures and preserve the current location', () => {
    type Routes = { home: void; denied: void };
    const errors: string[] = [];
    const metadata: Record<string, unknown>[] = [];
    const logger: Logger = {
      ...createLogger(),
      error: (component, message, fields) => {
        errors.push(`${component}:${message}`);
        metadata.push(fields ?? {});
      },
    };
    const router = createRouter<Routes>({
      initial: { name: 'home' },
      logger,
      routes: {
        home: { build: () => ({ view: new Text('Home'), status: [statusItem('Ready')] }) },
        denied: {
          build: () => {
            throw new Error('sensitive fixture detail');
          },
        },
      },
    });

    expect(() => router.push('denied')).not.toThrow();
    expect(router.location()).toEqual({ name: 'home', params: undefined });
    expect(errors).toEqual(['router:route build threw']);
    expect(metadata).toEqual([
      {
        route: 'denied',
        error: 'Error: sensitive fixture detail',
      },
    ]);
  });

  test('should validate required codec input before publishing typed route parameters', () => {
    const route: Route<{ id: number }> = {
      build: ({ params }) => ({ view: new Text(`Record ${params.id}`) }),
      serialize: ({ id }) => `id=${id}`,
      parse: (value) => {
        const raw = new URLSearchParams(value).get('id');
        if (raw === null || !/^[1-9]\d{0,5}$/u.test(raw)) throw new Error('invalid record route');
        const id = Number(raw);
        if (!Number.isSafeInteger(id) || id > 100_000) throw new Error('invalid record route');
        return { id };
      },
    };

    expect(route.parse?.('id=42')).toEqual({ id: 42 });
    for (const invalid of ['', 'name=missing', 'id=nope', 'id=0', 'id=100001', 'id=99999999999999999999']) {
      expect(() => route.parse?.(invalid)).toThrow('invalid record route');
    }
  });
});

describe('Screens & routing live laboratories', () => {
  test.each([
    [stackLabId, 'Typed routes, history, and shared chrome'],
    [lifecycleLabId, 'Screen state, focus, and cleanup'],
  ] as const)('should render %s as a compact, responsive Classic application', async (id, lessonName) => {
    const definition = await loadDefinition(id);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(id, definition);
      panelIn(dialog, lessonName);
      collectTemplate1Evidence(app, dialog);
      if (id === stackLabId) expectStackActionButtonsFit(app, dialog);
      app.loop.dispose();
      dispose();
    });

    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(id, definition, {
        viewport: { width: 70, height: 24 },
      });
      collectTemplate1Evidence(app, dialog);
      if (id === stackLabId) expectStackActionButtonsFit(app, dialog);
      app.loop.dispose();
      dispose();
    });

    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(id, definition, {
        viewport: { width: 120, height: 40 },
      });
      resizeDialog(app, dialog);
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      app.loop.dispose();
      dispose();
    });
  });

  test('should expose push, back, replace, reset, params, and root policy through real actions', async () => {
    const definition = await loadDefinition(stackLabId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(stackLabId, definition);
      const panel = panelIn<RoutingStackPanel>(dialog, 'Typed routes, history, and shared chrome');

      dispatchExampleAction(app, { kind: 'key', key: 'n', modifiers: ['Alt'] });
      app.loop.renderRoot.flush();
      expect(panel.routeName).toBe('detail');
      expect(panel.detailId).toBe(42);
      expect(frameText(app)).toMatch(/Record[\s\S]*Detail/iu);
      expect(frameText(app)).not.toMatch(/Home base/iu);
      dispatchExampleAction(app, { kind: 'key', key: 'p', modifiers: ['Alt'] });
      app.loop.renderRoot.flush();
      expect(panel.routeName).toBe('settings');
      expect(frameText(app)).toMatch(/Preferences[\s\S]*Settings/iu);
      expect(frameText(app)).not.toMatch(/║\s+Record\s+║/u);
      expect(frameText(app)).not.toMatch(/║\s+Detail\s+║/u);
      dispatchExampleAction(app, { kind: 'key', key: 'b', modifiers: ['Alt'] });
      app.loop.renderRoot.flush();
      expect(panel.routeName).toBe('home');
      expect(frameText(app)).toMatch(/Home[\s\S]*Home base/iu);
      expect(frameText(app)).not.toMatch(/║\s+Preferences\s+║/u);
      expect(frameText(app)).not.toMatch(/║\s+Settings\s+║/u);
      dispatchExampleAction(app, { kind: 'key', key: 'b', modifiers: ['Alt'] });
      dispatchExampleAction(app, { kind: 'key', key: 'n', modifiers: ['Alt'] });
      dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
      app.loop.renderRoot.flush();

      expect(panel.routeName).toBe('home');
      expect(panel.pushRuns).toBe(2);
      expect(panel.backRuns).toBe(1);
      expect(panel.replaceRuns).toBe(1);
      expect(panel.resetRuns).toBe(1);
      expect(panel.rootBackRuns).toBe(1);
      expect(frameText(app)).toMatch(/home[\s\S]*(?:base|shared)[\s\S]*(?:root|cannot go back)/iu);
      app.loop.dispose();
      dispose();
      expect(panel.cleanupCount).toBe(1);
    });
  });

  test('should expose every stack action through mouse controls', async () => {
    const definition = await loadDefinition(stackLabId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(stackLabId, definition);
      const panel = panelIn<RoutingStackPanel>(dialog, 'Typed routes, history, and shared chrome');
      const buttons = viewsIn(dialog).filter((view): view is Button => view instanceof Button);
      for (const label of stackActionLabels) {
        const button = buttons.find((candidate) => candidate.activation.label === label);
        if (button === undefined) throw new Error(`Routing stack lab is missing ${label}`);
        clickButton(app, button);
      }
      expect(
        buttons
          .filter((button) => stackActionLabels.some((label) => label === button.activation.label))
          .flatMap((button) => button.accelerators()),
      ).toEqual(['n', 'p', 'b', 'r']);

      expect(panel.pushRuns).toBe(1);
      expect(panel.replaceRuns).toBe(1);
      expect(panel.backRuns).toBe(1);
      expect(panel.resetRuns).toBe(1);
      app.loop.dispose();
      dispose();
    });
  });

  test('should compare disposal and keep-alive with exact state, focus, and cleanup evidence', async () => {
    const definition = await loadDefinition(lifecycleLabId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(lifecycleLabId, definition);
      const panel = panelIn<RoutingLifecyclePanel>(dialog, 'Screen state, focus, and cleanup');
      const buttons = viewsIn(dialog).filter((view): view is Button => view instanceof Button);
      const navigate = buttons.find((candidate) => candidate.activation.label === 'Round Trip');
      const policy = buttons.find((candidate) => candidate.activation.label === 'Toggle Policy');
      const mutate = buttons.find((candidate) => candidate.activation.label === 'Mutate Local');
      if (navigate === undefined || policy === undefined || mutate === undefined) {
        throw new Error('Routing lifecycle actions are missing');
      }

      dispatchExampleAction(app, { kind: 'key', key: 'm', modifiers: ['Alt'] });
      expect(panel.localValue).toBe('edited-g1');
      dispatchExampleAction(app, { kind: 'key', key: 't', modifiers: ['Alt'] });
      expect(panel.navigationRuns).toBe(1);
      expect(panel.listBuilds).toBe(2);
      expect(panel.listCleanups).toBe(1);
      expect(panel.sameInstance).toBe(false);
      expect(panel.localValue).toBe('filter');
      expect(panel.restoredFocus).toMatch(/filter|query|field/iu);

      clickButton(app, policy);
      expect(panel.policy).toBe('keep-alive');
      clickButton(app, mutate);
      expect(panel.localValue).toBe('edited-g3');
      clickButton(app, navigate);
      app.loop.renderRoot.flush();
      expect(panel.navigationRuns).toBe(2);
      expect(panel.listBuilds).toBe(3);
      expect(panel.listCleanups).toBe(2);
      expect(panel.sameInstance).toBe(true);
      expect(panel.localValue).toBe('edited-g3');
      expect(frameText(app)).toMatch(/Policy: keep-alive/iu);
      expect(frameText(app)).toMatch(/Generation: 3 · local value: edited-g3/iu);
      expect(frameText(app)).toMatch(/Restored focus: filter field/iu);
      expect(frameText(app)).toMatch(/Status: same instance preserved/iu);

      app.loop.focusView(navigate);
      expect(navigate.state.focused).toBe(true);
      collectTemplate1Evidence(app, dialog);
      app.loop.dispose();
      dispose();
      expect(panel.cleanupCount).toBe(1);
    });
  });
});
