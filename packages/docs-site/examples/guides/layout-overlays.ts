/**
 * Interactive overlay workshop for the Layout guide.
 *
 * A full-size base layer, a centered card, and a corner badge occupy one stack. Toggling the front
 * layers proves that overlays do not consume flow space or resize the content behind them.
 */
import { Button, Group, Text, at, centered, signal, stack, topRight } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { LayoutLessonPanel } from '../../src/example-fixtures/layout/lesson-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CONTENT_WIDTH = 66;
const CONTENT_HEIGHT = 14;
const DIALOG_WIDTH = CONTENT_WIDTH + 4;
const DIALOG_HEIGHT = CONTENT_HEIGHT + 4;

export default defineExample({
  title: 'Layout Overlay Workshop',
  blurb: 'Toggle centered and corner layers to see z-order, fill placement, and out-of-flow behavior.',
  build: (ctx) => {
    const app = demoApp(ctx, { themeMenu: true });
    const cardVisible = signal(true);
    const badgeVisible = signal(true);
    const base = new LayoutLessonPanel('Base layer', 'untagged: fills the stack', 'desktop');
    const card = new LayoutLessonPanel('Centered card', 'centered(card, 30, 4)', 'window');
    const badge = new LayoutLessonPanel('NEW', '', 'button');
    const stage = stack(base, centered(card, 30, 4), topRight(badge, 7, 1));

    const toggleCard = new Button('Toggle ~c~ard', {
      onClick: () => {
        cardVisible.update((value) => !value);
        card.state.visible = cardVisible();
        stage.invalidateLayout();
      },
    });
    const toggleBadge = new Button('Toggle ~N~EW', {
      onClick: () => {
        badgeVisible.update((value) => !value);
        badge.state.visible = badgeVisible();
        stage.invalidateLayout();
      },
    });

    const content = new Group();
    content.add(
      at(new Text('One shared box · later layers paint in front · overlays reserve no flow space'), 0, 0, 66, 1),
    );
    content.add(at(stage, 0, 2, 66, 8));
    content.add(at(toggleCard, 0, 10, 18, 2));
    content.add(at(toggleBadge, 20, 10, 18, 2));
    content.add(
      at(
        new Text(() => `Card ${cardVisible() ? 'visible' : 'hidden'} · NEW ${badgeVisible() ? 'visible' : 'hidden'}`),
        0,
        12,
        66,
        1,
      ),
    );
    content.add(at(new Text('Alt+C/N toggles layers · maximize or resize to watch them re-anchor'), 0, 13, 66, 1));

    const dialog = new Template1Dialog({
      title: ' Layout Overlay Workshop ',
      width: DIALOG_WIDTH,
      height: DIALOG_HEIGHT,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button,
    });
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
