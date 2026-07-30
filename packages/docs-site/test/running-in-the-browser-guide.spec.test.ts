/**
 * Immutable oracle for the Running in the browser course and its two laboratories.
 *
 * Repository-internal controls prove browser mounting, xterm-style input/output, resize, keyboard reclaim,
 * clipboard authorization, virtual files, and cleanup without touching visitor capabilities.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Button, Text, View, Window, createApplication, createRoot } from '@jsvision/ui';
import {
  UNRECLAIMABLE_CHORDS,
  attachKeyReclaim,
  buildBrowserCaps,
  createBrowserFileSystem,
  mountApp,
  setClipboard,
} from '@jsvision/web';
import type { BrowserKeyEvent, ClipboardBridge, TerminalLike } from '@jsvision/web';
import { describe, expect, test, vi } from 'vitest';
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

const guidePath = fileURLToPath(new URL('../guide/running-in-the-browser.md', import.meta.url));
const catalogPath = fileURLToPath(new URL('../guides.json', import.meta.url));
const source = existsSync(guidePath) ? readFileSync(guidePath, 'utf8') : '';
const catalog = parseGuideCatalog(readFileSync(catalogPath, 'utf8'));
const guide = catalog.entries.find((candidate) => candidate.id === 'running-in-the-browser');
const lifecycleLabId = 'guides/browser-host-lifecycle';
const boundariesLabId = 'guides/browser-capability-boundaries';
const labIds = [lifecycleLabId, boundariesLabId] as const;

interface BrowserHostLifecyclePanel extends View {
  readonly lessonName: 'Browser host lifecycle';
  readonly mounts: number;
  readonly inputEvents: number;
  readonly resizeEvents: number;
  readonly cleanupCount: number;
  readonly focusCalls: number;
  readonly hostDisposals: number;
  readonly postDisposeInputInert: boolean;
  readonly postDisposeResizeInert: boolean;
}

interface BrowserCapabilityPanel extends View {
  readonly lessonName: 'Browser capability boundaries';
  readonly reclaimedKeys: number;
  readonly clipboardWrites: number;
  readonly deniedClipboardWrites: number;
  readonly virtualFileOperations: number;
  readonly cleanupCount: number;
}

interface TerminalHarness {
  readonly term: TerminalLike;
  readonly writes: string[];
  readonly focusCount: () => number;
  readonly disposeCount: () => number;
  sendData(data: string): void;
  sendResize(cols: number, rows: number): void;
  sendBrowserKey(event: BrowserKeyEvent): boolean | undefined;
}

function createTerminalHarness(): TerminalHarness {
  const writes: string[] = [];
  let dataHandler: ((data: string) => void) | undefined;
  let resizeHandler: ((size: { cols: number; rows: number }) => void) | undefined;
  let browserKeyHandler: ((event: BrowserKeyEvent) => boolean) | undefined;
  let focuses = 0;
  let disposals = 0;
  return {
    term: {
      write: (data) => writes.push(data),
      onData: (handler) => {
        dataHandler = handler;
        return { dispose: () => (dataHandler = undefined) };
      },
      onResize: (handler) => {
        resizeHandler = handler;
        return { dispose: () => (resizeHandler = undefined) };
      },
      attachCustomKeyEventHandler: (handler) => {
        browserKeyHandler = handler;
      },
      focus: () => {
        focuses += 1;
      },
      dispose: () => {
        disposals += 1;
      },
    },
    writes,
    focusCount: () => focuses,
    disposeCount: () => disposals,
    sendData: (data) => dataHandler?.(data),
    sendResize: (cols, rows) => resizeHandler?.({ cols, rows }),
    sendBrowserKey: (event) => browserKeyHandler?.(event),
  };
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

function isLifecyclePanel(view: View): view is BrowserHostLifecyclePanel {
  return (
    view.constructor.name === 'BrowserHostLifecyclePanel' &&
    'lessonName' in view &&
    view.lessonName === 'Browser host lifecycle' &&
    'mounts' in view &&
    typeof view.mounts === 'number' &&
    'inputEvents' in view &&
    typeof view.inputEvents === 'number' &&
    'resizeEvents' in view &&
    typeof view.resizeEvents === 'number' &&
    'cleanupCount' in view &&
    typeof view.cleanupCount === 'number'
  );
}

function isCapabilityPanel(view: View): view is BrowserCapabilityPanel {
  return (
    view.constructor.name === 'BrowserCapabilityPanel' &&
    'lessonName' in view &&
    view.lessonName === 'Browser capability boundaries' &&
    'reclaimedKeys' in view &&
    typeof view.reclaimedKeys === 'number' &&
    'clipboardWrites' in view &&
    typeof view.clipboardWrites === 'number' &&
    'deniedClipboardWrites' in view &&
    typeof view.deniedClipboardWrites === 'number' &&
    'virtualFileOperations' in view &&
    typeof view.virtualFileOperations === 'number' &&
    'cleanupCount' in view &&
    typeof view.cleanupCount === 'number'
  );
}

function lifecyclePanelIn(dialog: View): BrowserHostLifecyclePanel {
  const panel = viewsIn(dialog).find(isLifecyclePanel);
  if (panel === undefined) throw new Error('Browser lifecycle laboratory is missing its teaching panel');
  return panel;
}

function capabilityPanelIn(dialog: View): BrowserCapabilityPanel {
  const panel = viewsIn(dialog).find(isCapabilityPanel);
  if (panel === undefined) throw new Error('Browser capability laboratory is missing its teaching panel');
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

describe('Running in the browser course contract', () => {
  test('should publish the completed catalog course with exact prerequisites, outcomes, and labs', () => {
    expect(source).not.toBe('');
    expect(guide).toMatchObject({
      title: 'Running in the browser',
      page: '/guide/running-in-the-browser',
      profile: 'course',
      stage: 'complete',
      prerequisites: ['application-shell', 'files-and-filesystem'],
      learningOutcomes: [
        'Mount an unchanged application through the browser runtime and xterm.js host.',
        'Handle browser capabilities, clipboard authorization, keyboard reclaim, resize, and virtual files.',
      ],
      requiredLiveExamples: 2,
      liveExampleException: null,
      examples: [...labIds],
    });
    expect(source).toContain('](/guide/application-shell)');
    expect(source).toContain('](/guide/files-and-filesystem)');
  });

  test('should state the learner contract and follow the complete question-led course backbone', () => {
    const sections = [
      '## Who is this course for?',
      '## What is the browser-host mental model?',
      '## How do I mount my first application?',
      '## Laboratory: browser host lifecycle',
      '## How do xterm.js input and output connect to JSVision?',
      '## How do resize and focus stay synchronized?',
      '## How do I reclaim browser keyboard shortcuts?',
      '## How does browser clipboard authorization work?',
      '## How do virtual files keep workflows host-neutral?',
      '## Laboratory: browser capability boundaries',
      '## How does the browser runtime integrate with an unchanged app?',
      '## What belongs in advanced browser hosting?',
      '## How do I diagnose browser-host failures?',
      '## What are the best practices?',
      '## What should I practice next?',
    ];
    let previous = -1;
    for (const section of sections) {
      const index = source.indexOf(section);
      expect(index, `missing or misplaced ${section}`).toBeGreaterThan(previous);
      previous = index;
    }
    expect(source).toMatch(/^description:\s*.+(?:browser|xterm).+(?:lifecycle|clipboard|virtual files)/imu);
    expect(source).toMatch(/\bbuild\b[\s\S]*\bexplain\b[\s\S]*\bdiagnos(?:e|is)\b[\s\S]*\bverify\b/iu);
    expect(source).toContain(`<PlayExample id="${lifecycleLabId}"`);
    expect(source).toContain(`<PlayExample id="${boundariesLabId}"`);
  });

  test('should teach the exact browser mount, input, resize, focus, and cleanup contract', () => {
    expect(source).toMatch(/createApplication\([\s\S]{0,500}mountApp\(/iu);
    expect(source).toMatch(/Terminal[\s\S]{0,350}(?:open|element)[\s\S]{0,350}buildBrowserCaps/iu);
    expect(source).toMatch(/(?:same|unchanged) application[\s\S]{0,350}(?:native|browser)/iu);
    expect(source).toMatch(/xterm\.js[\s\S]{0,450}(?:ANSI|bytes)[\s\S]{0,350}(?:serialize|decode)/iu);
    expect(source).toMatch(/(?:first frame|first paint)[\s\S]{0,300}(?:input|onData)/iu);
    expect(source).toMatch(/onResize[\s\S]{0,300}loop\.resize|resize[\s\S]{0,300}(?:cols|rows)/iu);
    expect(source).toMatch(/(?:focus\(\)|terminal focus)[\s\S]{0,300}(?:optional|when available)/iu);
    expect(source).toMatch(/mounted\.dispose\(\)[\s\S]{0,450}(?:loop|view tree)[\s\S]{0,350}(?:resize|terminal)/iu);
    expect(source).toMatch(/(?:onCleanup|cleanup)[\s\S]{0,300}(?:timer|subscription|listener)/iu);
  });

  test('should teach focused keyboard reclaim and honest unreclaimable boundaries', () => {
    expect(source).toMatch(/attachKeyReclaim\(/u);
    expect(source).toMatch(/capture-phase[\s\S]{0,350}keydown[\s\S]{0,350}preventDefault/iu);
    expect(source).toMatch(/(?:only|while)[\s\S]{0,200}(?:terminal|xterm)[\s\S]{0,200}focus/iu);
    expect(source).toMatch(/UNRECLAIMABLE_CHORDS[\s\S]{0,450}(?:remap|alternate|cannot)/iu);
    expect(source).toMatch(/(?:dispose|detach|unsubscribe)[\s\S]{0,300}(?:reclaim|listener)/iu);
    expect(source).toMatch(
      /(?:do not|never)[\s\S]{0,350}(?:reclaim|preventDefault)[\s\S]{0,250}(?:unfocused|whole page)/iu,
    );
  });

  test('should teach outbound-only clipboard authorization and failure handling', () => {
    expect(source).toMatch(/setClipboard\([\s\S]{0,350}(?:user gesture|authorization|permission)/iu);
    expect(source).toMatch(/writeText[\s\S]{0,350}(?:never|does not)[\s\S]{0,250}readText/iu);
    expect(source).toMatch(/(?:absent|unavailable)[\s\S]{0,250}(?:graceful|no-op)/iu);
    expect(source).toMatch(/(?:reject|denied|NotAllowedError)[\s\S]{0,350}(?:catch|feedback|caller)/iu);
    expect(source).toMatch(/(?:Ctrl\\+Shift\\+C|Ctrl\+Shift\+C)[\s\S]{0,400}(?:selection|copy|route)/iu);
    expect(source).toMatch(/(?:secret|sensitive)[\s\S]{0,350}(?:never|redact|do not log)/iu);
  });

  test('should teach bounded virtual files without implying visitor filesystem access', () => {
    expect(source).toMatch(/createBrowserFileSystem\([\s\S]{0,400}(?:tree|home)/iu);
    expect(source).toMatch(/(?:in-memory|virtual)[\s\S]{0,250}POSIX/iu);
    expect(source).toMatch(/(?:same|unchanged)[\s\S]{0,300}(?:FileSystem|file workflow|FileList)/iu);
    expect(source).toMatch(/(?:no|never)[\s\S]{0,300}(?:visitor|real)[\s\S]{0,250}(?:disk|files)/iu);
    expect(source).toMatch(/(?:no|never)[\s\S]{0,250}(?:network|backend)/iu);
    expect(source).toMatch(/(?:bounded|deterministic)[\s\S]{0,350}(?:fixture|tree|files)/iu);
  });

  test('should keep snippets bounded, label private imports, and close with owning links', () => {
    const code = snippets();
    expect(code.length).toBeGreaterThanOrEqual(10);
    for (const snippet of code) {
      expect(snippet.split('\n').filter((line) => line.trim() !== '').length).toBeLessThanOrEqual(28);
      expect(snippet).not.toMatch(/(?:demoApp|Template1Dialog|defineExample|packages\/(?:web|ui)\/src)/u);
      for (const imported of snippet.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu)) {
        expect(['@jsvision/ui', '@jsvision/web', '@xterm/xterm', '@jsvision/files']).toContain(imported[1]);
      }
    }
    const joined = code.join('\n');
    for (const api of [
      'mountApp',
      'buildBrowserCaps',
      'attachKeyReclaim',
      'UNRECLAIMABLE_CHORDS',
      'setClipboard',
      'createBrowserFileSystem',
    ]) {
      expect(joined).toMatch(new RegExp(`\\b${api}\\b`, 'u'));
    }
    expect(source).toMatch(
      /@jsvision\/web[\s\S]{0,350}private[\s\S]{0,350}(?:not published|unavailable)[\s\S]{0,350}(?:unsupported|not a supported)[\s\S]{0,350}consumer/iu,
    );
    expect(source).toMatch(
      /(?:repository-internal|in-repository)[\s\S]{0,350}architecture evidence[\s\S]{0,350}(?:not|never)[\s\S]{0,250}consumer/iu,
    );
    expect(source).toMatch(/symptom[\s\S]{0,300}cause[\s\S]{0,300}(?:correction|fix)[\s\S]{0,300}evidence/iu);
    expect(source).toMatch(/(?:exercise|experiment)[\s\S]{0,900}(?:resize|reclaim|clipboard|virtual)/iu);
    expect(source).toContain('](/components/application/application)');
    expect(source).toContain('](/guide/install-and-packages#browser-boundary)');
    expect(source).toContain('](/api/files/interfaces/FileSystem)');
  });
});

describe('repository-internal browser-runtime controls taught by the course', () => {
  test('should mount, paint, decode input, resize, focus, and dispose through injected seams', () => {
    const harness = createTerminalHarness();
    const caps = buildBrowserCaps();
    let cleanups = 0;
    const app = createApplication({ caps, viewport: { width: 40, height: 12 } });
    const window = new Window('Browser');
    window.setLayout({ rect: { x: 1, y: 1, width: 20, height: 6 } });
    const content = new Text('Mounted');
    content.onMount(() => content.onCleanup(() => (cleanups += 1)));
    window.add(content);
    app.desktop.addWindow(window);
    const dispatch = vi.spyOn(app.loop, 'dispatch');

    const mounted = mountApp({ element: { tagName: 'DIV' }, app, caps, term: harness.term });
    expect(harness.writes.join('')).toContain('Mounted');
    expect(harness.focusCount()).toBe(1);
    harness.sendData('\x1b[A');
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'key', key: 'up' }));
    harness.sendResize(52, 15);
    expect(app.loop.renderRoot.buffer().width).toBe(52);
    expect(app.loop.renderRoot.buffer().height).toBe(15);

    mounted.dispose();
    expect(cleanups).toBe(1);
    expect(harness.disposeCount()).toBe(1);
    harness.sendResize(70, 20);
    expect(app.loop.renderRoot.buffer().width).toBe(52);
  });

  test('should route browser copy to one authorized outbound write and propagate denial', async () => {
    const caps = buildBrowserCaps();
    const allowed: ClipboardBridge = { writeText: vi.fn(() => Promise.resolve()) };
    await setClipboard('bounded text', caps, allowed);
    expect(allowed.writeText).toHaveBeenCalledOnce();
    expect(allowed.writeText).toHaveBeenCalledWith('bounded text');

    const denied: ClipboardBridge = { writeText: () => Promise.reject(new Error('permission denied')) };
    await expect(setClipboard('not written', caps, denied)).rejects.toThrow('permission denied');
    const absent = await setClipboard('no bridge', caps, undefined);
    expect(absent).toBeUndefined();
  });

  test('should consume the browser copy gesture through the mounted app without reading clipboard', async () => {
    const harness = createTerminalHarness();
    const caps = buildBrowserCaps();
    const clipboard = {
      writeText: vi.fn(() => Promise.resolve()),
      readText: vi.fn(() => Promise.resolve('visitor clipboard')),
    };
    const app = createApplication({ caps, viewport: { width: 20, height: 6 } });
    const mounted = mountApp({
      element: { tagName: 'DIV' },
      app,
      caps,
      term: harness.term,
      clipboard,
    });
    const accepted = harness.sendBrowserKey({
      type: 'keydown',
      key: 'C',
      code: 'KeyC',
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
      metaKey: false,
    });
    expect(accepted).toBe(false);
    expect(clipboard.readText).not.toHaveBeenCalled();
    mounted.dispose();
  });

  test('should reclaim only while focused and detach the capture listener', () => {
    type ReclaimEvent = {
      key: string;
      ctrlKey: boolean;
      altKey: boolean;
      shiftKey: boolean;
      metaKey: boolean;
      preventDefault(): void;
    };
    let handler: ((event: ReclaimEvent) => void) | undefined;
    const target = {
      addEventListener: (_type: string, next: (event: ReclaimEvent) => void) => {
        handler = next;
      },
      removeEventListener: () => {
        handler = undefined;
      },
    };
    const harness = createTerminalHarness();
    let focused = true;
    const detach = attachKeyReclaim(harness.term, { target, isFocused: () => focused });
    const first = {
      key: 'F1',
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      preventDefault: vi.fn(),
    };
    handler?.(first);
    expect(first.preventDefault).toHaveBeenCalledOnce();
    focused = false;
    const second = { ...first, preventDefault: vi.fn() };
    handler?.(second);
    expect(second.preventDefault).not.toHaveBeenCalled();
    expect(UNRECLAIMABLE_CHORDS.length).toBeGreaterThan(0);
    detach();
    expect(handler).toBeUndefined();
  });

  test('should keep virtual file operations deterministic, mutable, and isolated from the host', () => {
    const fs = createBrowserFileSystem({
      tree: { '/home/demo': { 'readme.txt': 'hello', src: { 'app.ts': 'export {}' } } },
      home: '/home/demo',
    });
    expect(fs.readDir('/home/demo').map((entry) => entry.name)).toEqual(['readme.txt', 'src']);
    expect(fs.readFile('/home/demo/readme.txt')).toBe('hello');
    fs.writeFile('/home/demo/new.txt', 'bounded');
    expect(fs.readFile('/home/demo/new.txt')).toBe('bounded');
    fs.rename('/home/demo/new.txt', '/home/demo/renamed.txt');
    fs.unlink('/home/demo/renamed.txt');
    expect(() => fs.readFile('/home/demo/renamed.txt')).toThrow();
    expect(fs.resolve('/home/demo', '../project')).toBe('/home/project');
    expect(fs.sep).toBe('/');
  });
});

describe('Running in the browser laboratory contract', () => {
  test('should register two applications with objective-specific titles and blurbs', async () => {
    expect(registryEntry(lifecycleLabId)).toMatchObject({
      kind: 'app',
      sourcePath: 'examples/guides/browser-host-lifecycle.ts',
    });
    expect(registryEntry(boundariesLabId)).toMatchObject({
      kind: 'app',
      sourcePath: 'examples/guides/browser-capability-boundaries.ts',
    });
    const lifecycle = await loadDefinition(lifecycleLabId);
    const boundaries = await loadDefinition(boundariesLabId);
    expect(lifecycle.title).toMatch(/Browser Host Lifecycle (?:Laboratory|Workshop)/iu);
    expect(lifecycle.blurb).toMatch(/mount[\s\S]*(?:input|paint)[\s\S]*resize[\s\S]*(?:dispose|cleanup)/iu);
    expect(boundaries.title).toMatch(/Browser Capability Boundaries (?:Laboratory|Workshop)/iu);
    expect(boundaries.blurb).toMatch(
      /reclaim[\s\S]*clipboard[\s\S]*(?:virtual files|filesystem)[\s\S]*(?:denial|authorization)/iu,
    );
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

  test.each(labIds)('should remain padded at constrained size and through resize, maximize, restore', async (id) => {
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
  });

  test('should expose authentic mount, input, resize, first-paint, and cleanup evidence', async () => {
    const definition = await loadDefinition(lifecycleLabId);
    let panel: BrowserHostLifecyclePanel | undefined;
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(lifecycleLabId, definition);
      panel = lifecyclePanelIn(dialog);
      expect(frameText(app)).toMatch(/Mounted:\s*no[\s\S]*First paint:\s*pending/iu);
      app.loop.dispatch(key('m', { alt: true }));
      expect(panel.mounts).toBe(1);
      expect(frameText(app)).toMatch(/Mounted:\s*yes[\s\S]*First paint:\s*pass/iu);
      app.loop.dispatch(key('i', { alt: true }));
      expect(panel.inputEvents).toBe(1);
      expect(frameText(app)).toMatch(/Decoded input:\s*(?:up|pass)/iu);
      app.loop.dispatch(key('s', { alt: true }));
      expect(panel.resizeEvents).toBe(1);
      expect(frameText(app)).toMatch(/Viewport:\s*52x15/iu);
      clickButton(app, dialog, 'Dispose host');
      expect(panel.focusCalls).toBe(1);
      expect(panel.hostDisposals).toBe(1);
      expect(panel.postDisposeInputInert).toBe(true);
      expect(panel.postDisposeResizeInert).toBe(true);
      expect(frameText(app)).toMatch(
        /Host:\s*disposed[\s\S]*post-dispose inert[\s\S]*resize inert[\s\S]*Action source:\s*mouse/iu,
      );
      app.loop.dispose();
      dispose();
    });
    expect(panel?.cleanupCount).toBe(1);
  });

  test('should exercise focused reclaim, authorized and denied copy, and virtual files without visitor access', async () => {
    const definition = await loadDefinition(boundariesLabId);
    let disposeRoot: () => void = () => undefined;
    const { app, dialog } = createRoot((dispose) => {
      disposeRoot = dispose;
      return buildLabExample(boundariesLabId, definition);
    });
    const panel = capabilityPanelIn(dialog);
    expect(frameText(app)).toMatch(/Fixture:\s*(?:bounded|in-memory)[\s\S]*Visitor access:\s*none/iu);
    app.loop.dispatch(key('k', { alt: true }));
    expect(panel.reclaimedKeys).toBe(1);
    expect(frameText(app)).toMatch(/Reclaim:\s*(?:focused only|pass)/iu);
    app.loop.dispatch(key('c', { alt: true }));
    await Promise.resolve();
    app.loop.renderRoot.flush();
    expect(panel.clipboardWrites).toBe(1);
    expect(frameText(app)).toMatch(/Clipboard:\s*(?:authorized|written)/iu);
    app.loop.dispatch(key('d', { alt: true }));
    await Promise.resolve();
    app.loop.renderRoot.flush();
    expect(panel.deniedClipboardWrites).toBe(1);
    expect(frameText(app)).toMatch(/Clipboard:\s*denied[\s\S]*(?:caught|feedback)/iu);
    app.loop.dispatch(key('f', { alt: true }));
    expect(panel.virtualFileOperations).toBe(1);
    expect(frameText(app)).toMatch(/Virtual file:\s*(?:read|written|pass)[\s\S]*Network:\s*none/iu);
    clickButton(app, dialog, 'Virtual file');
    expect(frameText(app)).toMatch(/Action source:\s*mouse/iu);
    app.loop.dispose();
    disposeRoot();
    expect(panel.cleanupCount).toBe(1);
  });

  test('should expose keyboard-complete non-colour status and release every mounted view', async () => {
    for (const id of labIds) {
      const definition = await loadDefinition(id);
      let mounted: View[] = [];
      createRoot((dispose) => {
        const { app, dialog } = buildLabExample(id, definition);
        mounted = viewsIn(dialog);
        expect(frameText(app)).toMatch(/Alt\+[A-Z]/u);
        expect(frameText(app)).toMatch(/(?:Mounted|Host|Viewport|Reclaim|Clipboard|Virtual file|Action):/iu);
        expect(frameText(app)).toMatch(/(?:ASCII|monochrome|text status|non-colou?r)/iu);
        expect(frameText(app)).toMatch(/(?:deterministic|in-memory|No network|bounded fixture)/iu);
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
