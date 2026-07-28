/**
 * Ready-made dialogs and message boxes for an editor: Find, Replace, a Yes/No/Cancel confirm box,
 * an OK info box, and the replace-confirmation prompt. {@link wireEditorDialogs} bundles them into a
 * single handler you can hand to an `Editor` so its find/replace/save prompts just work.
 *
 * Each builder mounts a modal dialog on the desktop, awaits the user's answer, and cleans it up. You
 * usually don't call the individual builders — pass the result of {@link wireEditorDialogs} as the
 * editor's `editorDialog` option and it drives them for you.
 */
import { signal } from '../reactive/index.js';
import type { Point, Group } from '../view/index.js';
import { col, row, grow, fixed, cover, spacer } from '../view/index.js';
import { Dialog, okButton, cancelButton, yesButton, noButton } from '../dialog/index.js';
import {
  runDialog,
  messageBox,
  buttonBandFor,
  frameworkDialogGeometry,
  DIALOG_BODY_PADDING,
} from '../dialog/message-box.js';
import { uiAcceleratorLabel } from '../i18n/label.js';
import type { ModalDialogHost } from '../dialog/message-box.js';
import { Input, CheckGroup, Label, Text } from '../controls/index.js';
import { stringWidth } from '../controls/measure.js';
import { frameTitleMinimumWidth } from '../window/index.js';
import { History } from '../dropdown/index.js';
import type {
  EditorDialogHandler,
  EditorDialogRequest,
  EditorDialogResult,
  FindRec,
  ReplaceRec,
} from './editor-dialog.js';

/**
 * What the dialog builders need from the host to run a localized modal. An object from
 * `createApplication()` satisfies it directly.
 */
export type EditorDialogHost = ModalDialogHost;

/** Width of the history drop-down button that sits beside a field. */
const HISTORY_WIDTH = 3;

/**
 * One entry row: the field takes whatever width the history drop-down beside it leaves. Both are given
 * explicit sizes because neither reports a natural one — left to size themselves they would collapse to
 * nothing and be clipped away.
 */
function fieldRow(field: Input): Group {
  return row(grow(field), fixed(new History({ link: field }), HISTORY_WIDTH));
}

/**
 * Open the Find dialog — a text field with "Case sensitive" and "Whole words only" checkboxes.
 *
 * @param host The modal host, including its translation service.
 * @param initial Optional values to pre-fill the field and checkboxes.
 * @returns The entered search record, or `null` if the user cancels.
 * @example
 * import { createApplication, findDialog } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities().profile;
 * const app = createApplication({ caps });
 *
 * const rec = await findDialog(app, {
 *   find: 'fox',
 *   options: { caseSensitive: false, wholeWords: false },
 * });
 * if (rec !== null) console.log('search for', rec.find);
 */
export async function findDialog(host: EditorDialogHost, initial?: FindRec): Promise<FindRec | null> {
  const title = host.i18n.t('ui.editor.find.title', { defaultMessage: 'Find' });
  const find = signal(initial?.find ?? '');
  const flags = signal([initial?.options.caseSensitive ?? false, initial?.options.wholeWords ?? false]);

  const input = new Input({ value: find, maxLength: 80 });
  const labels = [
    uiAcceleratorLabel(host.i18n, 'ui.editor.case-sensitive', 'Case ~s~ensitive'),
    uiAcceleratorLabel(host.i18n, 'ui.editor.whole-words', '~W~hole words only'),
  ];
  const fieldLabel = uiAcceleratorLabel(host.i18n, 'ui.editor.find.label', '~T~ext to find');
  const buttons = [okButton(host.i18n), cancelButton(host.i18n)];
  const geometry = frameworkDialogGeometry(
    host,
    { width: 38, height: 12 },
    [frameTitleMinimumWidth(title) - 6, stringWidth(fieldLabel), ...labels.map(stringWidth)],
    buttons,
  );
  const dlg = new Dialog({
    title,
    width: geometry.width,
    height: geometry.height,
    centered: true,
  });
  // Every control takes exactly the rows it needs; the spacer absorbs the leftover height, which pins
  // the button band to the bottom row.
  dlg.add(
    cover(
      col(
        { padding: DIALOG_BODY_PADDING },
        fixed(new Label(fieldLabel, input), 1),
        fixed(fieldRow(input), 1),
        spacer({ fixed: 1 }),
        fixed(new CheckGroup({ labels, value: flags }), labels.length),
        spacer(),
        buttonBandFor(buttons, geometry.buttonColumns),
      ),
    ),
  );

  const result = await runDialog(host, dlg);
  if (result !== 'ok') return null;
  const [caseSensitive, wholeWords] = flags();
  return { find: find(), options: { caseSensitive, wholeWords } };
}

/**
 * Open the Replace dialog — find + replace fields plus "Case sensitive", "Whole words only",
 * "Prompt on replace", and "Replace all" checkboxes.
 *
 * @param host The modal host, including its translation service.
 * @param initial Optional values to pre-fill the fields and checkboxes.
 * @returns The entered replace record, or `null` if the user cancels.
 * @example
 * import { createApplication, replaceDialog } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities().profile;
 * const app = createApplication({ caps });
 *
 * const rec = await replaceDialog(app, {
 *     find: 'fox',
 *     replace: 'cat',
 *     options: { caseSensitive: false, wholeWords: false },
 *     promptOnReplace: true,
 *     replaceAll: false,
 * });
 */
