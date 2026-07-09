/**
 * A modal form dialog: a text input (age, 0–120), a checkbox group, and a radio
 * group, with OK / Cancel. OK is vetoed while the age is out of range — the
 * valid() gate refuses to close and returns focus to the offending field; Cancel,
 * Esc, or [×] always close. The dialog opens on start, because a bare-placed
 * dialog would not be modal (no focus trap, no valid() close-gate).
 */
import {
  Dialog,
  Input,
  Label,
  CheckGroup,
  RadioGroup,
  okButton,
  cancelButton,
  signal,
  range,
  View,
} from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

/** Absolutely place a view within the dialog. */
function at<V extends View>(view: V, x: number, y: number, width: number, height: number): V {
  view.layout = { position: 'absolute', rect: { x, y, width, height } };
  return view;
}

export default defineExample({
  title: 'Form dialog',
  blurb: 'A modal form — input + checks + radios with OK/Cancel; OK is vetoed while Age is out of range.',
  build: (ctx) => {
    const app = demoApp(ctx, 'full');
    const age = signal('30');
    const styles = signal([true, false]);
    const size = signal(1);

    // A size with no explicit rect auto-centers the dialog and casts its drop-shadow.
    const dlg = new Dialog({ title: ' Person ', width: 44, height: 13 });
    const ageInput = new Input({ value: age, validator: range(0, 120) });
    dlg.add(at(new Label('~A~ge (0–120)', ageInput), 2, 2, 14, 1));
    dlg.add(at(ageInput, 17, 2, 22, 1));
    dlg.add(at(new CheckGroup({ labels: ['~B~old', '~I~talic'], value: styles }), 2, 4, 18, 2));
    dlg.add(at(new RadioGroup({ labels: ['~S~mall', '~M~edium', '~L~arge'], value: size }), 23, 4, 16, 3));
    dlg.add(at(okButton(), 9, 9, 10, 2));
    dlg.add(at(cancelButton(), 22, 9, 12, 2));

    // Open the dialog on start; execView requires it to be added to the tree first.
    app.desktop.addWindow(dlg);
    void app.loop.execView(dlg);
    return app;
  },
});
