/**
 * Immutable oracle for The application shell course and its two laboratories.
 *
 * Public controls prove the current shell composition, body selection, command registration, and
 * safe chrome-copy contracts. Course and lab assertions describe the final learner-visible result.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  Button,
  Commands,
  Desktop,
  Group,
  MenuBar,
  MenuPopup,
  StatusItemView,
  StatusLine,
  View,
  Window,
  createApplication,
  createRoot,
  item,
  menuBar,
  statusItem,
  statusLine,
  subMenu,
  withBase,
} from '@jsvision/ui';
import type { DispatchEvent } from '@jsvision/ui';
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

const guidePath = fileURLToPath(new URL('../guide/application-shell.md', import.meta.url));
const catalogPath = fileURLToPath(new URL('../guides.json', import.meta.url));
const source = existsSync(guidePath) ? readFileSync(guidePath, 'utf8') : '';
const catalog = parseGuideCatalog(readFileSync(catalogPath, 'utf8'));
const guide = catalog.entries.find((candidate) => candidate.id === 'application-shell');
const chromeLabId = 'guides/application-chrome';
const bodiesLabId = 'guides/application-bodies';
const labIds = [chromeLabId, bodiesLabId] as const;

interface ChromeTeachingPanel extends View {
  readonly lessonName: 'Application chrome';
  readonly menuActionRuns: number;
  readonly quitRequests: number;
}

interface BodiesTeachingPanel extends View {
  readonly lessonName: 'Application bodies';
  readonly bodyMode: 'Desktop' | 'Custom content';
  readonly quitRequests: number;
  readonly windowCommandRuns: number;
}

class CommandBody extends Group {
  readonly seen: string[] = [];

  constructor() {
    super();
    this.focusable = true;
  }

  override onEvent(event: DispatchEvent): void {
    if (event.event.type === 'command') {
      this.seen.push(event.event.command);
      event.handled = true;
    }
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

function panelIn<T extends View>(dialog: View, className: string): T {
  const panels = viewsIn(dialog).filter((view) => view.constructor.name === className);
  expect(panels).toHaveLength(1);
  return panels[0] as T;
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

function applicationViews(app: ReturnType<typeof buildLabExample>['app']): View[] {
  const desktop = app.desktop;
  if (desktop === undefined) throw new Error('Guide laboratories require a Desktop application');
  let root: View = desktop;
  while (root.parent !== null) root = root.parent;
  return viewsIn(root);
}

function exampleMenu(): MenuBar {
  return menuBar([
    subMenu('~F~ile', [item('E~x~it', Commands.quit, 'Alt+X')]),
    subMenu('~W~indow', [item('~T~ile', Commands.tile), item('~C~ascade', Commands.cascade)]),
  ]);
}

function exampleStatus(): StatusLine {
  return statusLine([
    statusItem('~F6~ Next', Commands.next, 'F6'),
    statusItem('Ready'),
    statusItem('~Alt-X~ Quit', Commands.quit, 'Alt+X'),
  ]);
}

describe('The application shell course contract', () => {
  test('should publish the completed catalog course with its exact prerequisite, outcomes, and labs', () => {
    expect(source).not.toBe('');
    expect(guide).toMatchObject({
      title: 'The application shell',
      profile: 'course',
      stage: 'complete',
      prerequisites: ['events-commands-and-keymaps'],
      requiredLiveExamples: 2,
      liveExampleException: null,
      examples: [...labIds],
    });
    expect(guide?.learningOutcomes).toEqual([
      'Construct and run a complete application with menu, status, content, and quit behavior.',
      'Choose a Desktop or Router body and manage window commands and lifecycle.',
    ]);
    expect(source).toContain('](/guide/events-commands-and-keymaps)');
  });

  test('should state the learner contract and progress through the complete course backbone', () => {
    const sections = [
      '## Who this course is for',
      '## Mental model',
      '## Your first complete application',
      '## Shell anatomy',
      '## Menu and status chrome',
      '## The Desktop body',
      '## Custom-content bodies',
      '## Window commands',
      '## Composition and integration',
      '## Advanced lifecycle behavior',
      '## Failure modes and diagnosis',
      '## Best practices',
      '## Practice and next steps',
    ];
    let previous = -1;
    for (const section of sections) {
      const index = source.indexOf(section);
      expect(index, `missing or misplaced ${section}`).toBeGreaterThan(previous);
      previous = index;
    }
    expect(source).toMatch(/^description:\s*.+application.+(?:menu|status|Desktop|lifecycle).+$/imu);
    expect(source).toMatch(
      /\bbuild\b[\s\S]{0,450}\bexplain\b[\s\S]{0,450}\bdiagnos(?:e|is)\b[\s\S]{0,450}\bverify\b/iu,
    );
    expect(source).toMatch(/(?:assume|already know|comfortable with)[\s\S]{0,450}(?:event|command|keymap)/iu);
    expect(source).toMatch(/(?:editor|dashboard|workspace|terminal application)[\s\S]{0,550}(?:menu|status|quit)/iu);
    expect(source).toContain(`<PlayExample id="${chromeLabId}"`);
    expect(source).toContain(`<PlayExample id="${bodiesLabId}"`);
  });

  test('should teach the mounted shell hierarchy, geometry, ownership, and first useful result', () => {
    expect(source).toMatch(
      /(?:menu bar|MenuBar)[\s\S]{0,250}(?:body|content)[\s\S]{0,250}(?:status line|StatusLine)[\s\S]{0,300}(?:overlay|popup)/iu,
    );
    expect(source).toMatch(/(?:menu|status)[\s\S]{0,350}(?:one|1)[ -](?:cell|row)/iu);
    expect(source).toMatch(/body[\s\S]{0,350}(?:fills|remaining|fr)/iu);
    expect(source).toMatch(/createApplication\([\s\S]{0,700}app\.desktop\.addWindow/iu);
    expect(source).toMatch(/Commands\.quit[\s\S]{0,500}app\.run\(\)/iu);
    expect(source).toMatch(/(?:mounted|owns)[\s\S]{0,500}(?:event loop|loop)[\s\S]{0,350}(?:view tree|shell)/iu);
  });

  test('should distinguish Desktop and custom-content bodies without duplicating routing lessons', () => {
    expect(source).toMatch(
      /(?:omit|without|no) `?content`?[\s\S]{0,450}(?:DesktopApplication|Desktop)[\s\S]{0,300}desktop/iu,
    );
    expect(source).toMatch(
      /(?:custom|pass) `?content`?[\s\S]{0,450}(?:RouterApplication|custom-content)[\s\S]{0,300}desktop[\s\S]{0,200}undefined/iu,
    );
    expect(source).toMatch(/(?:Desktop|window manager)[\s\S]{0,450}(?:overlap|window|z-order)/iu);
    expect(source).toMatch(/(?:Router|custom content)[\s\S]{0,450}(?:full-screen|single body|screen)/iu);
    expect(source).toMatch(
      /(?:Screens & routing|screens-and-routing)[\s\S]{0,400}(?:owns|course|history|typed route)/iu,
    );
    expect(source).not.toMatch(/## (?:Route parameters|Navigation history|Keep-alive screens)/iu);
  });

  test('should teach chrome composition and Desktop-only window command boundaries accurately', () => {
    expect(source).toMatch(/menuBase\(\)[\s\S]{0,350}(?:shallow|copy|plain data)/iu);
    expect(source).toMatch(/statusBase\(\)[\s\S]{0,400}(?:fresh|new)[\s\S]{0,250}(?:view|item)/iu);
    expect(source).toMatch(/withBase\([\s\S]{0,400}(?:base|screen|extra)/iu);
    for (const command of ['close', 'zoom', 'next', 'prev', 'cascade', 'tile']) {
      expect(source).toContain(`Commands.${command}`);
    }
    expect(source).toMatch(/(?:Desktop-only|Desktop body)[\s\S]{0,650}(?:close|zoom)[\s\S]{0,400}(?:cascade|tile)/iu);
    expect(source).toMatch(
      /(?:custom-content|Router)[\s\S]{0,550}(?:does not|no)[\s\S]{0,250}(?:register|window commands)/iu,
    );
  });

  test('should teach quit, run, restoration, browser safety, theming, and accessible chrome', () => {
    expect(source).toMatch(/Commands\.quit[\s\S]{0,400}(?:default|intent|terminat)/iu);
    expect(source).toMatch(/app\.run\(\)[\s\S]{0,400}(?:Promise<number>|exit code|resolves)/iu);
    expect(source).toMatch(
      /(?:finally|always)[\s\S]{0,450}(?:restore|raw mode|alternate screen)[\s\S]{0,350}(?:throw|signal|normal)/iu,
    );
    expect(source).toMatch(
      /(?:browser|embedded)[\s\S]{0,500}(?:quit request|requested)[\s\S]{0,300}(?:keep|remain)[\s\S]{0,180}(?:alive|open)/iu,
    );
    for (const role of [
      'desktop',
      'menuBar',
      'menuSelected',
      'statusBar',
      'statusSelected',
      'window',
      'windowInactive',
    ]) {
      expect(source).toContain(`\`${role}\``);
    }
    expect(source).toMatch(/(?:keyboard|hotkey|accelerator)[\s\S]{0,450}(?:focus|reachable|discoverable)/iu);
    expect(source).toMatch(/(?:ASCII-safe|monochrome)[\s\S]{0,450}(?:label|marker|non-colou?r|cue)/iu);
  });

  test('should keep snippets public and focused, then diagnose failures and link owning material', () => {
    const code = snippets();
    expect(code.length).toBeGreaterThanOrEqual(7);
    for (const snippet of code) {
      expect(snippet.split('\n').filter((line) => line.trim() !== '').length).toBeLessThanOrEqual(28);
      expect(snippet).not.toMatch(/(?:demoApp|Template1Dialog|defineExample|packages\/ui\/src|@jsvision\/ui\/src)/u);
      for (const imported of snippet.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu)) {
        expect(imported[1]).toBe('@jsvision/ui');
      }
    }
    for (const concept of ['createApplication', 'menuBar', 'statusLine', 'Commands.quit', 'app.run()', 'content:']) {
      expect(code.some((snippet) => snippet.includes(concept))).toBe(true);
    }
    expect(source).toMatch(/symptom[\s\S]{0,280}cause[\s\S]{0,280}(?:correction|fix)[\s\S]{0,280}evidence/iu);
    expect(source).toMatch(
      /(?:menu|status)[\s\S]{0,500}(?:missing|not visible|clipped)[\s\S]{0,350}(?:layout|createApplication)/iu,
    );
    expect(source).toMatch(
      /(?:Tile|Cascade|window command)[\s\S]{0,500}(?:disabled|unhandled)[\s\S]{0,350}(?:custom|Desktop)/iu,
    );
    expect(source).toMatch(
      /(?:run\(\)|terminal)[\s\S]{0,500}(?:not restored|raw mode|hang)[\s\S]{0,350}(?:quit|finally|await)/iu,
    );
    expect(source).toMatch(
      /## Practice and next steps[\s\S]{0,1500}(?:menu|status)[\s\S]{0,550}(?:Desktop|custom content)[\s\S]{0,550}(?:quit|exit code)/iu,
    );
    for (const link of [
      '/guide/events-commands-and-keymaps',
      '/components/application/application',
      '/components/application/menu-bar',
      '/components/application/status-line',
      '/components/application/desktop',
      '/components/application/window',
      '/components/application/router',
      '/api/ui/functions/createApplication',
      '/api/ui/variables/Commands',
    ]) {
      expect(source).toContain(link);
    }
  });
});

describe('public application-shell behavior taught by the course', () => {
  test('should choose a Desktop by default and expose no desktop for a custom body', () => {
    const desktopApp = createApplication({
      caps: EXAMPLE_CAPS,
      viewport: { width: 40, height: 12 },
    });
    const customBody = new Group();
    const customApp = createApplication({
      caps: EXAMPLE_CAPS,
      viewport: { width: 40, height: 12 },
      content: customBody,
    });
    expect(desktopApp.desktop).toBeInstanceOf(Desktop);
    expect(customApp.desktop).toBeUndefined();
    expect(customBody.parent).toBeInstanceOf(Group);
    expect(customBody.bounds).toEqual({ x: 0, y: 0, width: 40, height: 12 });
    desktopApp.loop.dispose();
    customApp.loop.dispose();
  });

  test('should wrap the body with one-row menu and status chrome in shell order', () => {
    const menu = exampleMenu();
    const status = exampleStatus();
    const body = new Group();
    const app = createApplication({
      caps: EXAMPLE_CAPS,
      viewport: { width: 40, height: 12 },
      menuBar: menu,
      statusLine: status,
      content: body,
    });
    app.loop.renderRoot.flush();
    const root = body.parent;
    expect(root).toBeInstanceOf(Group);
    expect((root as Group).children.slice(0, 3)).toEqual([menu, body, status]);
    expect(menu.bounds).toEqual({ x: 0, y: 0, width: 40, height: 1 });
    expect(body.bounds).toEqual({ x: 0, y: 1, width: 40, height: 10 });
    expect(status.bounds).toEqual({ x: 0, y: 11, width: 40, height: 1 });
    app.loop.dispose();
  });

  test('should return safe menu copies and fresh status views for base composition', () => {
    const line = exampleStatus();
    const app = createApplication({
      caps: EXAMPLE_CAPS,
      viewport: { width: 40, height: 12 },
      menuBar: exampleMenu(),
      statusLine: line,
    });
    const menuA = app.menuBase();
    const menuB = app.menuBase();
    expect(menuA).not.toBe(menuB);
    expect(menuA).toEqual(menuB);
    expect(menuA[0]).toBe(menuB[0]);
    menuA.pop();
    expect(app.menuBase()).toHaveLength(2);

    const statusA = app.statusBase();
    const statusB = app.statusBase();
    expect(line.children).toHaveLength(3);
    expect(
      line.children.filter((child) => child instanceof StatusItemView && child.command === undefined),
    ).toHaveLength(1);
    expect(statusA).toHaveLength(2);
    expect(statusA).not.toBe(statusB);
    expect(statusA[0]).toBeInstanceOf(StatusItemView);
    expect(statusA[0]).not.toBe(statusB[0]);
    expect(statusA.every((entry) => entry instanceof StatusItemView && entry.command !== undefined)).toBe(true);
    const composed = withBase(statusA, [statusItem('~H~elp', 'help')]);
    expect(composed).toHaveLength(3);
    expect(statusA).toHaveLength(2);
    app.loop.dispose();
  });

  test('should handle window commands in Desktop while leaving them to custom content', () => {
    const desktopApp = createApplication({
      caps: EXAMPLE_CAPS,
      viewport: { width: 40, height: 12 },
    });
    const first = new Window('First');
    first.setLayout({ rect: { x: 1, y: 1, width: 16, height: 6 } });
    const second = new Window('Second');
    second.setLayout({ rect: { x: 18, y: 1, width: 16, height: 6 } });
    desktopApp.desktop.addWindow(first);
    desktopApp.desktop.addWindow(second);
    const customBody = new CommandBody();
    const customApp = createApplication({
      caps: EXAMPLE_CAPS,
      viewport: { width: 40, height: 12 },
      content: customBody,
    });
    expect(Commands.quit).toBe('quit');
    expect(desktopApp.loop.isCommandEnabled(Commands.quit)).toBe(true);
    expect(customApp.loop.isCommandEnabled(Commands.quit)).toBe(true);
    desktopApp.loop.emitCommand(Commands.close);
    expect(desktopApp.desktop.children).toEqual([first]);
    const windowCommands = [
      Commands.close,
      Commands.zoom,
      Commands.next,
      Commands.prev,
      Commands.cascade,
      Commands.tile,
    ];
    customApp.loop.focusView(customBody);
    for (const command of windowCommands) {
      customApp.loop.emitCommand(command);
    }
    expect(customBody.seen).toEqual(windowCommands);
    desktopApp.loop.dispose();
    customApp.loop.dispose();
  });
});

describe('Application chrome and bodies laboratory contract', () => {
  test('should register two applications with objective-specific titles and blurbs', async () => {
    expect(registryEntry(chromeLabId)).toMatchObject({
      kind: 'app',
      sourcePath: 'examples/guides/application-chrome.ts',
    });
    expect(registryEntry(bodiesLabId)).toMatchObject({
      kind: 'app',
      sourcePath: 'examples/guides/application-bodies.ts',
    });
    const chrome = await loadDefinition(chromeLabId);
    const bodies = await loadDefinition(bodiesLabId);
    expect(chrome.title).toMatch(/Application Chrome (?:Laboratory|Workshop)/iu);
    expect(chrome.blurb).toMatch(/menu[\s\S]*status[\s\S]*(?:content|quit)/iu);
    expect(bodies.title).toMatch(/Application Bodies (?:Laboratory|Workshop)/iu);
    expect(bodies.blurb).toMatch(/Desktop[\s\S]*(?:Router|custom content)[\s\S]*(?:window command|lifecycle)/iu);
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
      expect(dialog.mounted).toBe(false);
      dispose();
    });
  });

  test.each(labIds)('should keep %s padded and unclipped through resize, maximize, and restore', async (id) => {
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
      dispose();
    });
  });

  test('should make menu, status, content, commands, and a non-terminating quit request observable', async () => {
    const definition = await loadDefinition(chromeLabId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(chromeLabId, definition);
      const panel = panelIn<ChromeTeachingPanel>(dialog, 'ApplicationChromePanel');
      const shellViews = applicationViews(app);
      const bars = shellViews.filter((view): view is MenuBar => view instanceof MenuBar);
      const lines = shellViews.filter((view): view is StatusLine => view instanceof StatusLine);
      expect(bars).toHaveLength(1);
      expect(lines).toHaveLength(1);
      const lessonMenu = bars[0]?.items.find((entry) => entry.kind === 'sub' && /Lesson/iu.test(entry.title));
      expect(lessonMenu?.kind).toBe('sub');
      if (lessonMenu?.kind !== 'sub') throw new Error('Application chrome lab requires a Lesson menu');
      const lessonItems = lessonMenu.items.filter((entry) => entry.kind === 'item');
      const lessonAction = lessonItems.find((entry) => !/quit/iu.test(entry.title));
      const quitAction = lessonItems.find((entry) => /quit/iu.test(entry.title));
      expect(lessonAction).toBeDefined();
      expect(quitAction).toBeDefined();
      if (lessonAction === undefined || quitAction === undefined) {
        throw new Error('Lesson menu requires lesson-action and quit-request items');
      }
      const statusCommands = lines[0]?.children
        .filter((entry): entry is StatusItemView => entry instanceof StatusItemView)
        .map((entry) => entry.command)
        .filter((command): command is string => command !== undefined);
      expect(statusCommands).toEqual(expect.arrayContaining([lessonAction.command, quitAction.command]));
      const statusQuitItem = lines[0]?.children.find(
        (entry): entry is StatusItemView => entry instanceof StatusItemView && entry.command === quitAction.command,
      );
      expect(statusQuitItem).toBeDefined();
      expect(panel.lessonName).toBe('Application chrome');
      expect(panel.menuActionRuns).toBe(0);
      expect(frameText(app)).toMatch(/Menu:\s*(?:File|ready|mounted)/iu);
      expect(frameText(app)).toMatch(/Body:\s*(?:content|workspace|ready)/iu);
      expect(frameText(app)).toMatch(/Status:\s*(?:ready|command|quit)/iu);
      app.loop.dispatch(key('m', { alt: true }));
      expect(panel.menuActionRuns).toBe(1);
      expect(frameText(app)).toMatch(/Menu action:\s*(?:opened|selected|command)/iu);
      expect(frameText(app)).toMatch(/(?:Action )?(?:route|source):\s*keymap/iu);

      const menuY = absoluteOrigin(bars[0]!).y;
      const renderedTitle = lessonMenu.title.replaceAll('~', '');
      const titleX = frameText(app).split('\n')[menuY]?.indexOf(renderedTitle) ?? -1;
      expect(titleX).toBeGreaterThanOrEqual(0);
      dispatchExampleAction(app, {
        kind: 'mouse',
        gesture: 'click',
        at: { x: titleX + 1, y: menuY },
      });
      const popup = applicationViews(app).find((view): view is MenuPopup => view instanceof MenuPopup);
      expect(popup).toBeDefined();
      if (popup === undefined) throw new Error('Pointer-opened Lesson menu requires a real MenuPopup');
      const popupOrigin = absoluteOrigin(popup);
      const lessonRow = lessonMenu.items.indexOf(lessonAction);
      dispatchExampleAction(app, {
        kind: 'mouse',
        gesture: 'click',
        at: { x: popupOrigin.x + 3, y: popupOrigin.y + lessonRow + 1 },
      });
      expect(panel.menuActionRuns).toBe(2);
      expect(frameText(app)).toMatch(/Menu action:\s*(?:opened|selected|command)/iu);
      expect(frameText(app)).toMatch(/(?:Action )?(?:route|source):\s*menu\/status/iu);

      app.loop.dispatch(key('q', { alt: true }));
      expect(panel.quitRequests).toBe(1);
      expect(frameText(app)).toMatch(/(?:Action )?(?:route|source):\s*keymap/iu);
      if (statusQuitItem === undefined) {
        throw new Error('Application chrome lab requires a matching status quit-request item');
      }
      const statusOrigin = absoluteOrigin(statusQuitItem);
      dispatchExampleAction(app, {
        kind: 'mouse',
        gesture: 'click',
        at: { x: statusOrigin.x + 1, y: statusOrigin.y },
      });
      expect(panel.quitRequests).toBe(2);
      expect(frameText(app)).toMatch(/(?:Action )?(?:route|source):\s*menu\/status/iu);
      expect(frameText(app)).toMatch(/Quit requested:\s*yes[\s\S]*(?:showcase|lesson)[\s\S]*(?:alive|open)/iu);
      expect(dialog.mounted).toBe(true);
      clickButton(app, dialog, 'Request quit');
      expect(panel.quitRequests).toBe(3);
      expect(frameText(app)).toMatch(/(?:Action )?(?:route|source):\s*button/iu);
      app.loop.dispose();
      dispose();
    });
  });

  test('should compare Desktop and custom-content command availability without becoming a routing course', async () => {
    const definition = await loadDefinition(bodiesLabId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(bodiesLabId, definition);
      const panel = panelIn<BodiesTeachingPanel>(dialog, 'ApplicationBodiesPanel');
      const previewDesktop = viewsIn(dialog).find((view): view is Desktop => view instanceof Desktop);
      expect(previewDesktop).toBeDefined();
      expect(panel.lessonName).toBe('Application bodies');
      expect(panel.bodyMode).toBe('Desktop');
      expect(frameText(app)).toMatch(/Desktop:\s*window manager/iu);
      expect(frameText(app)).toMatch(/Window commands:\s*enabled/iu);
      const initialWindows = previewDesktop?.children.length ?? 0;
      expect(initialWindows).toBeGreaterThan(0);
      app.loop.dispatch(key('w', { alt: true }));
      expect(panel.windowCommandRuns).toBe(1);
      expect(previewDesktop?.children).toHaveLength(initialWindows - 1);
      expect(frameText(app)).toMatch(/Desktop close:[\s\S]*(?:removed|closed)/iu);
      app.loop.dispatch(key('b', { alt: true }));
      expect(panel.bodyMode).toBe('Custom content');
      expect(frameText(app)).toMatch(/Custom content:\s*(?:single|full-screen) body/iu);
      expect(frameText(app)).toMatch(/Window commands:\s*(?:not registered|unavailable)/iu);
      expect(frameText(app)).toMatch(/Routing depth:\s*(?:next course|Screens & routing)/iu);
      app.loop.dispatch(key('w', { alt: true }));
      expect(panel.windowCommandRuns).toBe(2);
      expect(frameText(app)).toMatch(/Custom body received:[\s\S]*(?:close|window command)/iu);
      clickButton(app, dialog, 'Switch body');
      expect(panel.bodyMode).toBe('Desktop');
      expect(frameText(app)).toMatch(/Action source:\s*mouse/iu);
      app.loop.dispatch(key('q', { alt: true }));
      expect(panel.quitRequests).toBe(1);
      expect(dialog.mounted).toBe(true);
      app.loop.dispose();
      dispose();
    });
  });

  test('should expose keyboard and mouse paths, non-color feedback, bounded state, and cleanup', async () => {
    for (const id of labIds) {
      const definition = await loadDefinition(id);
      let mounted: View[] = [];
      createRoot((dispose) => {
        const { app, dialog } = buildLabExample(id, definition);
        mounted = viewsIn(dialog);
        expect(frameText(app)).toMatch(/Alt\+[A-Z]/u);
        expect(frameText(app)).toMatch(/(?:Status|Action|Mode|Body|Quit requested):/iu);
        expect(frameText(app)).toMatch(/(?:enabled|unavailable|yes|no|ready|alive)/iu);
        const buttons = viewsIn(dialog).filter((view): view is Button => view instanceof Button);
        expect(buttons.length).toBeGreaterThan(0);
        expect(buttons.every((button) => button.focusable)).toBe(true);
        app.loop.dispose();
        dispose();
      });
      expect(mounted.every((view) => !view.mounted && view.scope === null)).toBe(true);
    }
  });
});