export async function replaceDialog(host: EditorDialogHost, initial?: ReplaceRec): Promise<ReplaceRec | null> {
  const title = host.i18n.t('ui.editor.replace.title', { defaultMessage: 'Replace' });
  const find = signal(initial?.find ?? '');
  const replace = signal(initial?.replace ?? '');
  const flags = signal([
    initial?.options.caseSensitive ?? false,
    initial?.options.wholeWords ?? false,
    initial?.promptOnReplace ?? true,
    initial?.replaceAll ?? false,
  ]);

  const findInput = new Input({ value: find, maxLength: 80 });
  const newInput = new Input({ value: replace, maxLength: 80 });
  const labels = [
    uiAcceleratorLabel(host.i18n, 'ui.editor.case-sensitive', 'Case ~s~ensitive'),
    uiAcceleratorLabel(host.i18n, 'ui.editor.whole-words', '~W~hole words only'),
    uiAcceleratorLabel(host.i18n, 'ui.editor.prompt-on-replace', '~P~rompt on replace'),
    uiAcceleratorLabel(host.i18n, 'ui.editor.replace-all', '~R~eplace all'),
  ];
  const findLabel = uiAcceleratorLabel(host.i18n, 'ui.editor.find.label', '~T~ext to find');
  const replaceLabel = uiAcceleratorLabel(host.i18n, 'ui.editor.replace.label', '~N~ew text');
  const buttons = [okButton(host.i18n), cancelButton(host.i18n)];
  const geometry = frameworkDialogGeometry(
    host,
    { width: 40, height: 16 },
    [frameTitleMinimumWidth(title) - 6, stringWidth(findLabel), stringWidth(replaceLabel), ...labels.map(stringWidth)],
    buttons,
  );
  const dlg = new Dialog({
    title,
    width: geometry.width,
    height: geometry.height,
    centered: true,
  });
  // Every control takes exactly the rows it needs; the spacer absorbs the leftover height, which pins
  // the button band to the bottom row.
  dlg.add(
    cover(
      col(
        { padding: DIALOG_BODY_PADDING },
        fixed(new Label(findLabel, findInput), 1),
        fixed(fieldRow(findInput), 1),
        spacer({ fixed: 1 }),
        fixed(new Label(replaceLabel, newInput), 1),
        fixed(fieldRow(newInput), 1),
        spacer({ fixed: 1 }),
        fixed(new CheckGroup({ labels, value: flags }), labels.length),
        spacer(),
        buttonBandFor(buttons, geometry.buttonColumns),
      ),
    ),
  );

  const result = await runDialog(host, dlg);
  if (result !== 'ok') return null;
  const [caseSensitive, wholeWords, promptOnReplace, replaceAll] = flags();
  return { find: find(), replace: replace(), options: { caseSensitive, wholeWords }, promptOnReplace, replaceAll };
}

/**
 * Show a modal message with Yes / No / Cancel buttons.
 *
 * @param host The modal host, including its translation service.
 * @param message The message to display; the box sizes itself to fit.
 * @returns The button the user chose (`'cancel'` also covers closing the box).
 * @example
 * import { createApplication, confirmBox } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities().profile;
 * const app = createApplication({ caps });
 *
 * async function save(): Promise<void> {
 *   // Persist the buffer to disk.
 * }
 *
 * const answer = await confirmBox(app, 'The file has been modified. Save?');
 * if (answer === 'yes') await save();
 */
export async function confirmBox(host: EditorDialogHost, message: string): Promise<'yes' | 'no' | 'cancel'> {
  const buttons = [yesButton(host.i18n), noButton(host.i18n), cancelButton(host.i18n)];
  const geometry = frameworkDialogGeometry(host, { width: 40, height: 9 }, [stringWidth(message)], buttons);
  const dlg = new Dialog({ width: geometry.width, height: geometry.height, centered: true });
  dlg.add(
    cover(
      col({ padding: DIALOG_BODY_PADDING }, grow(new Text(message)), buttonBandFor(buttons, geometry.buttonColumns)),
    ),
  );
  const result = await runDialog(host, dlg);
  return result === 'yes' || result === 'no' ? result : 'cancel';
}

/**
 * Show a modal message with a single OK button.
 *
 * @param host The modal host, including its translation service.
 * @param message The message to display; the box sizes itself to fit.
 * @returns Resolves once the user dismisses the box.
 * @example
 * import { createApplication, infoBox } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities().profile;
 * const app = createApplication({ caps });
 *
 * await infoBox(app, 'Search string not found.');
 */
export async function infoBox(host: EditorDialogHost, message: string): Promise<void> {
  // Delegates to the general OK-only message box (same geometry, no title) — one modal engine.
  await messageBox(host, { title: '', text: message, buttons: 'ok' });
}

