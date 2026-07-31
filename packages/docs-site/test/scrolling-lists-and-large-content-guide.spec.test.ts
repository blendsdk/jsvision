/**
 * Immutable oracle for the Scrolling, lists & large content course and its two laboratories.
 *
 * The public controls prove the current viewport, focus, selection, expansion, and bounded-render
 * contracts. Course and laboratory assertions describe the final learner-visible result.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  Button,
  Group,
  ListBox,
  ListView,
  ScrollBar,
  Scroller,
  Surface,
  SurfaceView,
  Tree,
  View,
  createEventLoop,
  createRoot,
  signal,
} from '@jsvision/ui';
import type { DrawContext, TreeNode } from '@jsvision/ui';
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

const guidePath = fileURLToPath(new URL('../guide/scrolling-lists-and-large-content.md', import.meta.url));
const catalogPath = fileURLToPath(new URL('../guides.json', import.meta.url));
const source = existsSync(guidePath) ? readFileSync(guidePath, 'utf8') : '';
const catalog = parseGuideCatalog(readFileSync(catalogPath, 'utf8'));
const guide = catalog.entries.find((candidate) => candidate.id === 'scrolling-lists-and-large-content');
const viewportLabId = 'guides/viewport-strategies';
const collectionsLabId = 'guides/virtual-collections';
const labIds = [viewportLabId, collectionsLabId] as const;

interface ViewportTeachingPanel extends View {
  /** Identifies the panel without coupling the oracle to its module path. */
  readonly lessonName: 'Viewport strategies';
  /** Focusable owner that demonstrates keyboard scrolling and owned bars. */
  readonly scroller: Scroller;
  /** Passive viewport that demonstrates externally controlled panning. */
  readonly surfaceView: SurfaceView;
}

interface CollectionsTeachingPanel extends View {
  /** Identifies the panel without coupling the oracle to its module path. */
  readonly lessonName: 'Virtual collections';
  /** Generic resident collection with virtualized visible-row drawing. */
  readonly listView: ListView<unknown>;
  /** String-specialized collection used to distinguish convenience APIs. */
  readonly listBox: ListBox;
  /** Hierarchical collection whose expansion changes the visible row set. */
  readonly tree: Tree<unknown>;
  /** Optional instrumentation that makes bounded visible work observable. */
  readonly visibleRowWork?: number;
}

/** Draws deterministic letter rows so scrolling assertions can observe movement. */
class LetterRows extends View {
  /**
   * Creates a bounded row source.
   *
   * @param rows - Number of rows exposed by the teaching fixture.
   */
  constructor(readonly rows: number) {
    super();
  }

  /** Paints each fixture row with a repeating ASCII marker. */
  override draw(ctx: DrawContext): void {
    const style = ctx.color('listNormal');
    for (let y = 0; y < this.rows; y += 1) {
      ctx.text(0, y, String.fromCharCode(65 + (y % 26)), style);
    }
  }
}

/** Extracts TypeScript teaching snippets without treating live examples as snippets. */
function snippets(): string[] {
  return [...source.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/g)].map((match) => match[1] ?? '');
}

/** Finds one learner-facing registry entry by its stable example identifier. */
function registryEntry(id: string) {
  return EXAMPLES.find((candidate) => candidate.id === id);
}

/** Loads a registered example after first proving that its registry entry exists. */
async function loadDefinition(id: string): Promise<ExampleDefinition> {
  const entry = registryEntry(id);
  if (entry === undefined) throw new Error(`Missing example registry entry: ${id}`);
  return (await entry.load()).default;
}

/** Locates one named teaching panel inside the shared application shell. */
function panelIn<T extends View>(dialog: View, className: string): T {
  const panels = viewsIn(dialog).filter((view) => view.constructor.name === className);
  expect(panels).toHaveLength(1);
  return panels[0] as T;
}

/** Exercises the dialog's real mouse-driven resize path. */
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

/** Activates a visible button through the same mouse path available to learners. */
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

