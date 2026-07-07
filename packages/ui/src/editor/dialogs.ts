/**
 * The decoded editor dialog builders + the PA-7 message boxes (RD-08 03-03).
 *
 * Decode (`examples/tvedit/tvedit2.cpp:55-112`, re-verified 2026-07-07 @ 57b6f56 — PF-009 path):
 *   • Find — `TDialog(0,0,38,12)` "Find", centered: input maxLen 80 at `TRect(3,3,32,4)` +
 *     `~T~ext to find` label `(2,2,15,3)` + history `(32,3,35,4)`; CheckBoxes `(3,5,35,7)`
 *     [~C~ase sensitive, ~W~hole words only]; OK `(14,9,24,11)` default, Cancel `(26,9,36,11)`.
 *   • Replace — `TDialog(0,0,40,16)` "Replace": inputs `(3,3,34,4)`/`(3,6,34,7)` + labels
 *     `~T~ext to find` `(2,2,15,3)` / `~N~ew text` `(2,5,12,6)` + histories `(34,…,37,…)`;
 *     CheckBoxes `(3,8,37,12)` [+ ~P~rompt on replace, ~R~eplace all]; OK `(17,13,27,15)`,
 *     Cancel `(28,13,38,15)`.
 *   • Replace prompt (`tvedit3.cpp:177-189`, PA-11): the 40×7 box `TRect(0,1,40,8)` h-centred at
 *     the top; when the cursor's GLOBAL y ≤ the box's global bottom + 1 (`:184-186`, PF-009) it
 *     moves so its top = `size.y − height − 2`; message "Replace this occurence?" (TV's literal,
 *     typo and all) with Yes/No/Cancel.
 * TV rects are end-exclusive → `{x:a, y:b, width:c−a, height:d−b}`, placed VERBATIM as absolute
 * dialog-relative children over `padding: 0` (the files-package double-inset fix convention).
 * `confirmBox`/`infoBox` are the PA-7 minimal helpers (NOT a `TMsgBox` cell decode — a contained
 * extension, the files `errorBox` precedent). `wireEditorDialogs` is the `doEditDialog` analogue
 * (`examples/tvedit/tvedit3.cpp:106-193`) with the faithful message strings.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { signal } from '../reactive/index.js';
import type { View, Point } from '../view/index.js';
import type { EventLoop } from '../event/index.js';
import type { Desktop } from '../desktop/index.js';
import { Dialog, okButton, cancelButton, yesButton, noButton } from '../dialog/index.js';
import { Input, CheckGroup, Label, Text } from '../controls/index.js';
import { History } from '../dropdown/index.js';
import type { Rect } from '../layout/index.js';
import type {
  EditorDialogHandler,
  EditorDialogRequest,
  EditorDialogResult,
  FindRec,
  ReplaceRec,
} from './editor-dialog.js';

/**
 * The ui-local `execView`-capable host (plan-preflight PF-002 — files' `ExecHost` is NOT
 * importable from ui; do not re-alias it there). The `createApplication()` handle satisfies both
 * structurally; `desktop.bounds` supplies the extent `replacePrompt`'s PA-11 rect math needs.
 */
export interface EditorDialogHost {
  /** The loop's modal seam (`execView` resolves to the terminating command). */
  loop: Pick<EventLoop, 'execView'>;
  /** The desktop the modal mounts into (add → execView → remove) + its extent. */
  desktop: Pick<Desktop, 'addWindow' | 'removeWindow' | 'bounds'>;
}

/** TV end-exclusive `TRect(a,b,c,d)` → a layout rect. */
function tv(a: number, b: number, c: number, d: number): Rect {
  return { x: a, y: b, width: c - a, height: d - b };
}

/** Place `view` at an absolute TV rect inside a `padding:0` dialog. */
function at<T extends View>(view: T, rect: Rect): T {
  view.layout = { ...view.layout, position: 'absolute', rect };
  return view;
}

