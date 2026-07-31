/**
 * Immutable oracle for the Async work, cancellation & progress course and its two laboratories.
 *
 * Public controls prove bounded progress, deterministic timer cleanup, cooperative cancellation,
 * latest-result-wins identity, and safe diagnostics. Final assertions describe the learner result.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sanitize } from '@jsvision/core';
import { Button, ProgressBar, Spinner, View, createRoot, onCleanup, runSpinner, signal } from '@jsvision/ui';
import type { TimerSeam } from '@jsvision/ui';
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

const guidePath = fileURLToPath(new URL('../guide/async-work.md', import.meta.url));
const catalogPath = fileURLToPath(new URL('../guides.json', import.meta.url));
const source = existsSync(guidePath) ? readFileSync(guidePath, 'utf8') : '';
const catalog = parseGuideCatalog(readFileSync(catalogPath, 'utf8'));
const guide = catalog.entries.find((candidate) => candidate.id === 'async-work');
const cancellableLabId = 'guides/cancellable-work';
const latestLabId = 'guides/latest-result-wins';
const labIds = [cancellableLabId, latestLabId] as const;

interface CancellableWorkPanel extends View {
  readonly lessonName: 'Cancellable work';
  readonly startedRuns: number;
  readonly completedRuns: number;
  readonly cancelledRuns: number;
  readonly failedRuns: number;
  readonly inputTicks: number;
  readonly cleanupCount: number;
}

interface LatestResultPanel extends View {
  readonly lessonName: 'Latest result wins';
  readonly requestedRuns: number;
  readonly publishedRuns: number;
  readonly staleDrops: number;
  readonly cancelledRuns: number;
  readonly abortedRuns: number;
  readonly cleanupCount: number;
}

function isCancellableWorkPanel(view: View): view is CancellableWorkPanel {
  return (
    view.constructor.name === 'CancellableWorkPanel' &&
    'lessonName' in view &&
    view.lessonName === 'Cancellable work' &&
    'startedRuns' in view &&
    typeof view.startedRuns === 'number' &&
    'completedRuns' in view &&
    typeof view.completedRuns === 'number' &&
    'cancelledRuns' in view &&
    typeof view.cancelledRuns === 'number' &&
    'failedRuns' in view &&
    typeof view.failedRuns === 'number' &&
    'inputTicks' in view &&
    typeof view.inputTicks === 'number' &&
    'cleanupCount' in view &&
    typeof view.cleanupCount === 'number'
  );
}

function cancellablePanelIn(dialog: View): CancellableWorkPanel {
  const panels = viewsIn(dialog).filter(isCancellableWorkPanel);
  expect(panels).toHaveLength(1);
  const panel = panels[0];
  if (panel === undefined) throw new Error('Cancellable work laboratory is missing its teaching panel');
  return panel;
}

function isLatestResultPanel(view: View): view is LatestResultPanel {
  return (
    view.constructor.name === 'LatestResultPanel' &&
    'lessonName' in view &&
    view.lessonName === 'Latest result wins' &&
    'requestedRuns' in view &&
    typeof view.requestedRuns === 'number' &&
    'publishedRuns' in view &&
    typeof view.publishedRuns === 'number' &&
    'staleDrops' in view &&
    typeof view.staleDrops === 'number' &&
    'cancelledRuns' in view &&
    typeof view.cancelledRuns === 'number' &&
    'abortedRuns' in view &&
    typeof view.abortedRuns === 'number' &&
    'cleanupCount' in view &&
    typeof view.cleanupCount === 'number'
  );
}

function latestPanelIn(dialog: View): LatestResultPanel {
  const panels = viewsIn(dialog).filter(isLatestResultPanel);
  expect(panels).toHaveLength(1);
  const panel = panels[0];
  if (panel === undefined) throw new Error('Latest-result laboratory is missing its teaching panel');
  return panel;
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

function fakeTimer() {
  let pending: (() => void) | null = null;
  let nextHandle = 1;
  let clears = 0;
  const armed: number[] = [];
  const seam: TimerSeam = {
    setTimer: (callback, ms) => {
      pending = callback;
      armed.push(ms);
      return nextHandle++;
    },
    clearTimer: () => {
      pending = null;
      clears += 1;
    },
  };
  return {
    seam,
    armed,
    fire: () => {
      const callback = pending;
      pending = null;
      callback?.();
    },
    get pending() {
      return pending;
    },
    get clears() {
      return clears;
    },
  };
}

describe('Async work, cancellation & progress course contract', () => {
  test('should publish the completed catalog course with exact prerequisites, outcomes, and labs', () => {
    expect(source).not.toBe('');
    expect(guide).toMatchObject({
      title: 'Async work, cancellation & progress',
      page: '/guide/async-work',
      profile: 'course',
      stage: 'complete',
      prerequisites: ['reactive-state', 'dialogs-and-modality'],
      requiredLiveExamples: 2,
      liveExampleException: null,
      examples: [...labIds],
    });
    expect(guide?.learningOutcomes).toEqual([
      'Run asynchronous work without blocking input or rendering.',
      'Model cancellation, progress, errors, cleanup, and stale-result protection.',
    ]);
    expect(source).toContain('](/guide/reactive-state)');
    expect(source).toContain('](/guide/dialogs-and-modality)');
  });

  test('should state the learner contract and progress through the complete course backbone', () => {
    const sections = [
      '## Who this course is for',
      '## Mental model',
      '## Your first responsive async result',
      '## Model work state explicitly',
      '## Progress and responsive boundaries',
      '## Cooperative cancellation',
      '## Errors and retry',
      '## Latest result wins',
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
    expect(source).toMatch(/^description:\s*.+async.+(?:cancel|progress).+(?:stale|error|responsive).+$/imu);
    expect(source).toMatch(
      /\bbuild\b[\s\S]{0,450}\bexplain\b[\s\S]{0,450}\bdiagnos(?:e|is)\b[\s\S]{0,450}\bverify\b/iu,
    );
    expect(source).toMatch(/(?:assume|already know|comfortable with)[\s\S]{0,450}(?:reactive state|dialog|modality)/iu);
    expect(source).toMatch(/(?:search|load|export|synchroni[sz]e|report)[\s\S]{0,550}(?:cancel|progress|stale)/iu);
    expect(source).toContain(`<PlayExample id="${cancellableLabId}"`);
    expect(source).toContain(`<PlayExample id="${latestLabId}"`);
  });

  test('should teach explicit state, bounded progress, non-blocking work, and automatic repaint', () => {
    expect(source).toMatch(
      /idle[\s\S]{0,220}(?:running|loading)[\s\S]{0,220}success[\s\S]{0,220}error[\s\S]{0,220}cancelled/iu,
    );
    expect(source).toMatch(/progress[\s\S]{0,350}(?:0.+1|clamp|bounded)/iu);
    expect(source).toMatch(/(?:yield|chunk|await)[\s\S]{0,450}(?:input|render)[\s\S]{0,250}responsive/iu);
    expect(source).toMatch(/dispatch[\s\S]{0,450}(?:does not|doesn't)[\s\S]{0,250}await[\s\S]{0,250}async/iu);
    expect(source).toMatch(
      /(?:timer|Promise|async callback)[\s\S]{0,500}signal[\s\S]{0,300}(?:deferred|microtask|automatic)[\s\S]{0,220}(?:paint|repaint)/iu,
    );
    expect(source).not.toMatch(
      /(?:must|always|need to)[\s\S]{0,120}(?:renderRoot\.flush|no-op command)[\s\S]{0,180}(?:timer|Promise|signal)/iu,
    );
  });

  test('should teach cancellation, exact ownership cleanup, errors, retry, and stale suppression', () => {
    expect(source).toMatch(/AbortController[\s\S]{0,350}AbortSignal[\s\S]{0,350}(?:cooperative|check|abort)/iu);
    expect(source).toMatch(
      /(?:timer|subscription|controller)[\s\S]{0,450}onCleanup\([\s\S]{0,350}(?:stop|clear|abort)/iu,
    );
    expect(source).toMatch(/cleanup[\s\S]{0,350}(?:exactly once|idempotent|repeat-safe)/iu);
    expect(source).toMatch(/cancelled[\s\S]{0,400}(?:cannot|must not|never)[\s\S]{0,250}(?:success|publish)/iu);
    expect(source).toMatch(/(?:error|failure)[\s\S]{0,450}(?:discriminat|separate)[\s\S]{0,250}(?:result|success)/iu);
    expect(source).toMatch(/retry[\s\S]{0,400}(?:new|fresh)[\s\S]{0,250}(?:controller|generation|attempt)/iu);
    expect(source).toMatch(
      /(?:generation|request id)[\s\S]{0,450}(?:latest|newest)[\s\S]{0,350}(?:drop|ignore|stale)/iu,
    );
    expect(source).toMatch(/(?:dispose|unmount)[\s\S]{0,450}(?:invalidate|abort)[\s\S]{0,300}(?:pending|generation)/iu);
    expect(source).not.toMatch(/(?:AsyncJob|JobRunner|createAsyncJob|useAsyncJob)/u);
  });

  test('should teach deterministic seams, truthful feedback roles, and safe diagnostics', () => {
    expect(source).toMatch(
      /(?:scheduler|clock|timer|transport)[\s\S]{0,500}(?:inject|seam)[\s\S]{0,300}deterministic/iu,
    );
    for (const role of ['progressFill', 'progressTrack', 'staticText', 'label']) {
      expect(source).toContain(`\`${role}\``);
    }
    expect(source).toMatch(/sanitize\([\s\S]{0,450}(?:untrusted|control character|display text)/iu);
    expect(source).toMatch(/(?:bound|truncate|limit)[\s\S]{0,350}diagnostic/iu);
    expect(source).toMatch(/(?:secret|token|payload)[\s\S]{0,450}(?:redact|never|do not leak)/iu);
    expect(source).toMatch(/(?:non-colou?r|label|text)[\s\S]{0,450}(?:state|progress|error|cancel)/iu);
    expect(source).toMatch(/(?:ASCII|monochrome)[\s\S]{0,400}(?:line|fallback|cue)/iu);
    expect(source).toMatch(/(?:reduced|small)[ -](?:geometry|viewport)[\s\S]{0,400}(?:clip|wrap|resize)/iu);
  });

  test('should keep snippets public, focused, owned, cancellable, and generation-safe', () => {
    const code = snippets();
    expect(code.length).toBeGreaterThanOrEqual(9);
    for (const snippet of code) {
      expect(snippet.split('\n').filter((line) => line.trim() !== '').length).toBeLessThanOrEqual(28);
      expect(snippet).not.toMatch(
        /(?:demoApp|Template1Dialog|defineExample|packages\/(?:ui|core)\/src|@jsvision\/ui\/src)/u,
      );
      expect(snippet).not.toMatch(/(?:AsyncJob|JobRunner|createAsyncJob|useAsyncJob)/u);
      expect(snippet).not.toMatch(/(?:renderRoot\.flush|no-op command)/u);
      for (const imported of snippet.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu)) {
        expect(['@jsvision/core', '@jsvision/ui']).toContain(imported[1]);
      }
    }
    expect(code.some((snippet) => /signal\([\s\S]*(?:idle|running|loading)/u.test(snippet))).toBe(true);
    expect(code.some((snippet) => /AbortController[\s\S]*(?:onCleanup|abort)/u.test(snippet))).toBe(true);
    expect(code.some((snippet) => /generation[\s\S]*(?:latest|stale|!==)/u.test(snippet))).toBe(true);
    expect(code.some((snippet) => /runSpinner[\s\S]*(?:stop|onCleanup)/u.test(snippet))).toBe(true);
  });

  test('should diagnose failures and finish with practice, boundaries, and owning links', () => {
    expect(source).toMatch(/symptom[\s\S]{0,280}cause[\s\S]{0,280}(?:correction|fix)[\s\S]{0,280}evidence/iu);
    for (const failure of [
      /(?:frozen|unresponsive)[\s\S]{0,450}(?:blocking|yield|chunk)/iu,
      /cancel[\s\S]{0,450}(?:success|published)/iu,
      /(?:progress|percent)[\s\S]{0,350}(?:below|above|out of range|clamp)/iu,
      /(?:older|stale)[\s\S]{0,400}(?:overwrite|replace)[\s\S]{0,250}(?:newer|latest)/iu,
      /(?:timer|subscription|controller)[\s\S]{0,400}(?:leak|after unmount|cleanup)/iu,
      /(?:error|secret|payload)[\s\S]{0,400}(?:leak|unsafe|untrusted)/iu,
    ]) {
      expect(source).toMatch(failure);
    }
    expect(source).toMatch(
      /## Practice and next steps[\s\S]{0,1500}(?:cancel|progress)[\s\S]{0,550}(?:retry|error)[\s\S]{0,550}(?:generation|stale)/iu,
    );
    expect(source).toMatch(/(?:Forms|Files|Data Grid|Code Editor)[\s\S]{0,500}(?:owns|specialist|course)/iu);
    for (const link of [
      '/guide/reactive-state',
      '/guide/dialogs-and-modality',
      '/components/feedback/progress-bar',
      '/components/feedback/spinner',
      '/api/ui/classes/ProgressBar',
      '/api/ui/classes/Spinner',
      '/api/ui/functions/runSpinner',
      '/api/ui/functions/createRoot',
      '/api/core/functions/sanitize',
    ]) {
      expect(source).toContain(link);
    }
  });
});

describe('public async-work building blocks taught by the course', () => {
  test('should clamp ProgressBar reads and expose explicit set and label geometry', () => {
    const value = signal(-1);
    const bar = new ProgressBar({ value, caption: true, label: 'Loading', labelPosition: 'top' });
    expect(bar.percent).toBe(0);
    bar.set(0.456);
    expect(value()).toBe(0.456);
    expect(bar.percent).toBe(46);
    bar.set(2);
    expect(bar.percent).toBe(100);
    expect(bar.measure({ width: 24, height: 4 })).toEqual({ width: 24, height: 2 });
  });

  test('should advance Spinner through an injected timer and stop exactly once', () => {
    const frame = signal(0);
    const timer = fakeTimer();
    const spinner = new Spinner({ frame, preset: 'dots', label: 'Working' });
    expect(spinner.focusable).toBe(false);
    const stop = runSpinner(frame, { timer: timer.seam, intervalMs: 120 });
    expect(timer.armed).toEqual([120]);
    timer.fire();
    timer.fire();
    expect(frame()).toBe(2);
    expect(timer.armed).toEqual([120, 120, 120]);
    stop();
    stop();
    expect(timer.clears).toBe(1);
    expect(timer.pending).toBeNull();
    timer.fire();
    expect(frame()).toBe(2);
  });

  test('should abort owned work exactly once and prevent cancelled success publication', () => {
    let cleanupCount = 0;
    let controller: AbortController | undefined;
    let publishCount = 0;
    createRoot((dispose) => {
      controller = new AbortController();
      onCleanup(() => {
        controller?.abort();
        cleanupCount += 1;
      });
      const publish = (): void => {
        if (controller?.signal.aborted !== true) publishCount += 1;
      };
      dispose();
      publish();
    });
    expect(controller?.signal.aborted).toBe(true);
    expect(cleanupCount).toBe(1);
    expect(publishCount).toBe(0);
  });

  test('should publish only the latest generation and sanitize bounded display diagnostics', () => {
    let currentGeneration = 0;
    let published = '';
    let staleDrops = 0;
    const request = () => {
      const generation = ++currentGeneration;
      return (value: string): void => {
        if (generation !== currentGeneration) {
          staleDrops += 1;
          return;
        }
        published = sanitize(value).slice(0, 32);
      };
    };
    const older = request();
    const newer = request();
    newer('newest\x1b]0;secret\x07');
    older('stale');
    expect(published).toBe('newest]0;secret');
    expect(staleDrops).toBe(1);
    expect(published).not.toContain('\x1b');
    expect(published.length).toBeLessThanOrEqual(32);
  });
});

describe('Cancellable work and latest-result-wins laboratory contract', () => {
  test('should register two applications with objective-specific titles and blurbs', async () => {
    expect(registryEntry(cancellableLabId)).toMatchObject({
      kind: 'app',
      sourcePath: 'examples/guides/cancellable-work.ts',
    });
    expect(registryEntry(latestLabId)).toMatchObject({
      kind: 'app',
      sourcePath: 'examples/guides/latest-result-wins.ts',
    });
    const cancellable = await loadDefinition(cancellableLabId);
    const latest = await loadDefinition(latestLabId);
    expect(cancellable.title).toMatch(/Cancellable Work (?:Laboratory|Workshop)/iu);
    expect(cancellable.blurb).toMatch(/progress[\s\S]*cancel[\s\S]*(?:responsive|retry|cleanup)/iu);
    expect(latest.title).toMatch(/Latest Result Wins (?:Laboratory|Workshop)/iu);
    expect(latest.blurb).toMatch(/overlap[\s\S]*(?:out of order|stale)[\s\S]*(?:newest|publish)/iu);
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

  test('should keep input responsive while cancellation, failure, retry, and cleanup stay truthful', async () => {
    const definition = await loadDefinition(cancellableLabId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(cancellableLabId, definition);
      const panel = cancellablePanelIn(dialog);
      expect(frameText(app)).toMatch(/State:\s*idle[\s\S]*Progress:\s*0%/iu);
      app.loop.dispatch(key('s', { alt: true }));
      expect(panel.startedRuns).toBe(1);
      expect(frameText(app)).toMatch(/State:\s*running/iu);
      app.loop.dispatch(key('h'));
      expect(panel.inputTicks).toBe(1);
      expect(frameText(app)).toMatch(/Heartbeat:\s*1[\s\S]*responsive/iu);
      app.loop.dispatch(key('a', { alt: true }));
      expect(frameText(app)).toMatch(/Progress:\s*(?:[1-9]\d?|100)%/iu);
      app.loop.dispatch(key('c', { alt: true }));
      expect(panel.cancelledRuns).toBe(1);
      expect(panel.completedRuns).toBe(0);
      expect(panel.cleanupCount).toBe(1);
      expect(frameText(app)).toMatch(/State:\s*cancelled[\s\S]*Published success:\s*no/iu);
      app.loop.dispatch(key('s', { alt: true }));
      app.loop.dispatch(key('f', { alt: true }));
      expect(panel.failedRuns).toBe(1);
      expect(frameText(app)).toMatch(/State:\s*error[\s\S]*Retry:\s*available/iu);
      app.loop.dispatch(key('r', { alt: true }));
      expect(panel.startedRuns).toBeGreaterThanOrEqual(3);
      expect(frameText(app)).toMatch(/State:\s*(?:running|success)/iu);
      clickButton(app, dialog, 'Advance');
      expect(frameText(app)).toMatch(/Action source:\s*mouse/iu);
      app.loop.dispose();
      dispose();
    });
  });

  test('should publish newest overlap, drop stale completion, cancel pending work, and clean up', async () => {
    const definition = await loadDefinition(latestLabId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(latestLabId, definition);
      const panel = latestPanelIn(dialog);
      expect(frameText(app)).toMatch(/Requested:\s*none[\s\S]*Published:\s*none/iu);
      app.loop.dispatch(key('r', { alt: true }));
      expect(panel.requestedRuns).toBe(2);
      expect(frameText(app)).toMatch(/Requested:\s*1,\s*2/iu);
      app.loop.dispatch(key('c', { alt: true }));
      expect(panel.cancelledRuns).toBe(1);
      expect(panel.abortedRuns).toBe(2);
      expect(panel.cleanupCount).toBe(2);
      expect(frameText(app)).toMatch(/Pending:\s*0[\s\S]*(?:cancelled|invalidated)/iu);
      app.loop.dispatch(key('r', { alt: true }));
      expect(panel.requestedRuns).toBe(4);
      expect(frameText(app)).toMatch(/Requested:\s*3,\s*4/iu);
      app.loop.dispatch(key('n', { alt: true }));
      expect(panel.publishedRuns).toBe(1);
      expect(frameText(app)).toMatch(/Published:\s*4/iu);
      app.loop.dispatch(key('l', { alt: true }));
      expect(panel.staleDrops).toBe(1);
      expect(frameText(app)).toMatch(/Dropped stale:\s*3[\s\S]*Published:\s*4/iu);
      clickButton(app, dialog, 'Request pair');
      expect(frameText(app)).toMatch(/Action source:\s*mouse/iu);
      app.loop.dispose();
      dispose();
    });
  });

  test('should expose keyboard and mouse routes, bounded fixtures, non-color state, and exact cleanup', async () => {
    for (const id of labIds) {
      const definition = await loadDefinition(id);
      let mounted: View[] = [];
      createRoot((dispose) => {
        const { app, dialog } = buildLabExample(id, definition);
        mounted = viewsIn(dialog);
        expect(frameText(app)).toMatch(/Alt\+[A-Z]/u);
        expect(frameText(app)).toMatch(/(?:State|Progress|Requested|Published|Dropped|Action):/iu);
        expect(frameText(app)).toMatch(/(?:idle|running|cancelled|error|success|none|bounded)/iu);
        expect(frameText(app)).toMatch(/(?:deterministic|in-memory|No network|bounded fixture)/iu);
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
