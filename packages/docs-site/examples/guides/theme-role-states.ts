/** Semantic role, generated-theme, runtime-switching, and contrast laboratory. */
import { Button, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { ThemeRoleStatesPanel } from '../../src/example-fixtures/theming-and-colour-depth/theme-role-states-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_SWITCH = 'guide.theme-role-states.switch';
const CMD_ROLES = 'guide.theme-role-states.roles';
const CMD_CONTRAST = 'guide.theme-role-states.contrast';

export default defineExample({
  title: 'Semantic Theme Roles Laboratory',
  blurb: 'Map each role to a component state, switch the real application theme, and verify concrete contrast.',
  build: (ctx) => {
    const panelRef: { current?: ThemeRoleStatesPanel } = {};
    const app = demoApp(ctx, {
      themeMenu: true,
      onThemeChange: (theme, name) => panelRef.current?.adoptTheme(theme, name, 'menu'),
      keymap: createKeymap({
        'alt+t': CMD_SWITCH,
        'alt+r': CMD_ROLES,
        'alt+c': CMD_CONTRAST,
      }),
    });
    const panel = new ThemeRoleStatesPanel((theme) => app.setTheme(theme));
    panelRef.current = panel;
    app.onCommand(CMD_SWITCH, () => panel.switchTheme('keyboard'));
    app.onCommand(CMD_ROLES, () => panel.checkRoles('keyboard'));
    app.onCommand(CMD_CONTRAST, () => panel.auditContrast('keyboard'));

    const switchTheme = new Button('Switch ~t~heme', { onClick: () => panel.switchTheme('mouse') });
    const checkRoles = new Button('Check ~r~oles', { onClick: () => panel.checkRoles('mouse') });
    const auditContrast = new Button('Audit ~c~ontrast', { onClick: () => panel.auditContrast('mouse') });
    const content = new Group();
    content.add(at(panel, 0, 0, 56, 7));
    content.add(at(switchTheme, 0, 8, 16, 2));
    content.add(at(checkRoles, 17, 8, 15, 2));
    content.add(at(auditContrast, 33, 8, 18, 2));
    content.add(at(new Text('Alt+T switch · Alt+R roles · Alt+C contrast'), 0, 10, 56, 1));
    content.add(at(new Text('Tab reaches actions · mouse uses the same lesson state'), 0, 11, 56, 1));

    const dialog = new Template1Dialog({
      title: ' Semantic Roles & States ',
      width: 60,
      height: 16,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button || view === panel,
    });
    dialog.add(at(content, 1, 1, 56, 12));
    app.desktop.addWindow(dialog);
    app.loop.focusView(switchTheme);
    return app;
  },
});
