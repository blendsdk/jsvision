/** Screen disposal, keep-alive, focus restoration, and cleanup laboratory. */
import { Button, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { RoutingLifecyclePanel } from '../../src/example-fixtures/screens-and-routing/routing-lifecycle-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_TRIP = 'guide.routing-lifecycle.trip';
const CMD_POLICY = 'guide.routing-lifecycle.policy';
const CMD_MUTATE = 'guide.routing-lifecycle.mutate';

export default defineExample({
  title: 'Routing Lifecycle Laboratory',
  blurb:
    'Compare dispose-on-leave and keep-alive through exact build, cleanup, local-instance, and restored-focus evidence.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+t': CMD_TRIP,
        'alt+p': CMD_POLICY,
        'alt+m': CMD_MUTATE,
      }),
    });
    const panel = new RoutingLifecyclePanel({
      focusView: (view) => app.loop.focusView(view),
      getFocused: () => app.loop.getFocused(),
    });
    app.onCommand(CMD_TRIP, () => panel.roundTrip('keyboard'));
    app.onCommand(CMD_POLICY, () => panel.togglePolicy('keyboard'));
    app.onCommand(CMD_MUTATE, () => panel.mutateLocal('keyboard'));

    const trip = new Button('Round ~T~rip', { onClick: () => panel.roundTrip('mouse') });
    const policy = new Button('Toggle ~P~olicy', { onClick: () => panel.togglePolicy('mouse') });
    const mutate = new Button('~M~utate Local', { onClick: () => panel.mutateLocal('mouse') });
    const content = new Group();
    content.add(at(panel, 0, 0, 60, 9));
    content.add(at(trip, 0, 10, 14, 2));
    content.add(at(policy, 16, 10, 16, 2));
    content.add(at(mutate, 34, 10, 15, 2));
    content.add(at(new Text('Alt+M mutate · Alt+T trip · Alt+P policy · mouse parity'), 0, 12, 60, 1));
    content.add(at(new Text('Resize/maximize/restore: ownership evidence stays visible.'), 0, 14, 60, 1));

    const dialog = new Template1Dialog({
      title: ' Screen State, Focus & Cleanup ',
      width: 64,
      height: 20,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button || view === panel,
    });
    dialog.add(at(content, 1, 1, 60, 16));
    app.desktop.addWindow(dialog);
    app.loop.focusView(trip);
    return app;
  },
});
