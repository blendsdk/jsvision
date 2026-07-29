/**
 * Immutable specification coverage for the Views & focus course and its two laboratories.
 *
 * The oracle is derived from the catalog outcomes and the public retained-tree, focus traversal,
 * and modal contracts. It intentionally precedes the course implementation.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Button, createRoot, Dialog, Group, Text, at, createEventLoop, type View } from '@jsvision/ui';
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

const guidePath = fileURLToPath(new URL('../guide/views-and-focus.md', import.meta.url));
const catalogPath = fileURLToPath(new URL('../guides.json', import.meta.url));
const source = readFileSync(guidePath, 'utf8');
const catalogSource = readFileSync(catalogPath, 'utf8');
const catalog = parseGuideCatalog(catalogSource);
const guide = catalog.entries.find((candidate) => candidate.id === 'views-and-focus');

const traversalLabId = 'guides/views-focus-traversal';
const modalityLabId = 'guides/views-focus-modality';
const labIds = [traversalLabId, modalityLabId] as const;

function snippets(markdown: string): string[] {
  return [...markdown.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/g)].map((match) => match[1] ?? '');
}

function registryEntry(id: string) {
  return EXAMPLES.find((candidate) => candidate.id === id);
}

async function loadDefinition(id: string): Promise<ExampleDefinition> {
  const entry = registryEntry(id);
  if (entry === undefined) {
    throw new Error(`Missing example registry entry: ${id}`);
  }

  const module = await entry.load();
  return module.default;
}

function isDescendantOf(view: View | null, ancestor: View): boolean {
  for (let current = view; current !== null; current = current.parent) {
    if (current === ancestor) return true;
  }
  return false;
}

function focusStatus(text: string): string {
  const line = text.split('\n').find((candidate) => candidate.includes('Focused:'));
  if (line === undefined) return '';
  return line.slice(line.indexOf('Focused:')).trim();
}

function renderLoopText(loop: ReturnType<typeof createEventLoop>): string {
  loop.renderRoot.flush();
  return loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''))
    .join('\n');
}

function expectCourseText(pattern: RegExp, purpose: string): void {
  expect(source, purpose).toMatch(pattern);
}

describe('Views & focus guide course contract', () => {
  test('keeps its confirmed course profile, prerequisites, outcomes, and two-lab target', () => {
    expect(guide).toBeDefined();
    expect(guide?.profile).toBe('course');
    expect(['upgrade', 'complete']).toContain(guide?.stage);
    expect(guide?.prerequisites).toEqual(['layout', 'reactive-state']);
    expect(guide?.learningOutcomes).toEqual([
      'Explain retained view trees, mounting, invalidation, and ownership.',
      'Design predictable tab order, focus entry, restoration, and modal focus behavior.',
    ]);
    expect(guide?.requiredLiveExamples).toBe(2);
    expect(guide?.liveExampleException).toBeNull();
    expect(guide?.examples).toEqual([...labIds]);
  });

  test('states the audience, assumed knowledge, motivating problem, and observable capabilities', () => {
    expectCourseText(/^description:\s*.+(?:view|focus).+$/m, 'search-friendly frontmatter');
    expectCourseText(/^# Views (?:and|&) focus$/m, 'course title');
    expectCourseText(/^## (?:Who this course is for|Course introduction)$/m, 'course introduction');
    expectCourseText(/(?:prerequisite|before you begin)[\s\S]{0,500}\/guide\/layout/i, 'Layout prerequisite');
    expectCourseText(/\/guide\/reactive-state/i, 'Reactive state prerequisite');
    expectCourseText(
      /(?:assume|already know|comfortable with)[\s\S]{0,400}(?:layout|signal|reactiv)/i,
      'assumed knowledge',
    );
    expectCourseText(
      /(?:real-world|form|workspace|dialog|application)[\s\S]{0,500}(?:focus|keyboard)/i,
      'motivating problem',
    );
    expectCourseText(
      /\bbuild\b[\s\S]{0,350}\bexplain\b[\s\S]{0,350}\bdiagnos/i,
      'build, explain, and diagnose capabilities',
    );
    expectCourseText(/\bverif(?:y|ication)\b/i, 'verification capability');
  });

  test('uses the full course backbone in dependency order', () => {
    const headings = [
      /^## Mental model$/m,
      /^## (?:Your )?first (?:useful )?(?:focusable )?(?:view tree|result)$/m,
      /^## Mounting, ownership, and invalidation$/m,
      /^## (?:Traverse|Traversal) in document order$/m,
      /^## (?:Enter and restore|Focus entry and restoration)$/m,
      /^## Focus eligibility$/m,
      /^## Modal focus$/m,
      /^## Composition and integration$/m,
      /^## Advanced behavior$/m,
      /^## Failure modes and diagnosis$/m,
      /^## Best practices$/m,
      /^## Practice and next steps$/m,
    ];

    let previous = -1;
    for (const heading of headings) {
      const index = source.search(heading);
      expect(index, `missing or misplaced ${heading}`).toBeGreaterThan(previous);
      previous = index;
    }
  });

  test('teaches retained ownership, mounting, cleanup, and explicit invalidation accurately', () => {
    expectCourseText(/\bretained\b[\s\S]{0,300}\bView\b[\s\S]{0,300}(?:identity|instance)/i, 'retained identity');
    expectCourseText(/parent[\s-]child[\s\S]{0,400}(?:tree|ownership)/i, 'tree ownership');
    expectCourseText(
      /mount[\s\S]{0,500}(?:scope|owner)[\s\S]{0,500}(?:unmount|dispose|cleanup)/i,
      'mount-owned reactive lifetime',
    );
    expectCourseText(/invalidate\(\)[\s\S]{0,400}(?:paint|render|repaint)/i, 'paint invalidation');
    expectCourseText(/invalidateLayout\(\)[\s\S]{0,400}(?:layout|measure|reflow)/i, 'layout invalidation');
    expectCourseText(/(?:visible|hidden)[\s\S]{0,500}invalidateLayout\(\)/i, 'visibility reflow obligation');
    expectCourseText(/onCleanup|cleanup/i, 'cleanup obligation');
  });

  test('teaches exact document-order traversal, group entry, restoration, and eligibility rules', () => {
    expectCourseText(/document order|tree order/i, 'document-order traversal');
    expectCourseText(/Tab[\s\S]{0,500}(?:forward|next)[\s\S]{0,500}(?:wrap|scope)/i, 'forward Tab and wrap');
    expectCourseText(/Shift\+Tab[\s\S]{0,500}(?:inverse|reverse|previous)/i, 'reverse traversal');
    expectCourseText(/focusView\([\s\S]{0,350}(?:exact|leaf|view)/i, 'exact focusView semantics');
    expectCourseText(/focusInto\([\s\S]{0,500}(?:last|restore|first focusable)/i, 'focusInto restoration and fallback');
    expectCourseText(/non-Tab|click|programmatic[\s\S]{0,500}(?:remember|restore)/i, 'non-Tab restoration');
    expectCourseText(
      /hidden[\s\S]{0,400}disabled[\s\S]{0,500}(?:ineligible|skip|cannot receive focus)/i,
      'hidden and disabled eligibility',
    );
    expectCourseText(
      /ancestor[\s\S]{0,400}(?:hidden|disabled)[\s\S]{0,400}(?:ineligible|skip)/i,
      'ancestor eligibility',
    );
  });

  test('teaches modal containment, inert outside input, restoration, and nested modal order', () => {
    expectCourseText(/execView\(/, 'modal acquisition API');
    expectCourseText(/endModal\(/, 'modal completion API');
    expectCourseText(/(?:confine|contain|scope)[\s\S]{0,500}(?:modal|subtree)/i, 'modal traversal containment');
    expectCourseText(/outside[\s\S]{0,350}(?:inert|ignored|blocked)/i, 'outside input behavior');
    expectCourseText(/restore[\s\S]{0,500}(?:previous|saved|prior)[\s\S]{0,300}focus/i, 'modal focus restoration');
    expectCourseText(/nested[\s\S]{0,500}(?:LIFO|last[- ]in|inner)/i, 'nested modal completion order');
  });

  test('uses focused public-API snippets rather than copied applications or internal imports', () => {
    const code = snippets(source);

    expect(code.length).toBeGreaterThanOrEqual(5);
    const combined = code.join('\n');
    const importSources = [...combined.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
    expect(importSources.length).toBeGreaterThan(0);
    expect(importSources.every((path) => path === '@jsvision/ui')).toBe(true);
    expect(combined).not.toMatch(/@jsvision\/ui\/src|packages\/ui\/src|\.\.\/src\//);
    expect(code.some((snippet) => /\b(?:row|col)\(/.test(snippet))).toBe(true);
    expect(code.some((snippet) => /\.focusView\(/.test(snippet))).toBe(true);
    expect(code.some((snippet) => /\.focusInto\(/.test(snippet))).toBe(true);
    expect(code.some((snippet) => /\.execView\(/.test(snippet))).toBe(true);
    expect(code.some((snippet) => /onCleanup|\.dispose\(/.test(snippet))).toBe(true);
  });

  test('includes both course laboratories beside explicit objectives', () => {
    for (const id of labIds) {
      expect(source).toContain(`<PlayExample id="${id}"`);
    }

    expectCourseText(/views-focus-traversal[\s\S]{0,500}(?:Tab|tree order|eligibility)/i, 'traversal lab objective');
    expectCourseText(/views-focus-modality[\s\S]{0,500}(?:modal|contain|restore)/i, 'modality lab objective');
  });

  test('maps real theme roles to visible and non-color focus cues', () => {
    expectCourseText(/\bbuttonFocused\b/, 'focused button role');
    expectCourseText(/\blabel\b[\s\S]{0,300}\blabelSelected\b[\s\S]{0,300}\blabelShortcut\b/, 'label roles');
    expectCourseText(/(?:not rely|not depend|beyond)[\s\S]{0,300}colou?r|non-colou?r/i, 'non-color requirement');
    expectCourseText(/(?:caret|frame|border|Focused:|status text)/i, 'non-color cue');
  });

  test('has actionable diagnosis, production guidance, practice, and ownership-aware links', () => {
    expectCourseText(
      /symptom[\s\S]{0,250}cause[\s\S]{0,250}(?:correction|fix)[\s\S]{0,250}evidence/i,
      'diagnosis table',
    );
    expectCourseText(/(?:stale|disposed|unmounted|cleanup)/i, 'lifecycle failure');
    expectCourseText(/(?:clipp|small viewport|reduced geometry)/i, 'geometry failure');
    expectCourseText(/(?:hidden|disabled)[\s\S]{0,500}(?:focus|eligib)/i, 'eligibility failure');
    expectCourseText(/(?:modal)[\s\S]{0,500}(?:restore|contain)/i, 'modal failure');
    expectCourseText(/(?:exercise|experiment)[\s\S]{0,600}Shift\+Tab/i, 'reverse traversal practice');
    expectCourseText(/(?:exercise|experiment)[\s\S]{0,900}(?:hidden|disabled)/i, 'eligibility practice');
    expectCourseText(/(?:exercise|experiment)[\s\S]{0,900}(?:modal|restore)/i, 'modality practice');

    for (const link of [
      '/components/controls/label',
      '/components/containers/dialog',
      '/guide/events-commands-and-keymaps',
      '/guide/dialogs-and-modality',
      '/api/ui/classes/View',
      '/api/ui/classes/Group',
      '/api/ui/interfaces/EventLoop',
    ]) {
      expect(source).toContain(link);
    }
  });
});

describe('public retained-tree and focus behavior taught by the course', () => {
  test('mounts children under the retained tree and disposes their owned scope on removal', () => {
    const root = new Group();
    const child = at(new Text('Owned child'), 0, 0, 20, 1);
    root.add(child);
    const loop = createEventLoop({ width: 40, height: 8 }, { caps: EXAMPLE_CAPS });

    expect(child.mounted).toBe(false);
    expect(child.parent).toBe(root);

    loop.mount(root);
    expect(child.mounted).toBe(true);
    expect(child.scope).not.toBeNull();
    expect(renderLoopText(loop)).toContain('Owned child');

    root.remove(child);
    expect(child.mounted).toBe(false);
    expect(child.scope).toBeNull();
    expect(child.parent).toBeNull();
  });

  test('traverses in tree order, reverses exactly, restores group entry, and skips ineligible views', () => {
    const firstGroup = new Group();
    const secondGroup = new Group();
    const a = new Button('A');
    const b = new Button('B');
    const c = new Button('C');
    const d = new Button('D');
    firstGroup.add(a);
    firstGroup.add(b);
    secondGroup.add(c);
    secondGroup.add(d);
    const root = new Group();
    root.add(firstGroup);
    root.add(secondGroup);

    const loop = createEventLoop({ width: 40, height: 8 }, { caps: EXAMPLE_CAPS });
    loop.mount(root);
    loop.focusView(a);

    loop.dispatch(key('tab'));
    expect(loop.getFocused()).toBe(b);
    loop.dispatch(key('tab'));
    expect(loop.getFocused()).toBe(c);
    loop.dispatch(key('tab', { shift: true }));
    expect(loop.getFocused()).toBe(b);

    loop.focusView(c);
    loop.focusInto(firstGroup);
    expect(loop.getFocused()).toBe(b);

    b.state.visible = false;
    b.invalidateLayout();
    loop.focusView(a);
    loop.focusNext();
    expect(loop.getFocused()).toBe(c);

    c.state.disabled = true;
    c.invalidate();
    loop.focusView(a);
    loop.focusNext();
    expect(loop.getFocused()).toBe(d);
  });

  test('contains traversal inside a modal and restores the saved eligible focus on completion', async () => {
    const root = new Group();
    const outside = new Button('Outside');
    const modal = new Group();
    const accept = new Button('Accept');
    const cancel = new Button('Cancel');
    modal.add(accept);
    modal.add(cancel);
    root.add(outside);
    root.add(modal);

    const loop = createEventLoop({ width: 40, height: 8 }, { caps: EXAMPLE_CAPS });
    loop.mount(root);
    loop.focusView(outside);

    const result = loop.execView<string>(modal);
    expect(loop.getFocused()).toBe(accept);
    loop.focusNext();
    expect(loop.getFocused()).toBe(cancel);
    loop.focusNext();
    expect(loop.getFocused()).toBe(accept);

    loop.endModal('accepted');
    await expect(result).resolves.toBe('accepted');
    expect(loop.getFocused()).toBe(outside);
  });
});

describe('Views & focus course laboratory contract', () => {
  test('registers two unique app laboratories at the declared guide source paths', () => {
    expect(new Set(labIds).size).toBe(2);
    expect(registryEntry(traversalLabId)).toMatchObject({
      kind: 'app',
      sourcePath: 'examples/guides/views-focus-traversal.ts',
    });
    expect(registryEntry(modalityLabId)).toMatchObject({
      kind: 'app',
      sourcePath: 'examples/guides/views-focus-modality.ts',
    });
  });

  test.each(labIds)('%s uses the compact centered Classic template1 shell through every window state', async (id) => {
    const definition = await loadDefinition(id);
    createRoot((dispose) => {
      const built = buildLabExample(id, definition, { viewport: { width: 120, height: 40 } });
      const initial = collectTemplate1Evidence(built.app, built.dialog, {
        startup: 'compact',
      });
      const desktop = built.app.desktop;
      if (desktop === undefined) throw new Error('template1 requires a desktop');
      expect(built.dialog.closable).toBe(false);
      expect(built.dialog.background).toBeUndefined();
      expect(initial.frameLines.join('\n')).toMatch(/(?:Alt|Tab|Enter|Space|mouse|click|arrow)/i);
      expect(
        Math.min(
          built.dialog.bounds.x,
          built.dialog.bounds.y,
          desktop.bounds.width - built.dialog.bounds.x - built.dialog.bounds.width,
          desktop.bounds.height - built.dialog.bounds.y - built.dialog.bounds.height,
        ),
      ).toBeGreaterThan(0);

      const origin = absoluteOrigin(built.dialog);
      const authored = { ...built.dialog.bounds };
      const from = {
        x: origin.x + built.dialog.bounds.width - 1,
        y: origin.y + built.dialog.bounds.height - 1,
      };
      dispatchExampleAction(built.app, {
        kind: 'mouse',
        gesture: 'drag',
        at: from,
        to: { x: from.x + 7, y: from.y + 3 },
      });
      expect(built.dialog.bounds.width).toBeGreaterThan(authored.width);
      expect(built.dialog.bounds.height).toBeGreaterThan(authored.height);
      const resized = { ...built.dialog.bounds };
      collectTemplate1Evidence(built.app, built.dialog, { startup: 'resized' });

      built.dialog.zoom();
      built.app.loop.renderRoot.flush();
      built.app.loop.renderRoot.flush();
      collectTemplate1Evidence(built.app, built.dialog, { startup: 'maximized' });

      built.dialog.zoom();
      built.app.loop.renderRoot.flush();
      built.app.loop.renderRoot.flush();
      expect(built.dialog.bounds).toEqual(resized);
      collectTemplate1Evidence(built.app, built.dialog, { startup: 'resized' });
      dispose();
    });
  });

  test('the traversal lab makes document order, reverse traversal, eligibility, and restoration observable', async () => {
    const definition = await loadDefinition(traversalLabId);
    createRoot((dispose) => {
      const built = buildLabExample(traversalLabId, definition);
      const initialText = frameText(built.app);
      const initialStatus = focusStatus(initialText);
      const initialFocus = built.app.loop.getFocused();
      expect(initialText).toMatch(/tree order/i);
      expect(initialText).toMatch(/Tab/);
      expect(initialText).toMatch(/Shift\+Tab/);
      expect(initialStatus).not.toBe('');

      built.app.loop.dispatch(key('tab'));
      expect(built.app.loop.getFocused()).not.toBe(initialFocus);
      expect(focusStatus(frameText(built.app))).not.toBe(initialStatus);

      built.app.loop.dispatch(key('tab', { shift: true }));
      expect(built.app.loop.getFocused()).toBe(initialFocus);

      built.app.loop.dispatch(key('h', { alt: true }));
      expect(frameText(built.app)).toMatch(/Hidden target:\s*yes/i);
      built.app.loop.dispatch(key('d', { alt: true }));
      expect(frameText(built.app)).toMatch(/Disabled target:\s*yes/i);
      built.app.loop.dispatch(key('i', { alt: true }));
      expect(frameText(built.app)).toMatch(/focusInto[\s\S]{0,80}(?:restored|entered)/i);
      dispose();
    });
  });

  test('the modality lab contains keyboard focus and visibly restores it after closing', async () => {
    const definition = await loadDefinition(modalityLabId);
    createRoot((dispose) => {
      const built = buildLabExample(modalityLabId, definition);
      const beforeModal = built.app.loop.getFocused();
      const initialText = frameText(built.app);
      expect(initialText).toMatch(/Alt\+M/i);
      expect(initialText).toMatch(/(?:open|launch).+modal/i);

      built.app.loop.dispatch(key('m', { alt: true }));
      const desktop = built.app.desktop;
      if (desktop === undefined) throw new Error('template1 requires a desktop');
      const nestedDialog = viewsIn(desktop).find(
        (view): view is Dialog => view instanceof Dialog && view !== built.dialog,
      );
      expect(nestedDialog).toBeDefined();
      expect(isDescendantOf(built.app.loop.getFocused(), nestedDialog!)).toBe(true);
      expect(frameText(built.app)).toMatch(/Modal open[\s\S]{0,100}(?:contained|confined)/i);

      built.app.loop.dispatch(key('tab'));
      expect(isDescendantOf(built.app.loop.getFocused(), nestedDialog!)).toBe(true);
      built.app.loop.dispatch(key('tab', { shift: true }));
      expect(isDescendantOf(built.app.loop.getFocused(), nestedDialog!)).toBe(true);

      built.app.loop.dispatch(key('escape'));
      expect(built.app.loop.getFocused()).toBe(beforeModal);
      expect(frameText(built.app)).toMatch(/Restored focus:/i);
      dispose();
    });
  });

  test('both labs expose keyboard-reachable actions and persistent non-color feedback', async () => {
    for (const id of labIds) {
      const definition = await loadDefinition(id);
      createRoot((dispose) => {
        const built = buildLabExample(id, definition);
        const buttons = viewsIn(built.dialog).filter((view): view is Button => view instanceof Button);
        expect(buttons.length).toBeGreaterThan(0);
        expect(buttons.every((button) => button.focusable && button.state.visible && !button.state.disabled)).toBe(
          true,
        );
        expect(frameText(built.app)).toMatch(/(?:Focused:|Status:|Restored focus:)/i);
        expect(frameText(built.app)).toMatch(/Alt\+[A-Z]/);
        dispose();
      });
    }
  });
});
