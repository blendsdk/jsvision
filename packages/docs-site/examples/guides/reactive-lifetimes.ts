/**
 * Interactive dependency and lifetime laboratory for the Reactive state guide.
 *
 * A nested owner holds one effect. The effect conditionally tracks one of two sources, reads a note
 * without tracking it, registers per-run cleanup, and can be disposed independently of the app.
 */
import { Button, Group, Text, at, createRoot, effect, onCleanup, signal, untrack } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CONTENT_WIDTH = 66;
const CONTENT_HEIGHT = 14;
const DIALOG_WIDTH = CONTENT_WIDTH + 4;
const DIALOG_HEIGHT = CONTENT_HEIGHT + 4;

export default defineExample({
  title: 'Reactive Lifetime Lab',
  blurb: 'Switch dynamic dependencies, compare untracked writes, run cleanup, and dispose an owned effect.',
  build: (ctx) => {
    const app = demoApp(ctx, { themeMenu: true });
    const selectedSource = signal<'primary' | 'backup'>('primary');
    const primary = signal(10);
    const backup = signal(100);
    const note = signal('alpha');
    const runs = signal(0);
    const cleanups = signal(0);
    const scopeActive = signal(true);
    const observation = signal('');
    const action = signal('watcher owns only the dependencies read on its latest run');

    const disposeWatcher = createRoot((dispose) => {
      effect(() => {
        const selected = selectedSource();
        const value = selected === 'primary' ? primary() : backup();
        const noteSnapshot = untrack(() => note());
        runs.set(runs.peek() + 1);
        observation.set(`Watching ${selected} = ${value} · note snapshot "${noteSnapshot}"`);
        onCleanup(() => cleanups.set(cleanups.peek() + 1));
      });
      return dispose;
    });

    const switchSource = new Button('~S~witch source', {
      onClick: () => {
        selectedSource.update((value) => (value === 'primary' ? 'backup' : 'primary'));
        action.set('branch changed: dependencies were collected again');
      },
    });
    const updateActive = new Button('Update ~a~ctive', {
      onClick: () => {
        if (selectedSource.peek() === 'primary') primary.update((value) => value + 1);
        else backup.update((value) => value + 1);
        action.set('tracked source changed: cleanup, then rerun');
      },
    });
    const updateInactive = new Button('Update ~i~nactive', {
      onClick: () => {
        if (selectedSource.peek() === 'primary') backup.update((value) => value + 1);
        else primary.update((value) => value + 1);
        action.set('inactive source changed: watcher did not rerun');
      },
    });
    const changeNote = new Button('Change ~n~ote', {
      onClick: () => {
        note.update((value) => (value === 'alpha' ? 'beta' : 'alpha'));
        action.set('untracked note changed: watcher kept its snapshot');
      },
    });
    const disposeEffect = new Button('~D~ispose watcher', {
      onClick: () => {
        if (!scopeActive.peek()) return;
        disposeWatcher();
        scopeActive.set(false);
        action.set('owner disposed: cleanup ran and subscriptions were removed');
      },
    });

    const content = new Group();
    content.add(
      at(new Text('One effect changes its tracked branch, ignores one read, and owns cleanup.'), 0, 0, 66, 1),
    );
    content.add(at(new Text(() => observation()), 0, 2, 66, 1));
    content.add(
      at(
        new Text(
          () =>
            `Runs ${runs()} · cleanups ${cleanups()} · scope ${scopeActive() ? 'active' : 'disposed'} · note ${note()}`,
        ),
        0,
        3,
        66,
        1,
      ),
    );
    content.add(at(new Text(() => action()), 0, 5, 66, 1));
    content.add(at(switchSource, 0, 7, 18, 2));
    content.add(at(updateActive, 20, 7, 18, 2));
    content.add(at(updateInactive, 40, 7, 20, 2));
    content.add(at(changeNote, 0, 10, 18, 2));
    content.add(at(disposeEffect, 20, 10, 20, 2));
    content.add(
      at(new Text('Alt+S/A/I/N/D · note read with untrack() · cleanup runs before rerun/dispose'), 0, 13, 66, 1),
    );

    const dialog = new Template1Dialog({
      title: ' Reactive Lifetime Lab ',
      width: DIALOG_WIDTH,
      height: DIALOG_HEIGHT,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button,
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
