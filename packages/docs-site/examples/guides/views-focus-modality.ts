/**
 * Modal focus-scope laboratory for the Views & focus course.
 *
 * A deliberately closable nested dialog demonstrates containment and restoration while the
 * template1 course window remains alive. Persistent status text reports focus ownership without
 * depending on colour.
 */
import {
  Button,
  Dialog,
  Group,
  Input,
  Label,
  Text,
  at,
  cancelButton,
  createKeymap,
  createRoot,
  okButton,
  signal,
  type View,
} from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_OPEN = 'views-focus-modality.open';
const CONTENT_WIDTH = 62;
const CONTENT_HEIGHT = 12;

export default defineExample({
  title: 'Modal Focus Laboratory',
  blurb: 'Open a nested modal, traverse its contained scope, then close it and observe exact focus restoration.',
  build: (ctx) =>
    createRoot((disposeReactive) => {
      let active = true;
      const disposeLesson = (): void => {
        if (!active) return;
        active = false;
        disposeReactive();
      };
      ctx.onCleanup?.(disposeLesson);
      const app = demoApp(ctx, {
        themeMenu: true,
        keymap: createKeymap({ 'alt+m': CMD_OPEN }),
      });
      const result = signal('Status: ready to launch a modal focus scope');
      const workspace = new Button('~W~orkspace target', {
        onClick: () => result.set('Status: workspace target activated'),
      });
      const open = new Button('Open ~m~odal', { command: CMD_OPEN });
      const labels = new Map<View, string>([
        [open, 'Open modal'],
        [workspace, 'Workspace target'],
      ]);

      const content = new Group();
      content.add(
        at(
          new Text(() => {
            open.focusSignal()();
            workspace.focusSignal()();
            const focused = app.loop.getFocused();
            if (focused === open) return 'Restored focus: Open modal';
            if (focused === workspace) return 'Restored focus: Workspace target';
            return 'Modal open - focus contained in the nested dialog';
          }),
          0,
          0,
          62,
          1,
        ),
      );
      content.add(at(new Text('A modal saves current focus and confines input to its own subtree.'), 0, 1, 62, 1));
      content.add(at(open, 0, 3, 20, 2));
      content.add(at(workspace, 23, 3, 22, 2));
      content.add(at(new Text(() => result()), 0, 6, 62, 1));
      content.add(at(new Text('Alt+M opens | Tab / Shift+Tab stay contained | Esc closes'), 0, 9, 62, 1));
      content.add(at(new Text('After close, the exact previously focused control is restored.'), 0, 11, 62, 1));

      app.onCommand(CMD_OPEN, () => {
        const restoreFocus = app.loop.getFocused() ?? open;
        const value = signal('');
        const nested = new Dialog({ title: ' Modal focus scope ', width: 42, height: 10 });
        const input = new Input({ value });
        nested.add(at(new Text('Modal open - focus contained.'), 1, 1, 36, 1));
        nested.add(at(new Label('~N~ote', input), 1, 3, 9, 1));
        nested.add(at(input, 11, 3, 24, 1));
        nested.add(at(okButton(app.i18n), 7, 6, 11, 2));
        nested.add(at(cancelButton(app.i18n), 21, 6, 13, 2));
        app.desktop.addWindow(nested);
        // Adding a desktop window activates and focuses it immediately. Restore the launch target
        // before execView captures focus so the modal session saves the learner's actual origin.
        app.loop.focusView(restoreFocus);
        result.set('Status: Modal open - focus contained until OK, Cancel, or Esc');
        void app.loop.execView<string>(nested).then((command) => {
          if (command === undefined || !active) return;
          app.desktop.removeWindow(nested);
          // Removing the active desktop window chooses a new active window and may move focus into
          // it. Reapply the modal's saved target afterward so the laboratory demonstrates exact
          // restoration rather than only restoration to the surrounding application frame.
          app.loop.focusView(restoreFocus);
          result.set(`Restored focus: ${labels.get(restoreFocus) ?? 'previous control'} | ${command}`);
        });
      });

      const dialog = new Template1Dialog({
        title: ' Modal Focus Laboratory ',
        width: CONTENT_WIDTH + 4,
        height: CONTENT_HEIGHT + 4,
        preserveChildHeights: (view) => view instanceof Text || view instanceof Button,
      });
      dialog.onMount(() => dialog.onCleanup(disposeLesson));
      dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
      app.desktop.addWindow(dialog);
      app.loop.focusView(open);
      return app;
    }),
});
