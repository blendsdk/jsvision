/**
 * An interactive Button laboratory showing normal, default, disabled, focused, pressed, and
 * reactively enabled states. The first action receives focus, while clicking and holding any
 * enabled face reveals the transient pressed treatment.
 */
import { Button, Dialog, Group, Input, Label, Text, signal, at } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CONTENT_PADDING = 1;
const CONTENT_WIDTH = 66;
const CONTENT_HEIGHT = 14;
const DIALOG_WIDTH = CONTENT_WIDTH + (CONTENT_PADDING + 1) * 2;
const DIALOG_HEIGHT = CONTENT_HEIGHT + (CONTENT_PADDING + 1) * 2;

export default defineExample({
  title: 'Button Lab',
  blurb: 'Compare every Button state, exercise its keyboard paths, and enable an action reactively.',
  build: (ctx) => {
    const app = demoApp(ctx, { themeMenu: true });
    const projectName = signal('');
    const lastAction = signal('Nothing yet');
    const nameInput = new Input({ value: projectName, maxLength: 20, placeholder: 'Type to enable Save' });
    const dialog = new Dialog({ title: ' Button Lab ', width: DIALOG_WIDTH, height: DIALOG_HEIGHT });
    dialog.closable = false;
    const content = new Group();

    content.add(at(new Text('State gallery — hold the mouse button to see the pressed face'), 0, 0, CONTENT_WIDTH, 1));
    content.add(at(new Button('~P~review', { onClick: () => lastAction.set('Preview callback') }), 0, 2, 14, 2));
    content.add(
      at(
        new Button('~D~eploy', {
          command: 'demo.button.deploy',
          default: true,
          onClick: () => lastAction.set('Deploy command + callback'),
        }),
        16,
        2,
        14,
        2,
      ),
    );
    content.add(at(new Button('~U~navailable', { disabled: true }), 32, 2, 16, 2));

    content.add(at(new Text('Reactive disabled state'), 0, 5, CONTENT_WIDTH, 1));
    content.add(at(new Label('Project ~n~ame', nameInput), 0, 7, 14, 1));
    content.add(at(nameInput, 15, 7, 27, 1));
    content.add(
      at(
        new Button('~S~ave changes', {
          disabled: () => projectName().trim() === '',
          onClick: () => lastAction.set(`Saved "${projectName().trim()}"`),
        }),
        44,
        6,
        18,
        2,
      ),
    );

    content.add(at(new Text(() => `Last action: ${lastAction()}`), 0, 10, CONTENT_WIDTH, 1));
    content.add(
      at(new Text('Tab / Shift+Tab moves focus · Space activates the focused button'), 0, 12, CONTENT_WIDTH, 1),
    );
    content.add(at(new Text('Enter runs Deploy · Alt+P/D/U/N/S uses the marked hotkeys'), 0, 13, CONTENT_WIDTH, 1));

    app.onCommand('demo.button.deploy', () => lastAction.set('Deploy command + callback'));
    dialog.add(at(content, CONTENT_PADDING, CONTENT_PADDING, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
