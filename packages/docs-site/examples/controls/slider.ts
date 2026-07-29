/**
 * An interactive Slider laboratory showing horizontal and vertical orientations, range boundaries,
 * keyboard and pointer input, live-versus-commit callbacks, linked labels, and reset.
 */
import { Button, Dialog, Group, Label, Slider, Text, at, signal } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CONTENT_PADDING = 1;
const CONTENT_WIDTH = 60;
const CONTENT_HEIGHT = 14;
const DIALOG_WIDTH = CONTENT_WIDTH + (CONTENT_PADDING + 1) * 2;
const DIALOG_HEIGHT = CONTENT_HEIGHT + (CONTENT_PADDING + 1) * 2;

export default defineExample({
  title: 'Slider Lab',
  blurb: 'Compare two orientations and watch live preview and commit counts while using every input path.',
  build: (ctx) => {
    const app = demoApp(ctx, { themeMenu: true });
    const horizontalValue = signal(40);
    const verticalValue = signal(50);
    const previewCount = signal(0);
    const commitCount = signal(0);
    const status = signal('ready');

    const horizontal = new Slider({
      value: horizontalValue,
      min: 0,
      max: 100,
      step: 5,
      pageStep: 20,
      onInput: () => previewCount.set(previewCount() + 1),
      onChange: () => {
        commitCount.set(commitCount() + 1);
        status.set('horizontal value committed');
      },
    });
    const vertical = new Slider({
      value: verticalValue,
      min: 0,
      max: 100,
      step: 5,
      pageStep: 25,
      orientation: 'vertical',
      onInput: () => status.set('vertical preview changed'),
      onChange: () => status.set('vertical value committed'),
    });

    const dialog = new Dialog({ title: ' Slider Lab ', width: DIALOG_WIDTH, height: DIALOG_HEIGHT });
    dialog.closable = false;
    const content = new Group();

    content.add(at(new Text('A bounded numeric signal with separate preview and commit events.'), 0, 0, 60, 1));
    content.add(at(new Label('~H~orizontal', horizontal), 0, 2, 12, 1));
    content.add(at(horizontal, 14, 2, 34, 1));
    content.add(at(new Text(() => `${horizontalValue()}%`), 51, 2, 8, 1));
    content.add(
      at(
        new Text(() => `Horizontal: ${horizontalValue()} · previews ${previewCount()} · commits ${commitCount()}`),
        0,
        3,
        60,
        1,
      ),
    );

    content.add(at(new Label('Ver~t~ical', vertical), 0, 5, 10, 1));
    content.add(at(vertical, 13, 5, 1, 5));
    content.add(at(new Text('100 ┐'), 17, 5, 8, 1));
    content.add(at(new Text(() => `Vertical: ${verticalValue()}`), 20, 7, 20, 1));
    content.add(at(new Text('  0 ┘'), 17, 9, 8, 1));
    content.add(at(new Text('The vertical long axis is five cells here.'), 39, 6, 21, 2));

    content.add(
      at(
        new Button('~R~eset', {
          onClick: () => {
            horizontalValue.set(40);
            verticalValue.set(50);
            previewCount.set(0);
            commitCount.set(0);
            status.set('reset');
          },
        }),
        0,
        10,
        12,
        2,
      ),
    );
    content.add(at(new Text(() => `Status: ${status()}`), 15, 10, 45, 1));
    content.add(at(new Text('Arrows step · Home/End bound · PgUp/PgDn page · wheel nudges'), 0, 12, 60, 1));
    content.add(at(new Text('Click or drag the groove · Alt+H/T focuses · Alt+R resets'), 0, 13, 60, 1));

    dialog.add(at(content, CONTENT_PADDING, CONTENT_PADDING, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