/** The add → execView → remove lifecycle; resolves to the terminating command. */
async function runDialog(host: EditorDialogHost, dlg: Dialog): Promise<string> {
  host.desktop.addWindow(dlg);
  try {
    return await host.loop.execView<string>(dlg as unknown as View);
  } finally {
    host.desktop.removeWindow(dlg);
  }
}

/** Open the decoded 38×12 Find dialog; resolves the record, or `null` on cancel (AC-9). */
export async function findDialog(host: EditorDialogHost, initial?: FindRec): Promise<FindRec | null> {
  const dlg = new Dialog({ title: 'Find', width: 38, height: 12, centered: true });
  dlg.layout = { ...dlg.layout, padding: 0 }; // TV rects are dialog-relative (files convention)
  const find = signal(initial?.find ?? '');
  const flags = signal([initial?.options.caseSensitive ?? false, initial?.options.wholeWords ?? false]);

  const input = at(new Input({ value: find, maxLength: 80 }), tv(3, 3, 32, 4));
  dlg.add(input);
  dlg.add(at(new Label('~T~ext to find', input), tv(2, 2, 15, 3)));
  dlg.add(at(new History({ link: input }), tv(32, 3, 35, 4)));
  dlg.add(at(new CheckGroup(['~C~ase sensitive', '~W~hole words only'], flags), tv(3, 5, 35, 7)));
  dlg.add(at(okButton(), tv(14, 9, 24, 11)));
  dlg.add(at(cancelButton(), tv(26, 9, 36, 11)));

  const result = await runDialog(host, dlg);
  if (result !== 'ok') return null;
  const [caseSensitive, wholeWords] = flags();
  return { find: find(), options: { caseSensitive, wholeWords } };
}

/** Open the decoded 40×16 Replace dialog; resolves the record, or `null` on cancel (AC-9). */
export async function replaceDialog(host: EditorDialogHost, initial?: ReplaceRec): Promise<ReplaceRec | null> {
  const dlg = new Dialog({ title: 'Replace', width: 40, height: 16, centered: true });
  dlg.layout = { ...dlg.layout, padding: 0 };
  const find = signal(initial?.find ?? '');
  const replace = signal(initial?.replace ?? '');
  const flags = signal([
    initial?.options.caseSensitive ?? false,
    initial?.options.wholeWords ?? false,
    initial?.promptOnReplace ?? true,
    initial?.replaceAll ?? false,
  ]);

  const findInput = at(new Input({ value: find, maxLength: 80 }), tv(3, 3, 34, 4));
  dlg.add(findInput);
  dlg.add(at(new Label('~T~ext to find', findInput), tv(2, 2, 15, 3)));
  dlg.add(at(new History({ link: findInput }), tv(34, 3, 37, 4)));
  const newInput = at(new Input({ value: replace, maxLength: 80 }), tv(3, 6, 34, 7));
  dlg.add(newInput);
  dlg.add(at(new Label('~N~ew text', newInput), tv(2, 5, 12, 6)));
  dlg.add(at(new History({ link: newInput }), tv(34, 6, 37, 7)));
  dlg.add(
    at(
      new CheckGroup(['~C~ase sensitive', '~W~hole words only', '~P~rompt on replace', '~R~eplace all'], flags),
      tv(3, 8, 37, 12),
    ),
  );
  dlg.add(at(okButton(), tv(17, 13, 27, 15)));
  dlg.add(at(cancelButton(), tv(28, 13, 38, 15)));

  const result = await runDialog(host, dlg);
  if (result !== 'ok') return null;
  const [caseSensitive, wholeWords, promptOnReplace, replaceAll] = flags();
  return { find: find(), replace: replace(), options: { caseSensitive, wholeWords }, promptOnReplace, replaceAll };
}

