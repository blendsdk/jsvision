/**
 * The dialog composition for `demo:controls-live` — builds the grey Turbo Vision parameters
 * {@link Dialog} and places every RD-06 essential control inside it at TV-style coordinates, wiring
 * each to its bound signal. Kept separate from `main.ts` (lifecycle/menu/status) so the composition
 * is a pure, side-effect-free factory — importable by both the demo and a headless render harness.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Text, Label, Input, CheckGroup, RadioGroup, Button, filter, range, signal, type View } from '@jsvision/ui';
import { Dialog } from './dialog.js';

/** Demo-local command names (not built-in shell commands), shared by the dialog and the shell wiring. */
export const CMD_OK = 'dlg.ok';
export const CMD_CANCEL = 'dlg.cancel';
export const CMD_HELP = 'dlg.help';

/** Radio-group option labels, indexed by the bound `align` signal. */
const ALIGN_LABELS = ['Left', 'Center', 'Right'] as const;
/** Check-group option labels, indexed by the bound `styleFlags` signal. */
const STYLE_LABELS = ['Bold', 'Italic', 'Underline'] as const;

/** Turn `'Bold'` into `'~B~old'` — mark the first letter as the control's `Alt`-hotkey. */
function withHotkey(label: string): string {
  return `~${label[0]}~${label.slice(1)}`;
}

/** A control plus the content-box-relative rect it occupies inside the dialog (TV coordinate layout). */
interface Placed {
  readonly view: View;
  readonly rect: { x: number; y: number; width: number; height: number };
}

/** What {@link buildDialog} hands back to the shell wiring in `main.ts`. */
export interface BuiltDialog {
  /** The composed dialog window, ready to add to the desktop. */
  readonly dialog: Dialog;
  /** The first input — focus it on open so the dialog starts on the Name field. */
  readonly firstInput: Input;
  /** Toggle the reactive hint header (wired to F1 / the Help button / the menu). */
  readonly toggleHelp: () => void;
}

/**
 * Build the grey parameters dialog and all its controls, wiring their bound signals.
 *
 * @returns The dialog plus the first input (to focus on open) and the F1/Help hint toggle.
 */
export function buildDialog(): BuiltDialog {
  // Bound state — the single source of truth each control reads/writes (two-way signals).
  const name = signal('');
  const age = signal('');
  const styleFlags = signal([false, false, false]);
  const align = signal(0);
  const showHelp = signal(false);

  // Inputs with live validators, and the labels linked to them (Alt-N / Alt-A jump focus).
  const nameInput = new Input({ value: name, validator: filter('A-Za-z ') });
  const ageInput = new Input({ value: age, validator: range(0, 150) });
  const nameLabel = new Label('~N~ame', nameInput);
  const ageLabel = new Label('~A~ge', ageInput);

  // Clusters bound to their signals.
  const check = new CheckGroup({ labels: STYLE_LABELS.map(withHotkey), value: styleFlags });
  const radio = new RadioGroup({ labels: ALIGN_LABELS.map(withHotkey), value: align });

  // Buttons — every face state on screen at once (default / normal / normal / disabled).
  const ok = new Button('~O~K', { command: CMD_OK, default: true });
  const cancel = new Button('~C~ancel', { command: CMD_CANCEL });
  const help = new Button('~H~elp', { command: CMD_HELP });
  const save = new Button('~S~ave', { disabled: true });

  // A reactive header (F1 toggles it), a word-wrapped paragraph, and a live echo of the bound state.
  const header = new Text(() =>
    showHelp()
      ? 'Tab / Shift-Tab move · Alt-N / Alt-A jump · Space toggles · Enter = OK · Alt-X quit'
      : 'Essential controls — a live visual audit   (F1: toggle hints)',
  );
  const paragraph = new Text(
    'This paragraph is a TStaticText: it word-wraps greedily to the field width and hard-breaks ' +
      'over-long words, faithful to Turbo Vision. Resize your terminal to see it re-flow.',
  );
  const echo = new Text(() => {
    const styles = STYLE_LABELS.filter((_, i) => styleFlags()[i] === true);
    const styleText = styles.length > 0 ? styles.join('+') : 'none';
    return `Name="${name()}"  Age="${age()}"  Style=${styleText}  Align=${ALIGN_LABELS[align()]}`;
  });

  // TV coordinate layout — content-box-relative rects (inside the dialog's 1-cell border).
  const placed: readonly Placed[] = [
    { view: header, rect: { x: 1, y: 0, width: 54, height: 2 } },
    { view: nameLabel, rect: { x: 1, y: 2, width: 6, height: 1 } },
    { view: nameInput, rect: { x: 8, y: 2, width: 24, height: 1 } },
    { view: ageLabel, rect: { x: 34, y: 2, width: 5, height: 1 } },
    { view: ageInput, rect: { x: 40, y: 2, width: 12, height: 1 } },
    { view: new Text('Style:'), rect: { x: 1, y: 4, width: 10, height: 1 } },
    { view: check, rect: { x: 1, y: 5, width: 18, height: 3 } },
    { view: new Text('Align:'), rect: { x: 24, y: 4, width: 10, height: 1 } },
    { view: radio, rect: { x: 24, y: 5, width: 18, height: 3 } },
    { view: paragraph, rect: { x: 1, y: 9, width: 54, height: 3 } },
    { view: echo, rect: { x: 1, y: 12, width: 54, height: 1 } },
    { view: ok, rect: { x: 1, y: 14, width: 12, height: 2 } },
    { view: cancel, rect: { x: 14, y: 14, width: 12, height: 2 } },
    { view: help, rect: { x: 27, y: 14, width: 10, height: 2 } },
    { view: save, rect: { x: 38, y: 14, width: 12, height: 2 } },
  ];

  const dialog = new Dialog('Set Parameters');
  for (const { view, rect } of placed) {
    view.setLayout({ position: 'absolute', rect });
    dialog.add(view);
  }

  return { dialog, firstInput: nameInput, toggleHelp: () => showHelp.set(!showHelp.peek()) };
}
