/** Locale reconstruction and translated terminal-cell geometry laboratory. */
import { Button, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { LocaleLayoutPanel } from '../../src/example-fixtures/i18n-guide/locale-layout-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_LOCALE = 'guide.i18n-locale-layout.locale';

export default defineExample({
  title: 'Locale Reconstruction Laboratory',
  blurb:
    'Switch between English and German, rebuild translated controls from a fresh locale service, and observe complete-group terminal-cell measurement.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+l': CMD_LOCALE,
      }),
    });
    const panel = new LocaleLayoutPanel();
    app.onCommand(CMD_LOCALE, () => panel.switchLocale('keyboard'));
    const switchLocale = new Button('Switch ~L~ocale', {
      onClick: () => panel.switchLocale('mouse'),
    });
    const content = new Group();
    content.add(at(panel, 0, 0, 60, 12));
    content.add(at(switchLocale, 0, 12, 16, 2));
    content.add(at(new Text('Alt+L locale · Tab reaches controls · mouse click'), 18, 12, 42, 1));
    content.add(at(new Text('Resize/maximize/restore: translated actions remain inside the frame.'), 0, 14, 60, 1));

    const dialog = new Template1Dialog({
      title: ' Locale Reconstruction & Cell Layout ',
      width: 64,
      height: 20,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button || view === panel,
    });
    dialog.add(at(content, 1, 1, 60, 16));
    app.desktop.addWindow(dialog);
    app.loop.focusView(switchLocale);
    return app;
  },
});
