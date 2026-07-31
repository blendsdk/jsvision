/**
 * Immutable oracle for the Dialogs & modality course and its two laboratories.
 *
 * Public controls prove the modal result, validation, confinement, focus, helper, and teardown
 * contracts. Course and laboratory assertions describe the final learner-visible result.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  Button,
  Commands,
  Dialog,
  Group,
  Input,
  View,
  confirm,
  createApplication,
  createEventLoop,
  createRoot,
  inputBox,
  messageBox,
  range,
  signal,
} from '@jsvision/ui';
import type { DispatchEvent, DrawContext } from '@jsvision/ui';
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

const guidePath = fileURLToPath(new URL('../guide/dialogs-and-modality.md', import.meta.url));
const catalogPath = fileURLToPath(new URL('../guides.json', import.meta.url));
const source = existsSync(guidePath) ? readFileSync(guidePath, 'utf8') : '';
const catalog = parseGuideCatalog(readFileSync(catalogPath, 'utf8'));
const guide = catalog.entries.find((candidate) => candidate.id === 'dialogs-and-modality');
const resultsLabId = 'guides/dialog-results';
const workflowsLabId = 'guides/modal-workflows';
const labIds = [resultsLabId, workflowsLabId] as const;

interface DialogResultsPanel extends View {
  readonly lessonName: 'Dialog results';
  readonly invalidAttempts: number;
  readonly acceptedResults: number;
  readonly cancelBypasses: number;
}

interface ModalWorkflowsPanel extends View {
  readonly lessonName: 'Modal workflows';
  readonly nestedRuns: number;
  readonly confinedOuterEvents: number;
  readonly cleanupCount: number;
}

class FocusLeaf extends View {
  events = 0;

  constructor(readonly label: string) {
    super();
    this.focusable = true;
  }

  override draw(_ctx: DrawContext): void {}

  override onEvent(_event: DispatchEvent): void {
    this.events += 1;
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

function isDialogResultsPanel(view: View): view is DialogResultsPanel {
  return (
    view.constructor.name === 'DialogResultsPanel' &&
    'lessonName' in view &&
    view.lessonName === 'Dialog results' &&
    'invalidAttempts' in view &&
    typeof view.invalidAttempts === 'number' &&
    'acceptedResults' in view &&
    typeof view.acceptedResults === 'number' &&
    'cancelBypasses' in view &&
    typeof view.cancelBypasses === 'number'
  );
}

function dialogResultsPanelIn(dialog: View): DialogResultsPanel {
  const panels = viewsIn(dialog).filter(isDialogResultsPanel);
  expect(panels).toHaveLength(1);
  const panel = panels[0];
  if (panel === undefined) throw new Error('Dialog results laboratory is missing its teaching panel');
  return panel;
}

function isModalWorkflowsPanel(view: View): view is ModalWorkflowsPanel {
  return (
    view.constructor.name === 'ModalWorkflowsPanel' &&
    'lessonName' in view &&
    view.lessonName === 'Modal workflows' &&
    'nestedRuns' in view &&
    typeof view.nestedRuns === 'number' &&
    'confinedOuterEvents' in view &&
    typeof view.confinedOuterEvents === 'number' &&
    'cleanupCount' in view &&
    typeof view.cleanupCount === 'number'
  );
}

function modalWorkflowsPanelIn(dialog: View): ModalWorkflowsPanel {
  const panels = viewsIn(dialog).filter(isModalWorkflowsPanel);
  expect(panels).toHaveLength(1);
  const panel = panels[0];
  if (panel === undefined) throw new Error('Modal workflows laboratory is missing its teaching panel');
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

function mountModalDialog(dialog: Dialog) {
  dialog.setLayout({
    position: 'absolute',
    padding: 1,
    rect: { x: 0, y: 0, width: 24, height: 8 },
  });
  const root = new Group();
  root.add(dialog);
  const loop = createEventLoop({ width: 40, height: 15 }, { caps: EXAMPLE_CAPS });
  loop.mount(root);
  return { loop, root, result: loop.execView<string>(dialog) };
}

describe('Dialogs & modality course contract', () => {
  test('should publish the completed catalog course with exact prerequisites, outcomes, and labs', () => {
    expect(source).not.toBe('');
    expect(guide).toMatchObject({
      title: 'Dialogs & modality',
      page: '/guide/dialogs-and-modality',
      profile: 'course',
      stage: 'complete',
      prerequisites: ['application-shell', 'views-and-focus'],
      requiredLiveExamples: 2,
      liveExampleException: null,
      examples: [...labIds],
    });
    expect(guide?.learningOutcomes).toEqual([
      'Await modal dialogs and interpret the command or value that resolves them.',
      'Build validation, nested confirmation, cancellation, and focus-safe dialog workflows.',
    ]);
    expect(source).toContain('](/guide/application-shell)');
    expect(source).toContain('](/guide/views-and-focus)');
  });

  test('should state the learner contract and progress through the complete course backbone', () => {
    const sections = [
      '## Who this course is for',
      '## Mental model',
      '## Your first modal result',
      '## Interpreting results',
      '## Validation and cancellation',
      '## Nested modal workflows',
      '## Input confinement and focus restoration',
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
    expect(source).toMatch(/^description:\s*.+(?:dialog|modal).+(?:result|validation|focus).+$/imu);
    expect(source).toMatch(
      /\bbuild\b[\s\S]{0,450}\bexplain\b[\s\S]{0,450}\bdiagnos(?:e|is)\b[\s\S]{0,450}\bverify\b/iu,
    );
    expect(source).toMatch(/(?:assume|already know|comfortable with)[\s\S]{0,450}(?:application shell|view|focus)/iu);
    expect(source).toMatch(/(?:delete|discard|rename|settings|destructive)[\s\S]{0,550}(?:confirm|validate|cancel)/iu);
    expect(source).toContain(`<PlayExample id="${resultsLabId}"`);
    expect(source).toContain(`<PlayExample id="${workflowsLabId}"`);
  });

  test('should teach result ownership and command-to-value interpretation accurately', () => {
    expect(source).toMatch(/execView<[^>]+>\([\s\S]{0,350}(?:Promise|await)[\s\S]{0,300}(?:result|undefined)/iu);
    expect(source).toMatch(/endModal\([\s\S]{0,350}(?:top|active)[\s\S]{0,250}modal/iu);
    for (const command of ['ok', 'cancel', 'yes', 'no']) {
      expect(source).toContain(`Commands.${command}`);
    }
    expect(source).toMatch(/Commands\.ok[\s\S]{0,450}(?:save|accept|commit)/iu);
    expect(source).toMatch(/Commands\.cancel[\s\S]{0,450}(?:leave|discard|no change|null)/iu);
    expect(source).toMatch(/messageBox\([\s\S]{0,400}(?:ok|cancel)/iu);
    expect(source).toMatch(/confirm\([\s\S]{0,350}(?:boolean|true|false)/iu);
    expect(source).toMatch(/inputBox\([\s\S]{0,400}(?:string|null)/iu);
  });

  test('should teach validation, cancel bypass, nesting, confinement, and focus-safe teardown', () => {
    expect(source).toMatch(/(?:OK|Yes|No)[\s\S]{0,450}(?:descendant|depth-first)[\s\S]{0,350}valid/iu);
    expect(source).toMatch(/invalid[\s\S]{0,400}(?:keep|remain)[\s\S]{0,220}open[\s\S]{0,300}focus/iu);
    expect(source).toMatch(/Cancel[\s\S]{0,350}(?:bypass|skip)[\s\S]{0,250}valid/iu);
    expect(source).toMatch(/(?:Esc|close box)[\s\S]{0,450}Commands\.cancel/iu);
    expect(source).toMatch(/nested[\s\S]{0,400}(?:LIFO|last in)[\s\S]{0,350}(?:inner|top)/iu);
    expect(source).toMatch(
      /(?:input|events)[\s\S]{0,400}(?:top modal|modal subtree)[\s\S]{0,300}(?:outer|background)[\s\S]{0,200}inert/iu,
    );
    expect(source).toMatch(
      /saved focus[\s\S]{0,450}(?:eligible|mounted|visible|enabled)[\s\S]{0,300}(?:restore|skip)/iu,
    );
    expect(source).toMatch(/(?:dispose|teardown)[\s\S]{0,450}undefined[\s\S]{0,300}(?:no|skip)[\s\S]{0,180}focus/iu);
  });

  test('should distinguish modeless removal from modal resolution and teach helper cleanup', () => {
    expect(source).toMatch(/modeless[\s\S]{0,450}(?:ordinary|non-blocking)[\s\S]{0,300}window/iu);
    expect(source).toMatch(/modal[\s\S]{0,350}await[\s\S]{0,300}(?:result|workflow)/iu);
    expect(source).toMatch(
      /Window\.close\(\)[\s\S]{0,450}(?:does not|never)[\s\S]{0,250}(?:endModal|resolve)[\s\S]{0,250}(?:hang|pending)/iu,
    );
    expect(source).toMatch(/desktop\.addWindow\([\s\S]{0,550}try[\s\S]{0,450}finally[\s\S]{0,350}removeWindow/iu);
    expect(source).toMatch(
      /(?:messageBox|confirm|inputBox)[\s\S]{0,500}(?:add|mount)[\s\S]{0,300}(?:finally|remove|cleanup)/iu,
    );
    expect(source).toMatch(/(?:Dialog component|component page)[\s\S]{0,450}(?:constructor|widget|options)/iu);
    expect(source).toMatch(/(?:Forms|Form Dialog)[\s\S]{0,450}(?:owns|specialist|multi-field)/iu);
  });

  test('should keep snippets public, focused, result-oriented, and cleanup-safe', () => {
    const code = snippets();
    expect(code.length).toBeGreaterThanOrEqual(8);
    for (const snippet of code) {
      expect(snippet.split('\n').filter((line) => line.trim() !== '').length).toBeLessThanOrEqual(28);
      expect(snippet).not.toMatch(/(?:demoApp|Template1Dialog|defineExample|packages\/ui\/src|@jsvision\/ui\/src)/u);
      for (const imported of snippet.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu)) {
        expect(imported[1]).toBe('@jsvision/ui');
      }
    }
    for (const concept of ['execView', 'Commands.ok', 'Commands.cancel', 'messageBox', 'confirm', 'inputBox']) {
      expect(code.some((snippet) => snippet.includes(concept))).toBe(true);
    }
    expect(code.some((snippet) => /try[\s\S]*finally[\s\S]*removeWindow/u.test(snippet))).toBe(true);
  });

  test('should diagnose failures and finish with accessible, safe practice and owning links', () => {
    expect(source).toMatch(/symptom[\s\S]{0,280}cause[\s\S]{0,280}(?:correction|fix)[\s\S]{0,280}evidence/iu);
    for (const failure of [
      /(?:hung|pending)[\s\S]{0,450}Window\.close|Window\.close[\s\S]{0,450}(?:hung|pending)/iu,
      /invalid OK[\s\S]{0,450}(?:veto|focus)/iu,
      /(?:stale|removed)[\s\S]{0,400}focus/iu,
      /(?:wrong|incorrect)[\s\S]{0,350}(?:LIFO|nested|order)/iu,
      /teardown[\s\S]{0,350}undefined/iu,
    ]) {
      expect(source).toMatch(failure);
    }
    expect(source).toMatch(/keyboard[\s\S]{0,450}(?:Esc|Tab|Enter)[\s\S]{0,300}(?:reachable|focus)/iu);
    expect(source).toMatch(/(?:non-colou?r|visible focus|label)[\s\S]{0,400}(?:invalid|status|feedback)/iu);
    expect(source).toMatch(/(?:reduced|small)[ -](?:geometry|viewport)[\s\S]{0,350}(?:wrap|clip|resize)/iu);
    expect(source).toMatch(/untrusted[\s\S]{0,400}(?:sanitize|escape)[\s\S]{0,250}(?:dialog|display|text)/iu);
    expect(source).toMatch(
      /(?:host authority|clipboard|filesystem|network)[\s\S]{0,450}(?:explicit|authorize|not implicit)/iu,
    );
    expect(source).toMatch(
      /## Practice and next steps[\s\S]{0,1500}(?:branch|result)[\s\S]{0,500}(?:invalid|cancel)[\s\S]{0,500}(?:nested|focus|teardown)/iu,
    );
    for (const link of [
      '/guide/application-shell',
      '/guide/views-and-focus',
      '/guide/forms',
      '/components/containers/dialog',
      '/components/controls/form-dialog',
      '/api/ui/classes/Dialog',
      '/api/ui/interfaces/EventLoop',
      '/api/ui/functions/messageBox',
      '/api/ui/functions/confirm',
      '/api/ui/functions/inputBox',
    ]) {
      expect(source).toContain(link);
    }
  });
});

describe('public dialog and modal behavior taught by the course', () => {
  test('should resolve nested modals LIFO, confine input, and restore each saved focus', async () => {
    const outer = new FocusLeaf('outer');
    const firstLeaf = new FocusLeaf('first');
    const first = new Group();
    first.add(firstLeaf);
    const secondLeaf = new FocusLeaf('second');
    const second = new Group();
    second.add(secondLeaf);
    const root = new Group();
    root.add(outer);
    root.add(first);
    root.add(second);
    const loop = createEventLoop({ width: 30, height: 10 }, { caps: EXAMPLE_CAPS });
    loop.mount(root);
    loop.focusView(outer);

    const firstResult = loop.execView<string>(first);
    expect(loop.getFocused()).toBe(firstLeaf);
    const secondResult = loop.execView<string>(second);
    expect(loop.getFocused()).toBe(secondLeaf);
    const outerEvents = outer.events;
    const firstEvents = firstLeaf.events;
    loop.dispatch(key('x'));
    expect(secondLeaf.events).toBeGreaterThan(0);
    expect(firstLeaf.events).toBe(firstEvents);
    expect(outer.events).toBe(outerEvents);

    loop.endModal('inner');
    expect(loop.getFocused()).toBe(firstLeaf);
    loop.endModal('outer');
    expect(loop.getFocused()).toBe(outer);
    await expect(secondResult).resolves.toBe('inner');
    await expect(firstResult).resolves.toBe('outer');
    loop.dispose();
  });

  test('should veto invalid OK, focus the invalid field, accept correction, and bypass with Cancel', async () => {
    const value = signal('150');
    const input = new Input({ value, validator: range(0, 100) });
    input.setLayout({ position: 'absolute', rect: { x: 1, y: 1, width: 12, height: 1 } });
    const acceptedDialog = new Dialog({ title: 'Age' });
    acceptedDialog.add(input);
    const accepted = mountModalDialog(acceptedDialog);
    let settled = false;
    void accepted.result.then(() => {
      settled = true;
    });
    accepted.loop.emitCommand(Commands.ok);
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(accepted.loop.getFocused()).toBe(input);
    value.set('50');
    accepted.loop.emitCommand(Commands.ok);
    await expect(accepted.result).resolves.toBe(Commands.ok);
    accepted.loop.dispose();

    const invalid = new Input({ value: signal('999'), validator: range(0, 100) });
    const cancelledDialog = new Dialog({ title: 'Cancel' });
    cancelledDialog.add(invalid);
    const cancelled = mountModalDialog(cancelledDialog);
    cancelled.loop.emitCommand(Commands.cancel);
    await expect(cancelled.result).resolves.toBe(Commands.cancel);
    cancelled.loop.dispose();
  });

  test('should resolve every pending modal undefined on disposal without restoring teardown focus', async () => {
    const outer = new FocusLeaf('outer');
    const first = new FocusLeaf('first');
    const second = new FocusLeaf('second');
    const root = new Group();
    root.add(outer);
    root.add(first);
    root.add(second);
    const loop = createEventLoop({ width: 24, height: 5 }, { caps: EXAMPLE_CAPS });
    loop.mount(root);
    loop.focusView(outer);
    const firstResult = loop.execView<string>(first);
    const secondResult = loop.execView<number>(second);
    loop.dispose();
    await expect(secondResult).resolves.toBeUndefined();
    await expect(firstResult).resolves.toBeUndefined();
    expect(loop.getFocused()).toBeNull();
    expect(root.mounted).toBe(false);
  });

  test('should map standard helper results and remove each helper dialog after resolution', async () => {
    const app = createApplication({ caps: EXAMPLE_CAPS, viewport: { width: 60, height: 20 } });
    const baseCount = app.desktop.children.length;

    const message = messageBox(app, { title: 'Info', text: 'Saved', buttons: 'okCancel' });
    expect(app.desktop.children).toHaveLength(baseCount + 1);
    app.loop.emitCommand(Commands.ok);
    await expect(message).resolves.toBe(Commands.ok);
    expect(app.desktop.children).toHaveLength(baseCount);

    const decision = confirm(app, 'Discard changes?');
    expect(app.desktop.children).toHaveLength(baseCount + 1);
    app.loop.emitCommand(Commands.no);
    await expect(decision).resolves.toBe(false);
    expect(app.desktop.children).toHaveLength(baseCount);

    const entered = inputBox(app, { title: 'Rename', label: 'Name', value: signal('report') });
    expect(app.desktop.children).toHaveLength(baseCount + 1);
    app.loop.emitCommand(Commands.ok);
    await expect(entered).resolves.toBe('report');
    expect(app.desktop.children).toHaveLength(baseCount);
    app.loop.dispose();
  });
});

describe('Dialog results and modal workflows laboratory contract', () => {
  test('should register two applications with objective-specific titles and blurbs', async () => {
    expect(registryEntry(resultsLabId)).toMatchObject({
      kind: 'app',
      sourcePath: 'examples/guides/dialog-results.ts',
    });
    expect(registryEntry(workflowsLabId)).toMatchObject({
      kind: 'app',
      sourcePath: 'examples/guides/modal-workflows.ts',
    });
    const results = await loadDefinition(resultsLabId);
    const workflows = await loadDefinition(workflowsLabId);
    expect(results.title).toMatch(/Dialog Results (?:Laboratory|Workshop)/iu);
    expect(results.blurb).toMatch(/validation[\s\S]*(?:result|command)[\s\S]*cancel/iu);
    expect(workflows.title).toMatch(/Modal Workflows (?:Laboratory|Workshop)/iu);
    expect(workflows.blurb).toMatch(/nested[\s\S]*(?:LIFO|focus)[\s\S]*(?:cancel|cleanup)/iu);
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
      expect(evidence.dialogInterior.join('\n')).toMatch(/(?:Alt|Enter|Esc|mouse|click)/iu);
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

  test('should prove validation veto, correction, result interpretation, and cancel bypass', async () => {
    const definition = await loadDefinition(resultsLabId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(resultsLabId, definition);
      const panel = dialogResultsPanelIn(dialog);
      expect(panel.lessonName).toBe('Dialog results');
      expect(frameText(app)).toMatch(/Value:\s*(?:150|invalid)[\s\S]*Result:\s*pending/iu);
      app.loop.dispatch(key('o', { alt: true }));
      expect(panel.invalidAttempts).toBe(1);
      expect(frameText(app)).toMatch(/Validation:\s*vetoed[\s\S]*Focus:\s*invalid field/iu);
      app.loop.dispatch(key('f', { alt: true }));
      expect(frameText(app)).toMatch(/Value:\s*(?:50|valid)/iu);
      app.loop.dispatch(key('o', { alt: true }));
      expect(panel.acceptedResults).toBe(1);
      expect(frameText(app)).toMatch(/Command result:\s*ok[\s\S]*Value result:\s*50/iu);
      app.loop.dispatch(key('r', { alt: true }));
      app.loop.dispatch(key('c', { alt: true }));
      expect(panel.cancelBypasses).toBe(1);
      expect(frameText(app)).toMatch(/Command result:\s*cancel[\s\S]*Validation:\s*bypassed/iu);
      clickButton(app, dialog, 'Try OK');
      expect(frameText(app)).toMatch(/Action source:\s*mouse/iu);
      app.loop.dispose();
      dispose();
    });
  });

  test('should prove nested LIFO, confinement, cancellation, focus restoration, and teardown', async () => {
    const definition = await loadDefinition(workflowsLabId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(workflowsLabId, definition);
      const panel = modalWorkflowsPanelIn(dialog);
      expect(panel.lessonName).toBe('Modal workflows');
      expect(frameText(app)).toMatch(/Focus:\s*(?:launcher|outer action)/iu);
      app.loop.dispatch(key('n', { alt: true }));
      expect(panel.nestedRuns).toBe(1);
      expect(frameText(app)).toMatch(/Stack:\s*outer\s*>\s*(?:confirmation|inner)/iu);
      app.loop.dispatch(key('x'));
      expect(panel.confinedOuterEvents).toBe(0);
      expect(frameText(app)).toMatch(/Input confined:\s*yes/iu);
      app.loop.dispatch(key('y', { alt: true }));
      expect(frameText(app)).toMatch(/Resolved:\s*inner yes[\s\S]*Focus restored:\s*outer modal/iu);
      app.loop.dispatch(key('c', { alt: true }));
      expect(frameText(app)).toMatch(/Resolved order:\s*inner\s*->\s*outer/iu);
      expect(frameText(app)).toMatch(/Focus restored:\s*launcher/iu);
      app.loop.dispatch(key('d', { alt: true }));
      expect(panel.cleanupCount).toBeGreaterThan(0);
      expect(frameText(app)).toMatch(/Teardown result:\s*undefined[\s\S]*Mounted modals:\s*0/iu);
      clickButton(app, dialog, 'Run nested workflow');
      expect(frameText(app)).toMatch(/Action source:\s*mouse/iu);
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
        expect(frameText(app)).toMatch(/(?:Result|Validation|Focus|Stack|Action|Teardown):/iu);
        expect(frameText(app)).toMatch(/(?:pending|valid|invalid|yes|no|undefined|restored)/iu);
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
