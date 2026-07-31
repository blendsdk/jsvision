/**
 * Tree-order traversal laboratory for the Views & focus course.
 *
 * Two nested groups make document order visible. The lesson can remove targets from focus
 * eligibility and re-enter a group through the public focus API while persistent text reports the
 * result without relying on colour alone.
 */
import { Button, Group, Text, at, createKeymap, createRoot, signal } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { focusReadout } from '../../src/example-fixtures/views-and-focus/focus-readout.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_HIDE = 'views-focus-traversal.hide';
const CMD_DISABLE = 'views-focus-traversal.disable';
const CMD_ENTER = 'views-focus-traversal.enter';
const CONTENT_WIDTH = 66;
const CONTENT_HEIGHT = 14;

export default defineExample({
  title: 'Focus Traversal Laboratory',
  blurb: 'Walk nested groups in tree order, remove hidden and disabled targets, then restore group focus.',
  build: (ctx) =>
    createRoot((disposeReactive) => {
      ctx.onCleanup?.(disposeReactive);
      const app = demoApp(ctx, {
        themeMenu: true,
        keymap: createKeymap({
          'alt+h': CMD_HIDE,
          'alt+d': CMD_DISABLE,
          'alt+i': CMD_ENTER,
        }),
      });
      const hidden = signal(false);
      const disabled = signal(false);
      const action = signal('Status: Tab forward or Shift+Tab backward through the retained tree');

      const alpha = new Button('~A~lpha', { onClick: () => action.set('Status: Alpha activated') });
      const beta = new Button('~B~eta', { onClick: () => action.set('Status: Beta activated') });
      const gamma = new Button('~G~amma', { onClick: () => action.set('Status: Gamma activated') });
      const delta = new Button('~L~ast', { onClick: () => action.set('Status: Last activated') });

      const firstGroup = new Group();
      firstGroup.add(at(alpha, 0, 0, 14, 2));
      firstGroup.add(at(beta, 16, 0, 14, 2));
      const secondGroup = new Group();
      secondGroup.add(at(gamma, 0, 0, 14, 2));
      secondGroup.add(at(delta, 16, 0, 14, 2));

      const labels = new Map([
        [alpha, 'Alpha (group 1, item 1)'],
        [beta, 'Beta (group 1, item 2)'],
        [gamma, 'Gamma (group 2, item 1)'],
        [delta, 'Last (group 2, item 2)'],
      ]);
      const hideTarget = new Button('Toggle ~h~idden', { command: CMD_HIDE });
      const disableTarget = new Button('Toggle ~d~isabled', { command: CMD_DISABLE });
      const enterGroup = new Button('Focus ~i~nto group 1', { command: CMD_ENTER });

      app.onCommand(CMD_HIDE, () => {
        const next = !hidden.peek();
        hidden.set(next);
        beta.state.visible = !next;
        beta.invalidateLayout();
        if (next && app.loop.getFocused() === beta) {
          const fallback = gamma.state.disabled ? delta : gamma;
          app.loop.focusView(fallback);
          action.set(`Status: Beta left focus candidates; focus moved to ${fallback === gamma ? 'Gamma' : 'Last'}`);
          return;
        }
        action.set(`Status: Beta ${next ? 'left' : 'rejoined'} the tree-order focus candidates`);
      });
      app.onCommand(CMD_DISABLE, () => {
        const next = !disabled.peek();
        disabled.set(next);
        gamma.state.disabled = next;
        gamma.invalidate();
        if (next && app.loop.getFocused() === gamma) {
          app.loop.focusView(delta);
          action.set('Status: Gamma became ineligible; focus moved to Last');
          return;
        }
        action.set(`Status: Gamma is ${next ? 'skipped' : 'eligible'} during traversal`);
      });
      app.onCommand(CMD_ENTER, () => {
        app.loop.focusInto(firstGroup);
        action.set('Status: focusInto restored group 1 memory, or entered its first eligible child');
      });

      const content = new Group();
      content.add(at(new Text('Tree order follows retained child order across nested groups.'), 0, 0, 66, 1));
      content.add(at(new Text('Group 1'), 0, 2, 30, 1));
      content.add(at(new Text('Group 2'), 34, 2, 30, 1));
      content.add(at(firstGroup, 0, 3, 30, 2));
      content.add(at(secondGroup, 34, 3, 30, 2));
      content.add(at(new Text(focusReadout(app.loop, labels)), 0, 6, 66, 1));
      content.add(
        at(
          new Text(() => `Hidden target: ${hidden() ? 'yes' : 'no'} | Disabled target: ${disabled() ? 'yes' : 'no'}`),
          0,
          7,
          66,
          1,
        ),
      );
      content.add(at(hideTarget, 0, 9, 19, 2));
      content.add(at(disableTarget, 21, 9, 20, 2));
      content.add(at(enterGroup, 43, 9, 21, 2));
      content.add(at(new Text(() => action()), 0, 12, 66, 1));
      content.add(at(new Text('Tab / Shift+Tab traverse | Alt+H hide | Alt+D disable | Alt+I enter'), 0, 13, 66, 1));

      const dialog = new Template1Dialog({
        title: ' Focus Traversal Laboratory ',
        width: CONTENT_WIDTH + 4,
        height: CONTENT_HEIGHT + 4,
        preserveChildHeights: (view) => view instanceof Text || view instanceof Button,
      });
      dialog.onMount(() => dialog.onCleanup(disposeReactive));
      dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
      app.desktop.addWindow(dialog);
      app.loop.focusView(alpha);
      return app;
    }),
});
