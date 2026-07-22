/**
 * The classic Turbo Vision calculator: a grey dialog holding a white-on-blue display and a 4×5 grid
 * of keys. Click a key, or just type — digits, `. + - * / = %`, Backspace, and `C` all work, and
 * `±` toggles the sign. It is an immediate-execution calculator (each operator settles the previous
 * one), reproducing the original's behaviour key for key.
 *
 * Built as a real desktop app: a `Dialog` on the desktop (so it wears the grey dialog palette, not a
 * window's blue), the display as a small custom `View`, and one `Button` per key. Keyboard input is
 * bound app-wide through `demoApp`'s `keymap`, mirroring how the original's display consumed keys.
 */
import { Dialog, Button, at } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';
import { CalcEngine, CalcDisplay } from '../../src/apps/calculator/calc.js';

/**
 * Dialog size and interior layout. The original is 24 wide; jsvision's dialog reserves more title
 * decoration, so it is two cells wider so "Calculator" shows in full, with the 4×5 key grid centred.
 */
const W = 26;
const H = 15;
/** Left inset that centres the 20-cell key grid in the interior. */
const BASE_X = 3;

/** The 20 key faces, in grid order: `←` is Backspace, `±` toggles the sign. */
const KEYS = ['C', '←', '%', '±', '7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '=', '+'];

export default defineExample({
  title: 'Calculator',
  blurb: 'The classic Turbo Vision calculator — a grey dialog with a white-on-blue display; click the keys or type.',
  build: (ctx) => {
    const calc = new CalcEngine();
    const app = demoApp(ctx);

    const dialog = new Dialog({ title: 'Calculator', width: W, height: H });
    dialog.closable = false; // no close button (frees the title) and no closing to an empty desktop
    // The display sits over the key grid on the second row; it is the selectable view, so it takes
    // focus and consumes typed digits/operators, exactly as the original's display does.
    dialog.add(at(new CalcDisplay(calc), BASE_X, 1, 20, 1));

    // 4 columns × 5 rows of 5×2 keys. The keys are not tab-focusable (you drive the calculator by
    // typing or clicking), matching the original, and so Enter never doubles as "activate a button".
    KEYS.forEach((label, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const button = new Button(label, { onClick: () => calc.key(label) });
      button.focusable = false;
      dialog.add(at(button, col * 5 + BASE_X, row * 2 + 3, 5, 2));
    });

    app.desktop.addWindow(dialog);
    return app;
  },
});
