/**
 * Immutable specification coverage for the Events, commands & keymaps course and laboratories.
 *
 * The oracle follows the public routing, command, and keymap contracts. It intentionally precedes
 * the course implementation and describes observable teaching outcomes in plain language.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  Button,
  Group,
  View,
  createEventLoop,
  createKeymap,
  createRoot,
  type AppEvent,
  type DispatchEvent,
  type DrawContext,
} from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import type { ExampleDefinition } from '../examples/_contract.js';
import { EXAMPLES } from '../examples/index.js';
import { parseGuideCatalog } from '../src/guides/guide-catalog.mjs';
import {
  EXAMPLE_CAPS,
  absoluteOrigin,
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  key,
  viewsIn,
} from './example-lab-harness.js';

const guidePath = fileURLToPath(new URL('../guide/events-commands-and-keymaps.md', import.meta.url));
const catalogPath = fileURLToPath(new URL('../guides.json', import.meta.url));
const source = readFileSync(guidePath, 'utf8');
const catalog = parseGuideCatalog(readFileSync(catalogPath, 'utf8'));
const guide = catalog.entries.find((candidate) => candidate.id === 'events-commands-and-keymaps');

const routingLabId = 'guides/event-routing';
const precedenceLabId = 'guides/command-precedence';
const labIds = [routingLabId, precedenceLabId] as const;

function snippets(markdown: string): string[] {
  return [...markdown.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/g)].map((match) => match[1] ?? '');
}

function registryEntry(id: string) {
  return EXAMPLES.find((candidate) => candidate.id === id);
}

async function loadDefinition(id: string): Promise<ExampleDefinition> {
  const entry = registryEntry(id);
  if (entry === undefined) throw new Error(`Missing example registry entry: ${id}`);
  return (await entry.load()).default;
}

function expectCourseText(pattern: RegExp, purpose: string): void {
  expect(source, purpose).toMatch(pattern);
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
    to: { x: from.x + 8, y: from.y + 3 },
  });
}

function renderedTextOrigin(app: ReturnType<typeof buildLabExample>['app'], text: string): { x: number; y: number } {
  const rows = app.loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''));
  for (const [y, row] of rows.entries()) {
    const x = row.indexOf(text);
    if (x >= 0) return { x, y };
  }
  throw new Error(`Rendered laboratory is missing "${text}"`);
}

/** A public View that records the phase and event type offered to it. */
class PhaseRecorder extends View {
  readonly seen: AppEvent[] = [];

  constructor(
    readonly label: string,
    private readonly order: string[],
    private readonly consume: ReadonlySet<AppEvent['type']> = new Set(),
  ) {
    super();
  }

  draw(_ctx: DrawContext): void {}

  override onEvent(event: DispatchEvent): void {
    this.seen.push(event.event);
    this.order.push(`${event.event.type}:${this.label}`);
    if (this.consume.has(event.event.type)) event.handled = true;
  }
}

/** A public Group that records mouse and wheel bubbling without changing routing. */
class BubbleRecorder extends Group {
  constructor(
    readonly label: string,
    private readonly order: string[],
  ) {
    super();
  }

  override onEvent(event: DispatchEvent): void {
    if (event.event.type === 'mouse' || event.event.type === 'wheel') {
      this.order.push(this.label);
    }
  }
}

