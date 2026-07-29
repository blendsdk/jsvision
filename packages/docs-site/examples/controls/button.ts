/**
 * An interactive Button laboratory showing normal, default, disabled, focused, pressed, and
 * reactively enabled states. The first action receives focus, while clicking and holding any
 * enabled face reveals the transient pressed treatment.
 */
import { Button, Group, Input, Label, Text, View, signal, at } from '@jsvision/ui';
import type { Rect } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import type { Template1DialogSize } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CONTENT_PADDING = 1;
const CONTENT_WIDTH = 66;
const CONTENT_HEIGHT = 14;
const DIALOG_WIDTH = CONTENT_WIDTH + (CONTENT_PADDING + 1) * 2;
const DIALOG_HEIGHT = CONTENT_HEIGHT + (CONTENT_PADDING + 1) * 2;

/** One live-lab child paired with its immutable compact geometry. */
interface ButtonLabRegion {
  /** View repositioned whenever the dialog changes size. */
  readonly view: View;
  /** Authored rectangle at the compact dialog size. */
  readonly rect: Rect;
}

/** Capture an absolutely placed child without retaining its later mutable solved bounds. */
function captureRegion(view: View): ButtonLabRegion {
  const rect = view.layout.rect;
  if (rect === undefined) throw new Error('Button lab regions require authored absolute geometry');
  return { view, rect: { ...rect } };
}

/** Scale an authored interval by its edges so neighboring regions stay on the same responsive grid. */
function scaleInterval(start: number, length: number, authoredExtent: number, nextExtent: number): [number, number] {
  const nextStart = Math.round((start * nextExtent) / authoredExtent);
  const nextEnd = Math.round(((start + length) * nextExtent) / authoredExtent);
  return [nextStart, Math.max(1, nextEnd - nextStart)];
}

/**
 * Reflow the Button laboratory while preserving the control's two-row raised face.
 *
 * Horizontal intervals still scale with the dialog, so action rows use the available width. Other
 * teaching regions keep the shared proportional behavior; only Button height follows its intrinsic
 * measurement because extra vertical space belongs between controls, not inside their faces.
 */
function reflowButtonLab(size: Template1DialogSize, content: Group, regions: readonly ButtonLabRegion[]): void {
  const nextWidth = size.width - 4;
  const nextHeight = size.height - 4;
  content.setLayout({ rect: { x: CONTENT_PADDING, y: CONTENT_PADDING, width: nextWidth, height: nextHeight } });

  for (const { view, rect } of regions) {
    const [x, width] = scaleInterval(rect.x, rect.width, CONTENT_WIDTH, nextWidth);
    const [y, scaledHeight] = scaleInterval(rect.y, rect.height, CONTENT_HEIGHT, nextHeight);
    const height = view instanceof Button ? view.measure().height : scaledHeight;
    view.setLayout({ rect: { x, y, width, height } });
  }
}

export default defineExample({
  title: 'Button Lab',
  blurb: 'Compare every Button state, exercise its keyboard paths, and enable an action reactively.',
  build: (ctx) => {
    const app = demoApp(ctx, { themeMenu: true });
    const projectName = signal('');
    const lastAction = signal('Nothing yet');
    const nameInput = new Input({ value: projectName, maxLength: 20, placeholder: 'Type to enable Save' });
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

    const regions = content.children.map(captureRegion);
    const dialog = new Template1Dialog({
      title: ' Button Lab ',
      width: DIALOG_WIDTH,
      height: DIALOG_HEIGHT,
      onResize: (size) => reflowButtonLab(size, content, regions),
    });
    app.onCommand('demo.button.deploy', () => lastAction.set('Deploy command + callback'));
    dialog.add(at(content, CONTENT_PADDING, CONTENT_PADDING, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
