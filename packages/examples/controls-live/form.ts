/**
 * The dialog composition for `demo:controls-live` — builds the grey Turbo Vision parameters
 * {@link Dialog} and places every RD-06 essential control inside it at TV-style coordinates, wiring
 * each to its bound signal. Kept separate from `main.ts` (lifecycle/menu/status) so the composition
 * is a pure, side-effect-free factory — importable by both the demo and a headless render harness.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import {
  Text,
  Label,
  Input,
  CheckGroup,
  RadioGroup,
  Button,
  filter,
  range,
  signal,
  col,
  row,
  grow,
  fixed,
  spacer,
} from '@jsvision/ui';
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

  // Flex composition: the dialog body is a column of rows, so the form re-solves with the dialog
  // instead of pinning every child to a hand-computed cell. Each child carries an explicit main-axis
  // size because none of Label/Input/CheckGroup/RadioGroup/Button measures itself — an `auto` child
  // would collapse to nothing. Fixed spacers stand in for the blank rows the old rect table left.
  const body = col(
    { padding: { left: 1, right: 1, top: 0, bottom: 0 } },
    fixed(header, 2),
    fixed(
      row(
        fixed(nameLabel, 6),
        spacer({ fixed: 1 }),
        fixed(nameInput, 24),
        spacer({ fixed: 2 }),
        fixed(ageLabel, 5),
        spacer({ fixed: 1 }),
        fixed(ageInput, 12),
      ),
      1,
    ),
    spacer({ fixed: 1 }),
    fixed(row(fixed(new Text('Style:'), 10), spacer({ fixed: 13 }), fixed(new Text('Align:'), 10)), 1),
    fixed(row(fixed(check, 18), spacer({ fixed: 5 }), fixed(radio, 18)), 3),
    spacer({ fixed: 1 }),
    fixed(paragraph, 3),
    fixed(echo, 1),
    spacer({ fixed: 1 }),
    fixed(row({ gap: 1 }, fixed(ok, 12), fixed(cancel, 12), fixed(help, 10), fixed(save, 12)), 2),
  );

  const dialog = new Dialog('Set Parameters');
  dialog.setLayout({ direction: 'col' });
  dialog.add(grow(body));

  return { dialog, firstInput: nameInput, toggleHelp: () => showHelp.set(!showHelp.peek()) };
}
