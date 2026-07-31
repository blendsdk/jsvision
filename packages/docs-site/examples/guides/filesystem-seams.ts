/** Host-neutral scan, read, write, authorization, denial, and missing-file laboratory. */
import { Button, Group, Text, at, createKeymap } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { FileSystemSeamPanel } from '../../src/example-fixtures/files-and-filesystem/file-system-seam-panel.js';
import { Template1Dialog } from '../../src/template1-dialog.js';

const CMD_SCAN = 'guide.filesystem-seams.scan';
const CMD_READ = 'guide.filesystem-seams.read';
const CMD_WRITE = 'guide.filesystem-seams.write';
const CMD_ADAPTER = 'guide.filesystem-seams.adapter';
const CMD_DENY = 'guide.filesystem-seams.deny';
const CMD_MISSING = 'guide.filesystem-seams.missing';

export default defineExample({
  title: 'FileSystem Seams Laboratory',
  blurb:
    'Run the same workflow over browser-virtual and application-defined adapters, then distinguish authorization denial from a missing file.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({
        'alt+s': CMD_SCAN,
        'alt+r': CMD_READ,
        'alt+w': CMD_WRITE,
        'alt+a': CMD_ADAPTER,
        'alt+d': CMD_DENY,
        'alt+m': CMD_MISSING,
      }),
    });
    const panel = new FileSystemSeamPanel();
    app.onCommand(CMD_SCAN, () => panel.scan('keyboard'));
    app.onCommand(CMD_READ, () => panel.read('keyboard'));
    app.onCommand(CMD_WRITE, () => panel.write('keyboard'));
    app.onCommand(CMD_ADAPTER, () => panel.useApplicationAdapter('keyboard'));
    app.onCommand(CMD_DENY, () => panel.armDenial('keyboard'));
    app.onCommand(CMD_MISSING, () => panel.readMissing('keyboard'));

    const scan = new Button('~S~can', { onClick: () => panel.scan('mouse') });
    const read = new Button('~R~ead', { onClick: () => panel.read('mouse') });
    const write = new Button('~W~rite', { onClick: () => panel.write('mouse') });
    const adapter = new Button('~A~pp adapter', {
      onClick: () => panel.useApplicationAdapter('mouse'),
    });
    const deny = new Button('~D~eny next', { onClick: () => panel.armDenial('mouse') });
    const missing = new Button('~M~issing', { onClick: () => panel.readMissing('mouse') });
    const content = new Group();
    content.add(at(panel, 0, 0, 60, 11));
    content.add(at(scan, 0, 11, 9, 2));
    content.add(at(read, 10, 11, 9, 2));
    content.add(at(write, 20, 11, 9, 2));
    content.add(at(adapter, 30, 11, 14, 2));
    content.add(at(deny, 45, 11, 13, 2));
    content.add(at(missing, 0, 13, 11, 2));
    content.add(at(new Text('Alt+S scan · Alt+R read · Alt+W write · Alt+A adapter'), 11, 13, 49, 1));
    content.add(at(new Text('Alt+D deny · Alt+M missing · Tab buttons · mouse click'), 11, 14, 49, 1));
    content.add(at(new Text('ASCII-safe text status remains usable in monochrome.'), 0, 15, 60, 1));

    const dialog = new Template1Dialog({
      title: ' FileSystem Seams Laboratory ',
      width: 64,
      height: 20,
      preserveChildHeights: (view) => view instanceof Text || view instanceof Button || view === panel,
    });
    dialog.add(at(content, 1, 1, 60, 16));
    app.desktop.addWindow(dialog);
    app.loop.focusView(scan);
    return app;
  },
});
