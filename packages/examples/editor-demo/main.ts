/**
 * Editor walkthrough (RD-08) — a narrated, headless console demo of `@jsvision/ui`'s `Editor`:
 * type → select (word / line via the PA-18 multi-click) → cut/paste through a shared clipboard
 * editor → undo/redo → find/replace through a scripted `editorDialog` seam → the `Indicator`
 * tracking `line:col` — one composed ASCII frame per step, rendered through a real
 * `EventLoop`/`RenderRoot` (no TTY).
 *
 * Run it:
 *
 *   yarn workspace @jsvision/examples demo:editor
 *
 * Dev-only example — not part of the published package. Imported by name (`@jsvision/ui`),
 * exactly as a consumer would. `.js` per NodeNext.
 */
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent } from '@jsvision/core';
import { Group, Editor, Indicator, createEventLoop } from '@jsvision/ui';
import type { EditorDialogRequest, EditorDialogResult } from '@jsvision/ui';

const WIDTH = 44;
const HEIGHT = 8;

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A scripted seam: answers find/replace with fixed records, accepts every prompt. */
const scriptedDialog = (req: EditorDialogRequest): Promise<EditorDialogResult> => {
  switch (req.kind) {
    case 'find':
      return Promise.resolve({
        kind: 'find',
        rec: { find: 'fox', options: { caseSensitive: false, wholeWords: false } },
      });
    case 'replace':
      return Promise.resolve({
        kind: 'replace',
        rec: {
          find: 'fox',
          replace: 'cat',
          options: { caseSensitive: false, wholeWords: false },
          promptOnReplace: false,
          replaceAll: true,
        },
      });
    default:
      return Promise.resolve({ kind: 'ok' });
  }
};

function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}

function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 };
}

async function main(): Promise<void> {
  const clipboard = new Editor();
  const ed = new Editor({
    clipboard,
    editorDialog: scriptedDialog,
    now: (() => {
      let t = 0;
      return () => (t += 100); // a deterministic clock: consecutive clicks land in the 500 ms window
    })(),
  });
  const ind = new Indicator();
  ed.attachGadgets(undefined, undefined, ind);

  const root = new Group();
  root.layout = { direction: 'col' };
  ed.layout = { size: { kind: 'fr', weight: 1 } };
  ind.layout = { size: { kind: 'fixed', cells: 1 } };
  root.add(ed);
  root.add(ind);
  const loop = createEventLoop({ width: WIDTH, height: HEIGHT }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  loop.focusView(ed);

  const frame = (title: string): void => {
    loop.renderRoot.flush();
    console.log(`\n${title}`);
    console.log(`+${'-'.repeat(WIDTH)}+`);
    const buf = loop.renderRoot.buffer();
    for (let y = 0; y < HEIGHT; y++) {
      let row = '';
      for (let x = 0; x < WIDTH; x++) row += buf.get(x, y)?.char ?? ' ';
      console.log(`|${row}|`);
    }
    console.log(`+${'-'.repeat(WIDTH)}+`);
  };

  console.log('RD-08 editor walkthrough — the TEditor port, headless.');

  ed.setText('The quick brown fox jumps.\nSecond line.');
  frame('1. Loaded — the Indicator shows 1:1');

  for (const ch of ' Typed!') loop.dispatch(key(ch));
  frame('2. Typed at the caret (watch the Indicator column)');

  loop.dispatch(mouse('down', 13, 0)); // double-click "quick" (shifted by the typed prefix)
  loop.dispatch(mouse('up', 13, 0));
  loop.dispatch(mouse('down', 13, 0));
  loop.dispatch(mouse('up', 13, 0));
  frame(`3. Double-click selects the word: "${ed.selectionText()}"`);

  loop.dispatch(key('delete', { shift: true })); // cut
  frame('4. Cut (Shift-Del) — the clipboard editor now holds it selected');
  console.log(`   clipboard: "${clipboard.selectionText()}"`);

  ed.execute('textEnd');
  loop.dispatch(key('insert', { shift: true })); // paste
  frame('5. Paste (Shift-Ins) at the end');

  ed.execute('undo');
  ed.execute('undo');
  frame('6. Undo ×2 (the AR-253 stack)');
  ed.execute('redo');
  frame('7. Redo (command-only — no WordStar chord is free)');

  await ed.find();
  frame('8. Ctrl-Q F find "fox" — the match lands selected');

  const count = await ed.replace();
  frame(`9. Replace-all fox→cat — ${count} replacement(s), the PF-009 count`);

  console.log('\nDone — WordStar keymap, selection, clipboard, undo/redo, search/replace, indicator sync.');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