describe('Events, commands & keymaps guide course contract', () => {
  test('keeps the confirmed course profile, prerequisite, outcomes, and two laboratories', () => {
    expect(guide).toBeDefined();
    expect(guide?.profile).toBe('course');
    expect(['upgrade', 'complete']).toContain(guide?.stage);
    expect(guide?.prerequisites).toEqual(['views-and-focus']);
    expect(guide?.learningOutcomes).toEqual([
      'Trace keyboard, mouse, paste, and command events through the view tree.',
      'Define discoverable commands and resolve keymap precedence without collisions.',
    ]);
    expect(guide?.requiredLiveExamples).toBe(2);
    expect(guide?.liveExampleException).toBeNull();
    expect(guide?.examples).toEqual([...labIds]);
  });

  test('states its audience, prerequisite knowledge, motivating problem, and capabilities', () => {
    expectCourseText(/^description:\s*.+(?:event|command|keymap).+$/m, 'search-friendly frontmatter');
    expectCourseText(/^# Events, commands (?:and|&) keymaps$/m, 'course title');
    expectCourseText(/^## (?:Who this course is for|Course introduction)$/m, 'course introduction');
    expectCourseText(/\/guide\/views-and-focus/i, 'Views and focus prerequisite');
    expectCourseText(/(?:assume|already know|comfortable with)[\s\S]{0,450}(?:view tree|focus)/i, 'assumed knowledge');
    expectCourseText(
      /(?:workspace|form|application|shortcut)[\s\S]{0,500}(?:event|command|key)/i,
      'motivating problem',
    );
    expectCourseText(
      /\btrace\b[\s\S]{0,400}\bdefine\b[\s\S]{0,400}(?:resolve|diagnos)/i,
      'trace, define, and resolve capabilities',
    );
    expectCourseText(/\bverif(?:y|ication)\b/i, 'verification capability');
  });

  test('uses the complete course backbone in teaching order', () => {
    const sections = [
      /^## Mental model$/m,
      /^## (?:Your )?first useful result$/m,
      /^## (?:Route key, paste, and command events|Three-phase event routing)$/m,
      /^## Mouse and wheel routing$/m,
      /^## Commands and discoverability$/m,
      /^## Keymaps and precedence$/m,
      /^## Composition and integration$/m,
      /^## Advanced behavior$/m,
      /^## Failure modes and diagnosis$/m,
      /^## Best practices$/m,
      /^## Practice and next steps$/m,
    ];

    let previous = -1;
    for (const section of sections) {
      const index = source.search(section);
      expect(index, `missing or misplaced ${section}`).toBeGreaterThan(previous);
      previous = index;
    }

    const primaryLab = source.indexOf(`<PlayExample id="${routingLabId}"`);
    expect(primaryLab).toBeGreaterThan(source.search(sections[1]!));
    expect(primaryLab).toBeLessThan(source.search(sections[4]!));
  });

  test('teaches the three routing phases and handled short-circuit precisely', () => {
    expectCourseText(/pre-process[\s\S]{0,450}(?:root[- ]down|root to leaf|top[- ]down)/i, 'pre-process direction');
    expectCourseText(/focused (?:leaf|view)[\s\S]{0,450}(?:leaf[- ]up|bubble|ancestor)/i, 'focused-chain direction');
    expectCourseText(/post-process[\s\S]{0,450}(?:last|final|survived)/i, 'post-process phase');
    expectCourseText(/handled[\s\S]{0,450}(?:short-circuit|stop|remaining)/i, 'handled short-circuit');
    expectCourseText(
      /(?:key|keyboard)[\s\S]{0,220}paste[\s\S]{0,220}command[\s\S]{0,500}(?:three|phase)/i,
      'events using the three-phase route',
    );
  });

  test('distinguishes hit-tested pointer bubbling from focused event routing', () => {
    expectCourseText(/mouse[\s\S]{0,350}(?:hit test|hit-test)/i, 'mouse hit testing');
    expectCourseText(/wheel[\s\S]{0,350}(?:hit test|hit-test)/i, 'wheel hit testing');
    expectCourseText(
      /(?:target|hit view)[\s\S]{0,400}(?:parent|ancestor|bubble)[\s\S]{0,300}(?:handled|stop)/i,
      'target-up bubbling',
    );
    expectCourseText(
      /(?:mouse|wheel)[\s\S]{0,450}(?:skip|do not use|bypass)[\s\S]{0,300}(?:pre-process|three-phase)/i,
      'pointer route boundary',
    );
  });

  test('teaches keymap conversion, Tab handling, precedence, and validation', () => {
    expectCourseText(
      /createKeymap\([\s\S]{0,500}(?:chord|binding)[\s\S]{0,350}(?:command|intent)/i,
      'keymap construction',
    );
    expectCourseText(
      /(?:matched|bound)[\s\S]{0,400}(?:before|ahead of)[\s\S]{0,300}(?:phase|view)/i,
      'keymap precedence before routing',
    );
    expectCourseText(
      /raw key[\s\S]{0,350}(?:swallow|consum|not delivered|never reaches)/i,
      'bound raw-key suppression',
    );
    expectCourseText(/unbound[\s\S]{0,250}(?:Tab|Shift\+Tab)[\s\S]{0,400}(?:focus|special)/i, 'unbound Tab behavior');
    expectCourseText(
      /(?:application|user|app) keymap[\s\S]{0,450}(?:win|override|precedence)[\s\S]{0,300}(?:default|clipboard)/i,
      'application binding precedence',
    );
    expectCourseText(
      /(?:invalid|unknown modifier|missing key)[\s\S]{0,350}(?:throw|fail fast|construction)/i,
      'invalid chord validation',
    );
    expectCourseText(/collision[\s\S]{0,500}(?:audit|avoid|resolve|unique)/i, 'collision prevention');
  });

  test('teaches command ownership, enablement, warnings, cleanup, and modal scope', () => {
    expectCourseText(/onCommand\([\s\S]{0,400}(?:pre-process|before)[\s\S]{0,300}focus/i, 'onCommand precedence');
    expectCourseText(/onCommand\([\s\S]{0,500}(?:unsubscribe|cleanup|dispose|returns)/i, 'handler cleanup');
    expectCourseText(/(?:enabled by default|default[\s\S]{0,120}enabled)/i, 'default command enablement');
    expectCourseText(
      /enableCommand\([\s\S]{0,350}(?:false|disabled)[\s\S]{0,350}(?:drop|not route|ignored)/i,
      'disabled command behavior',
    );
    expectCourseText(/isCommandEnabled\(/, 'enablement query');
    expectCourseText(
      /(?:unmatched|unhandled|misspelled)[\s\S]{0,400}(?:dev|development)[ -]?warn/i,
      'unmatched command warning',
    );
    expectCourseText(
      /modal[\s\S]{0,500}(?:scope|confine|contained)[\s\S]{0,350}(?:command|onCommand)/i,
      'modal command confinement',
    );
  });

  test('uses accurate concept-sized public TypeScript snippets', () => {
    const code = snippets(source);
    const combined = code.join('\n');
    const imports = [...combined.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);

    expect(code.length).toBeGreaterThanOrEqual(6);
    expect(imports.length).toBeGreaterThan(0);
    expect(imports.every((path) => path === '@jsvision/ui')).toBe(true);
    expect(combined).not.toMatch(/@jsvision\/ui\/src|packages\/ui\/src|\.\.\/src\//);
    expect(code.some((snippet) => /onEvent\(/.test(snippet))).toBe(true);
    expect(code.some((snippet) => /preProcess|postProcess/.test(snippet))).toBe(true);
    expect(code.some((snippet) => /event\.handled|ev\.handled/.test(snippet))).toBe(true);
    expect(code.some((snippet) => /createKeymap\(/.test(snippet))).toBe(true);
    expect(code.some((snippet) => /\.onCommand\(/.test(snippet))).toBe(true);
    expect(code.some((snippet) => /\.enableCommand\(/.test(snippet))).toBe(true);
  });

  test('places both laboratories beside explicit learning objectives', () => {
    for (const id of labIds) expect(source).toContain(`<PlayExample id="${id}"`);
    expectCourseText(
      /event-routing[\s\S]{0,550}(?:keyboard|key)[\s\S]{0,250}mouse[\s\S]{0,250}paste[\s\S]{0,250}command/i,
      'routing lab objective',
    );
    expectCourseText(
      /command-precedence[\s\S]{0,550}(?:precedence|collision)[\s\S]{0,400}(?:disabled|enablement)/i,
      'precedence lab objective',
    );
  });

  test('includes diagnosis, production guidance, practice, and ownership-aware next links', () => {
    expectCourseText(
      /symptom[\s\S]{0,250}cause[\s\S]{0,250}(?:correction|fix)[\s\S]{0,250}evidence/i,
      'diagnosis table',
    );
    expectCourseText(
      /(?:handled too early|early handler|never reaches)[\s\S]{0,500}(?:phase|view)/i,
      'early consumption failure',
    );
    expectCourseText(/(?:collision|same chord)[\s\S]{0,500}(?:precedence|winner|override)/i, 'key collision failure');
    expectCourseText(/disabled command[\s\S]{0,500}(?:drop|silent|nothing)/i, 'disabled command failure');
    expectCourseText(/(?:typo|misspell|unmatched)[\s\S]{0,450}(?:warn|nothing happens)/i, 'unmatched command failure');
    expectCourseText(/(?:ASCII|plain text)[ -]?(?:safe|feedback)|non-colou?r/i, 'portable non-color evidence');
    expectCourseText(/(?:exercise|experiment)[\s\S]{0,900}(?:mouse|paste|command)/i, 'routing practice');
    expectCourseText(/(?:exercise|experiment)[\s\S]{0,900}(?:collision|precedence|disable)/i, 'precedence practice');

    for (const link of [
      '/guide/views-and-focus',
      '/guide/keyboard-and-clipboard',
      '/guide/dialogs-and-modality',
      '/api/ui/interfaces/EventLoop',
      '/api/ui/classes/View',
    ]) {
      expect(source).toContain(link);
    }
  });
});

describe('public event, command, and keymap behavior taught by the course', () => {
  test('routes key, paste, and command events through pre, focused, and post phases', () => {
    const order: string[] = [];
    const pre = new PhaseRecorder('pre', order);
    pre.preProcess = true;
    const focused = new PhaseRecorder('focused', order);
    focused.focusable = true;
    const post = new PhaseRecorder('post', order);
    post.postProcess = true;
    const root = new Group();
    root.add(pre);
    root.add(focused);
    root.add(post);
    const loop = createEventLoop({ width: 30, height: 8 }, { caps: EXAMPLE_CAPS });
    loop.mount(root);
    loop.focusView(focused);

    loop.dispatch(key('x'));
    expect(order.splice(0)).toEqual(['key:pre', 'key:focused', 'key:post']);
    loop.dispatch({ type: 'paste', text: 'sample', truncated: false });
    expect(order.splice(0)).toEqual(['paste:pre', 'paste:focused', 'paste:post']);
    loop.emitCommand('inspect');
    expect(order.splice(0)).toEqual(['command:pre', 'command:focused', 'command:post']);
    loop.dispose();
  });

  test('stops later phases after a handler consumes an event', () => {
    const order: string[] = [];
    const pre = new PhaseRecorder('pre', order, new Set(['key']));
    pre.preProcess = true;
    const focused = new PhaseRecorder('focused', order);
    focused.focusable = true;
    const post = new PhaseRecorder('post', order);
    post.postProcess = true;
    const root = new Group();
    root.add(pre);
    root.add(focused);
    root.add(post);
    const loop = createEventLoop({ width: 30, height: 8 }, { caps: EXAMPLE_CAPS });
    loop.mount(root);
    loop.focusView(focused);

    loop.dispatch(key('x'));
    expect(order).toEqual(['key:pre']);
    loop.dispose();
  });

  test('hit-tests mouse input and bubbles from the target toward its ancestors', () => {
    const order: string[] = [];
    const leaf = new PhaseRecorder('target', order);
    const parent = new BubbleRecorder('parent', order);
    parent.add(leaf);
    const root = new BubbleRecorder('root', order);
    root.add(parent);
    const loop = createEventLoop({ width: 30, height: 10 }, { caps: EXAMPLE_CAPS });
    loop.mount(root);
    root.bounds = { x: 0, y: 0, width: 30, height: 10 };
    parent.bounds = { x: 2, y: 2, width: 15, height: 6 };
    leaf.bounds = { x: 1, y: 1, width: 8, height: 2 };

    loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 5, y: 5 });
    expect(order).toEqual(['mouse:target', 'parent', 'root']);
    loop.dispose();
  });

  test('converts bound keys to commands, swallows raw keys, and reserves unbound Tab for focus', () => {
    const first = new PhaseRecorder('first', []);
    first.focusable = true;
    const second = new PhaseRecorder('second', []);
    second.focusable = true;
    const root = new Group();
    root.add(first);
    root.add(second);
    const loop = createEventLoop(
      { width: 30, height: 8 },
      { caps: EXAMPLE_CAPS, keymap: createKeymap({ 'ctrl+s': 'save' }) },
    );
    loop.mount(root);
    loop.focusView(first);

    loop.dispatch(key('s', { ctrl: true }));
    expect(first.seen).toContainEqual({ type: 'command', command: 'save' });
    expect(first.seen.some((event) => event.type === 'key')).toBe(false);

    loop.dispatch(key('tab'));
    expect(loop.getFocused()).toBe(second);
    expect(first.seen.some((event) => event.type === 'key' && event.key === 'tab')).toBe(false);
    expect(second.seen.some((event) => event.type === 'key' && event.key === 'tab')).toBe(false);

    expect(() => createKeymap({ 'ctrl+': 'invalid' })).toThrow();
    expect(() => createKeymap({ 'hyper+s': 'invalid' })).toThrow();
    loop.dispose();
  });

  test('gives onCommand precedence, drops disabled commands, and confines commands to a modal', async () => {
    const outside = new PhaseRecorder('outside', []);
    outside.focusable = true;
    const modalLeaf = new PhaseRecorder('modal', []);
    modalLeaf.focusable = true;
    const modal = new Group();
    modal.add(modalLeaf);
    const root = new Group();
    root.add(outside);
    root.add(modal);
    const loop = createEventLoop({ width: 30, height: 8 }, { caps: EXAMPLE_CAPS });
    loop.mount(root);
    loop.focusView(outside);

    let handled = 0;
    const off = loop.onCommand('save', () => {
      handled += 1;
    });
    loop.emitCommand('save');
    expect(handled).toBe(1);
    expect(outside.seen).not.toContainEqual({ type: 'command', command: 'save' });

    loop.enableCommand('save', false);
    loop.emitCommand('save');
    expect(handled).toBe(1);
    expect(loop.isCommandEnabled('save')).toBe(false);
    expect(loop.isCommandEnabled('unregistered')).toBe(true);

    loop.enableCommand('save', true);
    const modalResult = loop.execView<string>(modal);
    loop.emitCommand('save');
    expect(handled).toBe(1);
    expect(modalLeaf.seen).toContainEqual({ type: 'command', command: 'save' });
    loop.endModal('closed');
    await expect(modalResult).resolves.toBe('closed');

    off();
    loop.dispose();
  });
});

describe('Events, commands & keymaps laboratory contract', () => {
  test('registers two unique app laboratories at their declared Guide source paths', () => {
    expect(new Set(labIds).size).toBe(2);
    expect(registryEntry(routingLabId)).toMatchObject({
      kind: 'app',
      sourcePath: 'examples/guides/event-routing.ts',
    });
    expect(registryEntry(precedenceLabId)).toMatchObject({
      kind: 'app',
      sourcePath: 'examples/guides/command-precedence.ts',
    });
  });

  test.each(labIds)('%s opens as a compact centered Classic template1 lab at 80x24', async (id) => {
    const definition = await loadDefinition(id);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(id, definition);
      const evidence = collectTemplate1Evidence(app, dialog);
      const desktop = app.desktop;
      if (desktop === undefined) throw new Error('template1 requires a desktop');

      expect(evidence.viewport).toEqual({ width: 80, height: 24 });
      expect(dialog.closable).toBe(false);
      expect(dialog.background).toBeUndefined();
      expect(dialog.centered).toBe(true);
      expect(dialog.bounds.x).toBeGreaterThan(0);
      expect(dialog.bounds.y).toBeGreaterThan(0);
      expect(dialog.bounds.x + dialog.bounds.width).toBeLessThan(desktop.bounds.width);
      expect(dialog.bounds.y + dialog.bounds.height).toBeLessThan(desktop.bounds.height);
      expect(evidence.dialogInterior.join('\n')).toMatch(/(?:Alt|Ctrl|Tab|Enter|mouse|click)/i);

      app.loop.dispose();
      expect(dialog.mounted).toBe(false);
      dispose();
    });
  });

  test.each(labIds)('%s stays padded and unclipped through resize, maximize, and restore', async (id) => {
    const definition = await loadDefinition(id);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(id, definition, {
        viewport: { width: 120, height: 40 },
      });
      const authored = { ...dialog.bounds };

      resizeDialog(app, dialog);
      expect(dialog.bounds.width).toBeGreaterThan(authored.width);
      expect(dialog.bounds.height).toBeGreaterThan(authored.height);
      const resized = { ...dialog.bounds };
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });

      dialog.zoom();
      app.loop.renderRoot.flush();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });

      dialog.zoom();
      app.loop.renderRoot.flush();
      app.loop.renderRoot.flush();
      expect(dialog.bounds).toEqual(resized);
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });

      app.loop.dispose();
      expect(dialog.mounted).toBe(false);
      dispose();
    });
  });

  test('the routing lab exposes keyboard, paste, command, and target-up mouse traces', async () => {
    const definition = await loadDefinition(routingLabId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(routingLabId, definition);
      const initial = frameText(app);
      expect(initial).toMatch(/Route trace/i);
      expect(initial).toMatch(/(?:pre|root).+focused.+post/i);

      app.loop.dispatch(key('x'));
      expect(frameText(app)).toMatch(/Key x:\s*pre > focused > post/i);

      app.loop.dispatch({ type: 'paste', text: 'sample', truncated: false });
      expect(frameText(app)).toMatch(/Paste sample:\s*pre > focused > post/i);

      app.loop.dispatch(key('c', { alt: true }));
      expect(frameText(app)).toMatch(/Command inspect:\s*pre > focused > post/i);

      const target = renderedTextOrigin(app, 'Mouse target');
      dispatchExampleAction(app, {
        kind: 'mouse',
        gesture: 'click',
        at: { x: target.x + 1, y: target.y },
      });
      expect(frameText(app)).toMatch(/Mouse:\s*target > parent/i);

      const buttons = viewsIn(dialog).filter((view): view is Button => view instanceof Button);
      expect(buttons.length).toBeGreaterThan(0);
      expect(buttons.every((button) => button.focusable)).toBe(true);
      app.loop.dispose();
      dispose();
    });
  });

  test('the precedence lab shows keymap winners, raw-key swallowing, and disabled commands', async () => {
    const definition = await loadDefinition(precedenceLabId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(precedenceLabId, definition);
      expect(frameText(app)).toMatch(/Ctrl\+S.+save/i);
      expect(frameText(app)).toMatch(/Save enabled:\s*yes/i);

      app.loop.dispatch(key('s', { ctrl: true }));
      expect(frameText(app)).toMatch(/Winner:\s*(?:app )?onCommand/i);
      expect(frameText(app)).toMatch(/Raw key deliveries:\s*0/i);

      app.loop.dispatch(key('c', { ctrl: true }));
      expect(frameText(app)).toMatch(/Ctrl\+C[\s\S]{0,100}(?:app binding|inspect)[\s\S]{0,100}(?:won|winner)/i);

      app.loop.dispatch(key('d', { alt: true }));
      expect(frameText(app)).toMatch(/Save enabled:\s*no/i);
      app.loop.dispatch(key('s', { ctrl: true }));
      expect(frameText(app)).toMatch(/save[\s\S]{0,100}(?:dropped|disabled)/i);

      app.loop.dispatch(key('d', { alt: true }));
      expect(frameText(app)).toMatch(/Save enabled:\s*yes/i);
      const buttons = viewsIn(dialog).filter((view): view is Button => view instanceof Button);
      expect(buttons.length).toBeGreaterThan(0);
      expect(buttons.every((button) => button.focusable)).toBe(true);
      app.loop.dispose();
      dispose();
    });
  });

  test('both labs keep keyboard instructions and ASCII status evidence visible', async () => {
    for (const id of labIds) {
      const definition = await loadDefinition(id);
      createRoot((dispose) => {
        const { app, dialog } = buildLabExample(id, definition);
        const text = frameText(app);
        expect(text).toMatch(/(?:Alt|Ctrl)\+[A-Z]/);
        expect(text).toMatch(/(?:Trace|Status|Winner|Enabled):/i);
        expect(text).toContain('>');
        expect(viewsIn(dialog).some((view) => view.focusable)).toBe(true);
        app.loop.dispose();
        expect(dialog.mounted).toBe(false);
        dispose();
      });
    }
  });
});
