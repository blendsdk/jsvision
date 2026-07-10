/**
 * A modal form dialog: a text input (age, 0–120), a checkbox group, and a radio
 * group, with OK / Cancel. OK is vetoed while the age is out of range — the
 * valid() gate refuses to close and returns focus to the offending field; Cancel,
 * Esc, or [×] always close. The dialog opens on start; once you close it, the
 * "Open the dialog" button on the stage window reopens a fresh one (its fields
 * reset each time), so the demo is never a dead end.
 */
import {
  Dialog,
  Input,
  Label,
  CheckGroup,
  RadioGroup,
  okButton,
  cancelButton,
  Button,
  Text,
  Window,
  signal,
  range,
  View,
} from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
// #region example

/** Absolutely place a view within its parent's interior. */
function at<V extends View>(view: V, x: number, y: number, width: number, height: number): V {
  view.layout = { position: 'absolute', rect: { x, y, width, height } };
  return view;
}

export default defineExample({
  title: 'Form dialog',
  blurb: 'A modal form — input + checks + radios with OK/Cancel; OK is vetoed while Age is out of range.',
  build: (ctx) => {
    const app = demoApp(ctx);

    // Build and open a FRESH dialog each time, so its fields reset on every open and we never
    // re-add a disposed view. The dialog removes itself from the desktop once it resolves, handing
    // focus back to the stage window's button.
    const openTheDialog = (): void => {
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

      app.desktop.addWindow(dlg);
      void app.loop.execView(dlg).finally(() => app.desktop.removeWindow(dlg));
    };
    app.onCommand('demo.openDialog', () => openTheDialog());

    // A non-closable stage window with the reopen affordance, centered on the desktop.
    const stage = new Window('Form dialog');
    stage.closable = false;
    const sw = 46;
    const sh = 7;
    const { width: dw, height: dh } = app.desktop.bounds;
    stage.layout.rect = {
      x: Math.max(0, Math.floor((dw - sw) / 2)),
      y: Math.max(0, Math.floor((dh - sh) / 2)),
      width: sw,
      height: sh,
    };
    stage.add(at(new Button('~O~pen the dialog', { command: 'demo.openDialog', default: true }), 12, 0, 20, 2));
    stage.add(at(new Text('Close the dialog (OK / Cancel / Esc), then reopen it here.'), 0, 3, sw - 2, 2));
    app.desktop.addWindow(stage);

    openTheDialog(); // start with it open once
    return app;
  },
});
// #endregion example
