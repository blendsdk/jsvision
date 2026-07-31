/** Lifetime, stale-work, failure, and cleanup laboratory. */
import { Button, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { ArchitectureOwnershipPanel } from '../../src/example-fixtures/application-architecture/architecture-ownership-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_NAVIGATE = 'guide.architecture.navigate';
const CMD_FAILURE = 'guide.architecture.failure';
const CMD_STALE = 'guide.architecture.stale';

export default defineExample({
  title: 'Architecture Ownership Laboratory',
  blurb:
    'Inspect application, screen, and widget lifetimes while stale work, isolated failure, and exact cleanup remain visible.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+n': CMD_NAVIGATE,
        'alt+f': CMD_FAILURE,
        'alt+s': CMD_STALE,
      }),
    });
    const panel = new ArchitectureOwnershipPanel({
      load: () => ({
        ok: false,
        code: 'SERVICE_UNAVAILABLE',
        unsafeDetail: 'fixture-secret-payload',
      }),
    });
    app.onCommand(CMD_NAVIGATE, () => panel.navigate('keyboard'));
    app.onCommand(CMD_FAILURE, () => panel.isolateFailure('keyboard'));
    app.onCommand(CMD_STALE, () => panel.suppressStale('keyboard'));

    const navigate = new Button('Navigate', {
      command: CMD_NAVIGATE,
      onClick: () => panel.markNextActionSource('mouse'),
    });
    const failure = new Button('Isolate failure', {
      command: CMD_FAILURE,
      onClick: () => panel.markNextActionSource('mouse'),
    });
    const stale = new Button('Suppress stale', {
      command: CMD_STALE,
      onClick: () => panel.markNextActionSource('mouse'),
    });
    const content = new Group();
    content.add(at(panel, 0, 0, 60, 11));
    content.add(at(navigate, 0, 11, 12, 2));
    content.add(at(failure, 14, 11, 18, 2));
    content.add(at(stale, 34, 11, 17, 2));
    content.add(at(new Text('Alt+N navigate · Alt+F failure · Alt+S stale · click parity'), 0, 14, 60, 1));
    content.add(at(new Text('Deterministic in-memory fixture · ASCII/non-colour status cues'), 0, 15, 60, 1));

    const dialog = new Template1Dialog({
      title: ' Architecture Ownership ',
      width: 66,
      height: 20,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button,
    });
    dialog.add(at(content, 1, 1, 62, 16));
    app.desktop.addWindow(dialog);
    app.loop.focusView(navigate);
    return app;
  },
});