/** A Yes/No/Cancel confirm box (PA-7 — a minimal helper, not a `TMsgBox` decode). */
export async function confirmBox(host: EditorDialogHost, message: string): Promise<'yes' | 'no' | 'cancel'> {
  const width = Math.min(60, Math.max(40, message.length + 6));
  const dlg = new Dialog({ width, height: 9, centered: true });
  dlg.layout = { ...dlg.layout, padding: 0 };
  dlg.add(at(new Text(message), { x: 3, y: 2, width: width - 6, height: 2 }));
  dlg.add(at(yesButton(), { x: 3, y: 6, width: 10, height: 2 }));
  dlg.add(at(noButton(), { x: 15, y: 6, width: 10, height: 2 }));
  dlg.add(at(cancelButton(), { x: 27, y: 6, width: 10, height: 2 }));
  const result = await runDialog(host, dlg);
  return result === 'yes' || result === 'no' ? result : 'cancel';
}

/** An OK message box (PA-7 — the files `errorBox` shape). */
export async function infoBox(host: EditorDialogHost, message: string): Promise<void> {
  const width = Math.min(60, Math.max(24, message.length + 6));
  const dlg = new Dialog({ width, height: 7, centered: true });
  dlg.layout = { ...dlg.layout, padding: 0 };
  dlg.add(at(new Text(message), { x: 3, y: 2, width: width - 6, height: 1 }));
  dlg.add(at(okButton(), { x: Math.max(2, Math.trunc((width - 10) / 2)), y: 4, width: 10, height: 2 }));
  await runDialog(host, dlg);
}

/**
 * The decoded replace prompt (PA-11, `tvedit3.cpp:177-189`): the 40×7 box h-centred at row 1;
 * moved so its top = `size.y − height − 2` when the GLOBAL cursor y ≤ the box's global bottom + 1.
 */
export async function replacePrompt(host: EditorDialogHost, cursor: Point): Promise<'yes' | 'no' | 'cancel'> {
  const desk = host.desktop.bounds;
  const x = Math.trunc((desk.width - 40) / 2);
  let y = 1;
  if (cursor.y <= desk.y + 8 + 1) y = desk.height - 7 - 2; // the avoid-cursor drop (PF-009 trigger)
  const dlg = new Dialog({ rect: { x, y, width: 40, height: 7 } }); // explicit rect — never centered
  dlg.layout = { ...dlg.layout, padding: 0 };
  dlg.add(at(new Text('Replace this occurence?'), { x: 3, y: 2, width: 34, height: 1 })); // TV's literal
  dlg.add(at(yesButton(), { x: 3, y: 4, width: 10, height: 2 }));
  dlg.add(at(noButton(), { x: 15, y: 4, width: 10, height: 2 }));
  dlg.add(at(cancelButton(), { x: 27, y: 4, width: 10, height: 2 }));
  const result = await runDialog(host, dlg);
  return result === 'yes' || result === 'no' ? result : 'cancel';
}

/**
 * The full default handler — the tvedit `doEditDialog` analogue (`tvedit3.cpp:106-193`) with the
 * faithful message strings; `saveAs` is the app hook (the RD-09 `FileDialog` in the clone).
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
        await infoBox(host, 'Search string not found.');
        return { kind: 'ok' };
      case 'saveModify':
        return { kind: 'confirm', answer: await confirmBox(host, `${req.name} has been modified. Save?`) };
      case 'saveUntitled':
        return { kind: 'confirm', answer: await confirmBox(host, 'Save untitled file?') };
      case 'saveAs':
        return { kind: 'path', path: (await opts?.saveAs?.(req.name)) ?? null };
      case 'readError':
        await infoBox(host, `Error reading file ${req.name ?? ''}.`);
        return { kind: 'ok' };
      case 'writeError':
        await infoBox(host, `Error writing file ${req.name ?? ''}.`);
        return { kind: 'ok' };
      case 'createError':
        await infoBox(host, `Error creating file ${req.name ?? ''}.`);
        return { kind: 'ok' };
      default:
        await infoBox(host, 'Not enough memory for this operation.');
        return { kind: 'ok' };
    }
  };
}