/** Mounts a public view in a real event loop for source-level contract controls. */
function hosted(view: View, width: number, height: number) {
  view.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width, height } });
  const root = new Group();
  root.add(view);
  const loop = createEventLoop({ width, height }, { caps: EXAMPLE_CAPS });
  loop.mount(root);
  return loop;
}

describe('Scrolling, lists & large content course contract', () => {
  test('should publish the completed catalog course with exact prerequisites, outcomes, and labs', () => {
    expect(source).not.toBe('');
    expect(guide).toMatchObject({
      title: 'Scrolling, lists & large content',
      profile: 'course',
      stage: 'complete',
      prerequisites: ['layout', 'views-and-focus'],
      requiredLiveExamples: 2,
      liveExampleException: null,
      examples: [...labIds],
    });
    expect(guide?.learningOutcomes).toEqual([
      'Choose between Scroller, ListView, ListBox, Tree, SurfaceView, and windowed data sources.',
      'Coordinate viewport offsets, focus, selection, scroll bars, and bounded rendering.',
    ]);
    expect(source).toContain('](/guide/layout)');
    expect(source).toContain('](/guide/views-and-focus)');
  });

  test('should state the learner contract and progress through the complete course backbone', () => {
    const sections = [
      '## Who this course is for',
      '## Mental model',
      '## Your first scrollable result',
      '## Choosing a viewport strategy',
      '## Viewport offsets and scroll bars',
      '## Lists, focus, and selection',
      '## Trees and visible rows',
      '## Composition and integration',
      '## Advanced behavior',
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
    expect(source).toMatch(/^description:\s*.+(?:scroll|list).+(?:viewport|large).+$/imu);
    expect(source).toMatch(
      /\bbuild\b[\s\S]{0,450}\bexplain\b[\s\S]{0,450}\bdiagnos(?:e|is)\b[\s\S]{0,450}\bverify\b/iu,
    );
    expect(source).toMatch(/(?:assume|already know|comfortable with)[\s\S]{0,450}(?:layout|focus)/iu);
    expect(source).toMatch(/(?:large log|catalog|file browser|collection)[\s\S]{0,500}(?:viewport|bounded)/iu);
    expect(source).toContain(`<PlayExample id="${viewportLabId}"`);
    expect(source).toContain(`<PlayExample id="${collectionsLabId}"`);
  });

  test('should teach the extent-to-visible-window model and an explicit strategy decision table', () => {
    expect(source).toMatch(/extent[\s\S]{0,280}viewport[\s\S]{0,280}offset[\s\S]{0,280}visible window/iu);
    expect(source).toMatch(/offset[\s\S]{0,350}(?:clamp|0.+extent.+viewport)/iu);
    for (const name of ['Scroller', 'SurfaceView', 'ListView', 'ListBox', 'Tree']) {
      expect(source).toMatch(new RegExp(`\\|[^\\n]*${name}[^\\n]*\\|`, 'u'));
    }
    expect(source).toMatch(/Scroller[\s\S]{0,450}(?:owns|creates)[\s\S]{0,250}scroll ?bar/iu);
    expect(source).toMatch(/SurfaceView[\s\S]{0,450}(?:passive|external)[\s\S]{0,250}scroll ?bar/iu);
    expect(source).toMatch(
      /Scroller\.delta[\s\S]{0,650}(?:visual|composed)[\s\S]{0,300}(?:does not rewrite|still report)[\s\S]{0,350}(?:navigation|Home|End)/iu,
    );
    expect(source).toMatch(
      /maxOffset[\s\S]{0,500}pageStep[\s\S]{0,500}setRange[\s\S]{0,450}(?:does not rewrite|re-limit)/iu,
    );
    expect(source).toMatch(/ListBox[\s\S]{0,350}(?:string|ListView<string>)/iu);
    expect(source).toMatch(/Tree[\s\S]{0,400}(?:flatten|visible row)[\s\S]{0,300}(?:identity|node)/iu);
  });

  test('should coordinate layout, reactivity, focus, selection, and bounded dynamic rendering', () => {
    expect(source).toMatch(/focus(?:ed)?[\s\S]{0,300}(?:not|distinct|different)[\s\S]{0,250}select/iu);
    expect(source).toMatch(/(?:Group|ListView|Tree)[\s\S]{0,350}rows[\s\S]{0,250}focus target/iu);
    expect(source).toMatch(/(?:resize|viewport change)[\s\S]{0,450}(?:re-limit|clamp|offset)/iu);
    expect(source).toMatch(/(?:items|roots|extent)[\s\S]{0,500}(?:signal|reactive)[\s\S]{0,300}(?:shrink|change)/iu);
    expect(source).toMatch(/(?:visible rows|visible window)[\s\S]{0,450}(?:bounded|not.+whole|viewport)/iu);
    expect(source).toMatch(/numCols[\s\S]{0,350}column-major/iu);
    expect(source).toMatch(/sorted:\s*true[\s\S]{0,350}getText[\s\S]{0,350}resident\s+array/iu);
    expect(source).toMatch(/Type-ahead[\s\S]{0,250}linear[\s\S]{0,250}getText/iu);
    expect(source).toMatch(/Tree[\s\S]{0,350}flatten[\s\S]{0,350}expanded[\s\S]{0,350}(?:before|visible)/iu);
    expect(source).toMatch(
      /(?:remote|unbounded|async)[\s\S]{0,500}(?:Data Grid|Code Editor)[\s\S]{0,350}(?:source|specialist)/iu,
    );
  });

  test('should map exact theme roles and teach accessible, safe degraded behavior', () => {
    for (const role of [
      'scrollBarControls',
      'scrollBarPage',
      'listNormal',
      'listFocused',
      'listSelected',
      'listDivider',
      'outlineNormal',
      'outlineFocused',
      'outlineSelected',
      'outlineNotExpanded',
      'windowInactive',
    ]) {
      expect(source).toContain(`\`${role}\``);
    }
    expect(source).toMatch(/(?:ASCII-safe|monochrome)[\s\S]{0,450}(?:label|marker|non-colou?r|cue)/iu);
    expect(source).toMatch(
      /markerStyle:\s*'tv'[\s\S]{0,400}(?:default|bare)[\s\S]{0,400}'triangle'[\s\S]{0,300}falls back to brackets/iu,
    );
    expect(source).toMatch(/(?:untrusted|user-supplied)[\s\S]{0,400}(?:sanitize|escape)/iu);
    expect(source).toMatch(
      /(?:stale|out-of-order)[\s\S]{0,450}(?:async|window request)[\s\S]{0,350}(?:discard|cancel|generation)/iu,
    );
    expect(source).toMatch(/<empty>[\s\S]{0,350}(?:shrink|clamp|focus)/iu);
  });

  test('should keep snippets concise, public, concept-focused, and lifecycle-safe', () => {
    const code = snippets();
    expect(code.length).toBeGreaterThanOrEqual(8);
    for (const snippet of code) {
      expect(snippet.split('\n').filter((line) => line.trim() !== '').length).toBeLessThanOrEqual(26);
      expect(snippet).not.toMatch(/(?:demoApp|Template1Dialog|defineExample|packages\/ui\/src|@jsvision\/ui\/src)/u);
      expect(snippet).not.toMatch(/\.delta\s*=/u);
      for (const imported of snippet.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu)) {
        expect(imported[1]).toBe('@jsvision/ui');
      }
    }
    for (const concept of ['Scroller', 'SurfaceView', 'ListView', 'ListBox', 'Tree']) {
      expect(code.some((snippet) => snippet.includes(concept))).toBe(true);
    }
    expect(code.some((snippet) => /createRoot\([\s\S]*(?:dispose|cleanup)/u.test(snippet))).toBe(true);
  });

  test('should diagnose failures and finish with decisions, practice, and owning links', () => {
    expect(source).toMatch(/symptom[\s\S]{0,280}cause[\s\S]{0,280}(?:correction|fix)[\s\S]{0,280}evidence/iu);
    expect(source).toMatch(/(?:clipp|content disappears)[\s\S]{0,500}(?:extent|layout|viewport)/iu);
    expect(source).toMatch(/(?:focus lost|wrong row|selection)[\s\S]{0,500}(?:rows|focused|selected)/iu);
    expect(source).toMatch(/(?:over-scroll|blank band)[\s\S]{0,450}(?:clamp|offset|range)/iu);
    expect(source).toMatch(
      /## Practice and next steps[\s\S]{0,1500}(?:resize|extent)[\s\S]{0,600}(?:focus|selection)[\s\S]{0,600}(?:large|bounded|virtual)/iu,
    );
    for (const link of [
      '/guide/layout',
      '/guide/views-and-focus',
      '/guide/reactive-state',
      '/components/containers/scroller',
      '/components/containers/list-view',
      '/components/containers/list-box',
      '/components/containers/tree',
      '/components/surface/surface-view',
      '/components/data-grid/',
      '/components/code-editor/',
      '/api/ui/classes/Scroller',
      '/api/ui/classes/SurfaceView',
      '/api/ui/classes/ListView',
      '/api/ui/classes/Tree',
      '/api/ui/classes/ScrollBar',
    ]) {
      expect(source).toContain(link);
    }
  });
});

describe('public viewport and collection behavior taught by the course', () => {
  test('should let Scroller visually clamp a dynamic extent before navigation re-limits delta', () => {
    createRoot((dispose) => {
      let extent = { width: 12, height: 20 };
      const scroller = new Scroller({
        content: new LetterRows(30),
        extent: () => extent,
      });
      const loop = hosted(scroller, 12, 6);
      loop.focusView(scroller);
      expect(scroller.focusable).toBe(true);
      expect(scroller.children.filter((child) => child instanceof ScrollBar)).toHaveLength(1);
      loop.dispatch(key('down'));
      expect(scroller.delta.y).toBe(1);
      loop.dispatch(key('pagedown'));
      expect(scroller.delta.y).toBe(6);
      loop.dispatch(key('end'));
      expect(scroller.delta.y).toBe(14);
      extent = { width: 12, height: 8 };
      scroller.invalidate();
      loop.renderRoot.flush();
      expect(scroller.delta.y).toBe(14);
      expect(scroller.children[0]?.bounds.y).toBe(-2);
      loop.dispatch(key('end'));
      expect(scroller.delta.y).toBe(2);
      loop.dispatch(key('home'));
      expect(scroller.delta.y).toBe(0);
      loop.dispose();
      dispose();
    });
  });

  test('should keep SurfaceView passive, clamp its methods, repaint mutations, and expose direct writes', () => {
    createRoot((dispose) => {
      const surface = Surface.from(['ABCDE', 'FGHIJ', 'KLMNO', 'PQRST']);
      const delta = signal({ x: 0, y: 0 });
      const view = new SurfaceView({ surface, delta });
      const loop = hosted(view, 3, 2);
      expect(view.focusable).toBe(false);
      view.scrollTo({ x: 99, y: 99 });
      expect(delta()).toEqual({ x: 2, y: 2 });
      view.panBy(-1, -1);
      expect(delta()).toEqual({ x: 1, y: 1 });
      surface.set(1, 1, 'Z', { fg: 'default', bg: 'default' });
      loop.renderRoot.flush();
      expect(loop.renderRoot.buffer().get(0, 0)?.char).toBe('Z');
      delta.set({ x: 99, y: 99 });
      loop.renderRoot.flush();
      expect(delta()).toEqual({ x: 99, y: 99 });
      loop.dispose();
      dispose();
    });
  });

  test('should virtualize ListView while keeping focus, selection, shrink, empty, and ListBox distinct', () => {
    createRoot((dispose) => {
      let calls = 0;
      const items = signal(Array.from({ length: 1000 }, (_, index) => `item-${index}`));
      const focused = signal(0);
      const selected = signal(-1);
      const list = new ListView({
        items,
        focused,
        selected,
        getText: (item) => {
          calls += 1;
          return item;
        },
      });
      const loop = hosted(list, 20, 5);
      loop.focusView(list.rows);
      expect(list.focusable).toBe(false);
      expect(list.rows.focusable).toBe(true);
      expect(calls).toBeLessThan(100);
      loop.dispatch(key('down'));
      expect(focused()).toBe(1);
      expect(selected()).toBe(-1);
      loop.dispatch(key('enter'));
      expect(selected()).toBe(1);
      items.set(['only']);
      loop.renderRoot.flush();
      expect(focused()).toBe(0);
      items.set([]);
      loop.renderRoot.flush();
      let emptyFrame = '';
      for (let y = 0; y < 5; y += 1) {
        for (let x = 0; x < 20; x += 1) {
          emptyFrame += loop.renderRoot.buffer().get(x, y)?.char ?? ' ';
        }
        emptyFrame += '\n';
      }
      expect(emptyFrame).toContain('<empty>');
      const listBox = new ListBox({ items: signal(['one', 'two']) });
      expect(listBox).toBeInstanceOf(ListView);
      loop.dispose();
      dispose();
    });
  });

  test('should virtualize Tree by visible rows and keep identity, focus, expansion, and selection separate', () => {
    createRoot((dispose) => {
      let calls = 0;
      const children = Array.from({ length: 100 }, (_, index): TreeNode<string> => ({
        value: `child-${index}`,
        children: [],
      }));
      const rootNode: TreeNode<string> = { value: 'root', children };
      const roots = signal([rootNode]);
      const focused = signal(0);
      const selected = signal(-1);
      const tree = new Tree({
        roots,
        focused,
        selected,
        getText: (value) => {
          calls += 1;
          return value;
        },
      });
      const other = new Tree({ roots, getText: (value) => value });
      tree.expand(rootNode);
      expect(tree.isExpanded(rootNode)).toBe(true);
      expect(other.isExpanded(rootNode)).toBe(false);
      const loop = hosted(tree, 24, 5);
      loop.focusView(tree.rows);
      expect(tree.focusable).toBe(false);
      expect(tree.rows.focusable).toBe(true);
      expect(calls).toBeLessThan(40);
      loop.dispatch(key('down'));
      expect(focused()).toBe(1);
      expect(selected()).toBe(-1);
      loop.dispatch(key('enter'));
      expect(selected()).toBe(1);
      loop.dispose();
      dispose();
    });
  });

  test('should keep ScrollBar passive with vertical defaults, axis paging, and three-line wheel steps', () => {
    createRoot((dispose) => {
      const value = signal(0);
      const bar = new ScrollBar({ value, min: 0, max: 10 });
      const loop = hosted(bar, 1, 8);
      expect(bar.focusable).toBe(false);
      expect(bar.pageStep()).toBe(7);
      expect(bar.arrowStep()).toBe(1);
      expect(loop.renderRoot.buffer().get(0, 0)?.char).toBe('▲');
      expect(loop.renderRoot.buffer().get(0, 7)?.char).toBe('▼');
      loop.dispatch({
        type: 'wheel',
        dir: 'down',
        x: 1,
        y: 1,
        ctrl: false,
        alt: false,
        shift: false,
      });
      expect(value()).toBe(3);
      loop.dispose();
      dispose();
    });
  });
});

describe('Scrolling and virtual-collections laboratory contract', () => {
  test('should register two applications with objective-specific titles and blurbs', async () => {
    expect(registryEntry(viewportLabId)).toMatchObject({
      kind: 'app',
      sourcePath: 'examples/guides/viewport-strategies.ts',
    });
    expect(registryEntry(collectionsLabId)).toMatchObject({
      kind: 'app',
      sourcePath: 'examples/guides/virtual-collections.ts',
    });
    const viewport = await loadDefinition(viewportLabId);
    const collections = await loadDefinition(collectionsLabId);
    expect(viewport.title).toMatch(/Viewport Strategies (?:Laboratory|Workshop)/iu);
    expect(viewport.blurb).toMatch(/Scroller[\s\S]*(?:SurfaceView|offset)[\s\S]*(?:clamp|bar)/iu);
    expect(collections.title).toMatch(/Virtual Collections (?:Laboratory|Workshop)/iu);
    expect(collections.blurb).toMatch(/(?:ListView|ListBox)[\s\S]*Tree[\s\S]*(?:focus|selection|bounded)/iu);
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

  test('should compare owned Scroller navigation with passive SurfaceView panning', async () => {
    const definition = await loadDefinition(viewportLabId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(viewportLabId, definition);
      const panel = panelIn<ViewportTeachingPanel>(dialog, 'ViewportStrategyPanel');
      expect(panel.lessonName).toBe('Viewport strategies');
      expect(panel.scroller).toBeInstanceOf(Scroller);
      expect(panel.surfaceView).toBeInstanceOf(SurfaceView);
      expect(panel.scroller.focusable).toBe(true);
      expect(panel.surfaceView.focusable).toBe(false);
      expect(frameText(app)).toMatch(/Extent:\s*\d+x\d+[\s\S]*(?:bounded|clamped)/iu);
      expect(frameText(app)).toMatch(/Scroller[\s\S]*(?:owns|vertical bar)/iu);
      expect(frameText(app)).toMatch(/SurfaceView[\s\S]*(?:passive|external)/iu);
      app.loop.focusView(panel.scroller);
      app.loop.dispatch(key('pagedown'));
      expect(panel.scroller.delta.y).toBeGreaterThan(0);
      expect(frameText(app)).toMatch(/Scroller offset:\s*\d+,\d+[\s\S]*clamped/iu);
      app.loop.dispatch(key('p', { alt: true }));
      expect(frameText(app)).toMatch(/Surface offset:\s*\d+,\d+[\s\S]*clamped/iu);
      clickButton(app, dialog, 'Pan surface');
      expect(frameText(app)).toMatch(/Action source:\s*mouse/iu);
      app.loop.dispose();
      dispose();
    });
  });

  test('should make bounded list and tree focus, selection, shrink, and empty states observable', async () => {
    const definition = await loadDefinition(collectionsLabId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(collectionsLabId, definition);
      const panel = panelIn<CollectionsTeachingPanel>(dialog, 'VirtualCollectionsPanel');
      expect(panel.lessonName).toBe('Virtual collections');
      expect(panel.listView).toBeInstanceOf(ListView);
      expect(panel.listView).not.toBeInstanceOf(ListBox);
      expect(panel.listBox).toBeInstanceOf(ListBox);
      expect(panel.tree).toBeInstanceOf(Tree);
      expect(panel.visibleRowWork ?? 0).toBeLessThan(100);
      app.loop.focusView(panel.listView.rows);
      app.loop.dispatch(key('down'));
      expect(panel.listView.focused()).toBe(1);
      expect(panel.listView.selected()).toBe(-1);
      app.loop.dispatch(key('enter'));
      expect(panel.listView.selected()).toBe(1);
      app.loop.dispatch(key('t', { alt: true }));
      expect(frameText(app)).toMatch(/Tree expanded:\s*yes/iu);
      app.loop.dispatch(key('s', { alt: true }));
      expect(frameText(app)).toMatch(/Data:\s*shrunk/iu);
      app.loop.dispatch(key('e', { alt: true }));
      expect(frameText(app)).toMatch(/<empty>|Data:\s*empty/iu);
      expect(frameText(app)).toMatch(/Rendered rows:\s*\d+\s*<=\s*viewport/iu);
      expect(frameText(app)).toMatch(/Remote\/unbounded:[\s\S]*(?:Data Grid|Code Editor)/iu);
      clickButton(app, dialog, 'Shrink data');
      expect(frameText(app)).toMatch(/Action source:\s*mouse/iu);
      app.loop.dispose();
      dispose();
    });
  });

  test('should expose keyboard and mouse paths, non-color status, bounded fixtures, and cleanup', async () => {
    for (const id of labIds) {
      const definition = await loadDefinition(id);
      let mounted: View[] = [];
      createRoot((dispose) => {
        const { app, dialog } = buildLabExample(id, definition);
        mounted = viewsIn(dialog);
        expect(frameText(app)).toMatch(/Alt\+[A-Z]/u);
        expect(frameText(app)).toMatch(/(?:Status|Action|Focus|Selected|Offset|Rendered):/iu);
        expect(frameText(app)).toMatch(/(?:clamped|bounded|yes|no|empty|viewport)/iu);
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
