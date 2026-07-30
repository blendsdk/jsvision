/**
 * Implementation hardening for the asynchronous-work laboratories.
 *
 * These checks stress repeated terminal transitions, fresh retry ownership, superseded request
 * pairs, disposal, and responsive geometry beyond the learner-visible course contract.
 */
import { View, createRoot } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import cancellableExample from '../examples/guides/cancellable-work.js';
import latestExample from '../examples/guides/latest-result-wins.js';
import { CancellableWorkPanel } from '../src/example-fixtures/async-work/cancellable-work-panel.js';
import { LatestResultPanel } from '../src/example-fixtures/async-work/latest-result-panel.js';
import { buildLabExample, collectTemplate1Evidence, frameText, key, viewsIn } from './example-lab-harness.js';

/** Return the single mounted fixture panel of the requested class. */
function panelIn<T extends View>(dialog: View, type: abstract new (...args: never[]) => T): T {
  const panel = viewsIn(dialog).find((view): view is T => view instanceof type);
  if (panel === undefined) throw new Error(`laboratory is missing ${type.name}`);
  return panel;
}

describe('cancellable-work laboratory edges', () => {
  test('should keep repeated cancellation terminal and release one attempt exactly once', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/cancellable-work', cancellableExample);
      const panel = panelIn(dialog, CancellableWorkPanel);

      panel.start('keyboard');
      panel.advance('keyboard');
      panel.cancel('keyboard');
      panel.cancel('keyboard');
      panel.advance('keyboard');

      expect(panel.cancelledRuns).toBe(1);
      expect(panel.completedRuns).toBe(0);
      expect(panel.cleanupCount).toBe(1);
      app.loop.renderRoot.flush();
      expect(frameText(app)).toMatch(/State:\s*cancelled[\s\S]*Published success:\s*no/iu);

      app.loop.dispose();
      dispose();
    });
  });

  test('should give retry a fresh owner and publish only after all bounded chunks complete', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/cancellable-work', cancellableExample);
      const panel = panelIn(dialog, CancellableWorkPanel);

      panel.start('keyboard');
      panel.fail('keyboard');
      panel.retry('keyboard');
      for (let step = 0; step < 4; step += 1) panel.advance('keyboard');

      expect(panel.startedRuns).toBe(2);
      expect(panel.failedRuns).toBe(1);
      expect(panel.completedRuns).toBe(1);
      expect(panel.cleanupCount).toBe(2);
      app.loop.renderRoot.flush();
      expect(frameText(app)).toMatch(/State:\s*success[\s\S]*Progress:\s*100%/iu);

      app.loop.dispose();
      dispose();
    });
  });

  test('should abort an active attempt once when the application is disposed repeatedly', () => {
    let panel: CancellableWorkPanel | undefined;
    let loop: ReturnType<typeof buildLabExample>['app']['loop'] | undefined;
    createRoot((dispose) => {
      const built = buildLabExample('guides/cancellable-work', cancellableExample);
      panel = panelIn(built.dialog, CancellableWorkPanel);
      loop = built.app.loop;
      panel.start('keyboard');

      loop.dispose();
      loop.dispose();
      dispose();
    });

    expect(panel?.cleanupCount).toBe(1);
    expect(panel?.mounted).toBe(false);
  });
});

describe('latest-result-wins laboratory edges', () => {
  test('should abort and release every genuinely pending controller exactly once', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/latest-result-wins', latestExample);
      const panel = panelIn(dialog, LatestResultPanel);

      panel.requestPair('keyboard');
      panel.cancelPending('keyboard');
      panel.cancelPending('keyboard');

      expect(panel.cancelledRuns).toBe(1);
      expect(panel.abortedRuns).toBe(2);
      expect(panel.cleanupCount).toBe(2);
      app.loop.renderRoot.flush();
      expect(frameText(app)).toMatch(/Pending:\s*0[\s\S]*cancelled.+invalidated/iu);

      app.loop.dispose();
      dispose();
    });
  });

  test('should release superseded pairs and keep publication authority with the newest request', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/latest-result-wins', latestExample);
      const panel = panelIn(dialog, LatestResultPanel);

      panel.requestPair('keyboard');
      panel.requestPair('keyboard');
      expect(panel.requestedRuns).toBe(4);
      expect(panel.cleanupCount).toBe(2);

      panel.completeNewest('keyboard');
      panel.completeOlder('keyboard');
      expect(panel.publishedRuns).toBe(1);
      expect(panel.staleDrops).toBe(1);
      expect(panel.cleanupCount).toBe(4);
      app.loop.renderRoot.flush();
      expect(frameText(app)).toMatch(/Dropped stale:\s*3[\s\S]*Published:\s*4/iu);

      app.loop.dispose();
      dispose();
    });
  });

  test('should invalidate and release every pending generation during disposal', () => {
    let panel: LatestResultPanel | undefined;
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('guides/latest-result-wins', latestExample);
      panel = panelIn(dialog, LatestResultPanel);
      panel.requestPair('keyboard');

      app.loop.dispose();
      dispose();
    });

    expect(panel?.cleanupCount).toBe(2);
    expect(panel?.publishedRuns).toBe(0);
    expect(panel?.mounted).toBe(false);
  });

  test.each([
    ['guides/cancellable-work', cancellableExample],
    ['guides/latest-result-wins', latestExample],
  ] as const)('should preserve active teaching state when %s grows and zooms', (id, definition) => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(id, definition, {
        viewport: { width: 120, height: 40 },
      });
      app.loop.dispatch(key(id.includes('cancellable') ? 's' : 'r', { alt: true }));
      const stateBefore = frameText(app);

      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog);

      const stateAfter = frameText(app);
      if (id.includes('cancellable')) {
        expect(stateBefore).toMatch(/State:\s*running/iu);
        expect(stateAfter).toMatch(/State:\s*running/iu);
      } else {
        expect(stateBefore).toMatch(/Requested:\s*1,\s*2/iu);
        expect(stateAfter).toMatch(/Requested:\s*1,\s*2/iu);
      }

      app.loop.dispose();
      dispose();
    });
  });
});