/**
 * Show the "replace this occurrence?" prompt (Yes / No / Cancel) used during an interactive
 * replace. The box sits near the top of the desktop, but drops to the bottom when the caret is high
 * enough that the box would otherwise cover it.
 *
 * @param host The modal host, including its translation service.
 * @param cursor The caret position in absolute (desktop) coordinates, used to avoid covering it.
 * @returns The button the user chose.
 * @example
 * import { createApplication, replacePrompt } from '@jsvision/ui';
 * import type { EditorDialogRequest } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities().profile;
 * const app = createApplication({ caps });
 *
 * // Inside an editorDialog handler for a 'replacePrompt' request:
 * const req: Extract<EditorDialogRequest, { kind: 'replacePrompt' }> = {
 *   kind: 'replacePrompt',
 *   cursor: { x: 10, y: 3 },
 * };
 * const answer = await replacePrompt(app, req.cursor);
 */
export async function replacePrompt(host: EditorDialogHost, cursor: Point): Promise<'yes' | 'no' | 'cancel'> {
  const desk = host.desktop.bounds;
  const message = host.i18n.t('ui.editor.replace-occurrence', {
    defaultMessage: 'Replace this occurence?',
  });
  const buttons = [yesButton(host.i18n), noButton(host.i18n), cancelButton(host.i18n)];
  const geometry = frameworkDialogGeometry(host, { width: 40, height: 7 }, [stringWidth(message)], buttons);
  const x = Math.max(0, Math.trunc((desk.width - geometry.width) / 2));
  let y = 1;
  if (cursor.y <= desk.y + geometry.height + 2) y = Math.max(0, desk.height - geometry.height - 2);
  const dlg = new Dialog({ rect: { x, y, width: geometry.width, height: geometry.height } });
  dlg.add(
    cover(
      col({ padding: DIALOG_BODY_PADDING }, grow(new Text(message)), buttonBandFor(buttons, geometry.buttonColumns)),
    ),
  );
  const result = await runDialog(host, dlg);
  return result === 'yes' || result === 'no' ? result : 'cancel';
}

/**
 * Build a complete `editorDialog` handler backed by the dialogs in this module — Find, Replace, the
 * replace prompt, "not found", the save-confirmation prompts, and file-error boxes. Pass the result
 * as an `Editor`'s `editorDialog` option to make its find/replace/save prompts work out of the box.
 *
 * @param host The modal host, including its translation service.
 * @param opts Optional hooks; provide `saveAs` to answer "save as" requests with a file path.
 * @returns A handler suitable for the editor's `editorDialog` option.
 * @example
 * import { createApplication, Editor, wireEditorDialogs } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities().profile;
 * const app = createApplication({ caps });
 * const editorDialog = wireEditorDialogs(app);
 * const editor = new Editor({ editorDialog });
 * await editor.find(); // now opens the real Find dialog
 */
export function wireEditorDialogs(
  host: EditorDialogHost,
  opts?: { saveAs?: (name: string) => Promise<string | null> },
): EditorDialogHandler {
  return async (req: EditorDialogRequest): Promise<EditorDialogResult> => {
    switch (req.kind) {
      case 'find':
        return { kind: 'find', rec: await findDialog(host, req.rec) };
      case 'replace':
        return { kind: 'replace', rec: await replaceDialog(host, req.rec) };
      case 'replacePrompt':
        return { kind: 'confirm', answer: await replacePrompt(host, req.cursor) };
      case 'searchFailed':
        await infoBox(
          host,
          host.i18n.t('ui.editor.search-not-found', {
            defaultMessage: 'Search string not found.',
          }),
        );
        return { kind: 'ok' };
      case 'saveModify':
        return {
          kind: 'confirm',
          answer: await confirmBox(
            host,
            host.i18n.t('ui.editor.save-modified', {
              defaultMessage: '${name} has been modified. Save?',
              params: { name: req.name },
            }),
          ),
        };
      case 'saveUntitled':
        return {
          kind: 'confirm',
          answer: await confirmBox(
            host,
            host.i18n.t('ui.editor.save-untitled', {
              defaultMessage: 'Save untitled file?',
            }),
          ),
        };
      case 'saveAs':
        return { kind: 'path', path: (await opts?.saveAs?.(req.name)) ?? null };
      case 'readError':
        await infoBox(
          host,
          host.i18n.t('ui.editor.read-error', {
            defaultMessage: 'Error reading file ${name}.',
            params: { name: req.name ?? '' },
          }),
        );
        return { kind: 'ok' };
      case 'writeError':
        await infoBox(
          host,
          host.i18n.t('ui.editor.write-error', {
            defaultMessage: 'Error writing file ${name}.',
            params: { name: req.name ?? '' },
          }),
        );
        return { kind: 'ok' };
      case 'createError':
        await infoBox(
          host,
          host.i18n.t('ui.editor.create-error', {
            defaultMessage: 'Error creating file ${name}.',
            params: { name: req.name ?? '' },
          }),
        );
        return { kind: 'ok' };
      default:
        await infoBox(
          host,
          host.i18n.t('ui.editor.out-of-memory', {
            defaultMessage: 'Not enough memory for this operation.',
          }),
        );
        return { kind: 'ok' };
    }
  };
}
