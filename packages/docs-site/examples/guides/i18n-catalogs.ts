/** Locale fallback, missing-key diagnostics, and atomic overlay laboratory. */
import { Button, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { CatalogLabPanel } from '../../src/example-fixtures/i18n-guide/catalog-lab-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_TRANSLATE = 'guide.i18n-catalogs.translate';
const CMD_MISSING = 'guide.i18n-catalogs.missing';
const CMD_OVERLAY = 'guide.i18n-catalogs.overlay';

export default defineExample({
  title: 'Catalog Lookup Laboratory',
  blurb:
    'Resolve structured fallbacks, inspect a value-free missing-key diagnostic, and prove that an invalid runtime overlay cannot replace the active catalog.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+t': CMD_TRANSLATE,
        'alt+m': CMD_MISSING,
        'alt+o': CMD_OVERLAY,
      }),
    });
    const panel = new CatalogLabPanel();
    app.onCommand(CMD_TRANSLATE, () => panel.translate('keyboard'));
    app.onCommand(CMD_MISSING, () => panel.showMissing('keyboard'));
    app.onCommand(CMD_OVERLAY, () => panel.publishOverlay('keyboard'));

    const translate = new Button('~T~ranslate', { onClick: () => panel.translate('mouse') });
    const missing = new Button('~M~issing key', { onClick: () => panel.showMissing('mouse') });
    const overlay = new Button('~O~verlay', { onClick: () => panel.publishOverlay('mouse') });
    const content = new Group();
    content.add(at(panel, 0, 0, 60, 10));
    content.add(at(translate, 0, 11, 12, 2));
    content.add(at(missing, 14, 11, 14, 2));
    content.add(at(overlay, 30, 11, 11, 2));
    content.add(at(new Text('Alt+T translate · Alt+M missing · Alt+O overlay'), 0, 13, 60, 1));
    content.add(at(new Text('Tab reaches buttons · mouse click · evidence is not colour-only'), 0, 14, 60, 1));

    const dialog = new Template1Dialog({
      title: ' Catalog Lookup & Publication ',
      width: 64,
      height: 20,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button || view === panel,
    });
    dialog.add(at(content, 1, 1, 60, 16));
    app.desktop.addWindow(dialog);
    app.loop.focusView(translate);
    return app;
  },
});
