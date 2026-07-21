/**
 * Specification tests (immutable oracles) — RD-08 Phase-4 `Editor` view (ST-10…ST-14).
 *
 * Source: RD-08 AC-2/AC-4/AC-7/AC-11/AC-12 + PF-001/PF-004/PA-18 → ST-10…ST-14
 * (codeops/features/jsvision-ui/plans/editor-family/07-testing-strategy.md; decodes in
 * 03-02-editor-view.md). TV sources: the selection/mouse model (`teditor2.cpp:459-539`,
 * `teditor1.cpp:521-584`), overwrite/autoIndent (`teditor1.cpp:596-616`, `teditor2.cpp:288-301`),
 * the `doUpdate` gadget pushes (`teditor1.cpp:431-451` — `setParams` at `:442,444`; write-back
 * `checkScrollBar` `:502-512`), and the PF-001 preProcess prefix claim. Real `EventLoop` +
 * `createApplication` where chrome matters; the injected PA-18 clock makes multi-click
 * deterministic. Expectations derive from RD-08 + the decodes, never the implementation.
 *
 * Trace: RD-08 03-02/03-04 · PA-9/PA-15/PA-18 · PF-001/PF-003/PF-004 · ST-10…ST-14.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { createApplication } from '../src/app/index.js';
import { Window } from '../src/window/index.js';
import { menuBar, subMenu, item } from '../src/menu/index.js';
import { ScrollBar } from '../src/scroll/index.js';
import { Editor } from '../src/editor/editor.js';
import type { IndicatorTarget } from '../src/editor/editor.js';
import type { EditorDialogRequest, EditorDialogResult } from '../src/editor/editor-dialog.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}

/** A 1-based SGR mouse event at absolute 0-based (x, y). */
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x: x + 1, y: y + 1 };
}

/**
 * Mount one editor filling a `w`×`h` loop viewport and focus it. The multi-click clock now lives on
 * the loop (the framework's single source of truth); the harness accepts `now` and injects it into
 * `createEventLoop` so the same-cell double-click window stays deterministic (AR-14 — only the
 * injection point moves; the oracle's assertions are unchanged).
 */
function mountEditor(
  opts: ConstructorParameters<typeof Editor>[0] & { now?: () => number } = {},
  w = 20,
  h = 5,
): { loop: ReturnType<typeof createEventLoop>; ed: Editor } {
  const { now, ...editorOpts } = opts;
  const ed = new Editor(editorOpts);
  const root = new Group();
  root.setLayout({ direction: 'col' });
  ed.setLayout({ size: { kind: 'fr', weight: 1 } });
  root.add(ed);
  const loop = createEventLoop({ width: w, height: h }, { caps, now });
  loop.mount(root);
  loop.renderRoot.flush(); // settle bounds — hit-testing and the size.x/size.y math need them
  loop.focusView(ed);
  return { loop, ed };
}

// ST-10 / AC-4 — selection: cluster-atomic Shift+Right; click collapse; word/line multi-click
// (PA-18 injected clock); drag-below auto-scroll + extend.
test('ST-10: Shift+Right extends the selection by exactly one cluster', () => {
  const { loop, ed } = mountEditor();
  ed.setText('👍x');
  loop.dispatch(key('right', { shift: true }));
  expect(ed.selectionText()).toBe('👍'); // one whole surrogate-pair cluster
  expect(ed.hasSelection()).toBe(true);
});

test('ST-10: a plain click collapses the selection and moves the caret', () => {
  const { loop, ed } = mountEditor();
  ed.setText('hello world');
  loop.dispatch(key('right', { shift: true }));
  expect(ed.hasSelection()).toBe(true);
  loop.dispatch(mouse('down', 3, 0));
  loop.dispatch(mouse('up', 3, 0));
  expect(ed.hasSelection()).toBe(false);
  expect(ed.curPos()).toEqual({ line: 1, col: 4 }); // 1-based col at cell 3
});

test('ST-10: double-click selects exactly the word; triple-click the whole line incl. EOL (PA-18)', () => {
  let t = 1000;
  const { loop, ed } = mountEditor({ now: () => t });
  ed.setText('foo bar\nsecond line\nthird');

  // Double-click on 'bar' (cell 4, row 0) — two downs on the same cell within 500 ms.
  loop.dispatch(mouse('down', 4, 0));
  loop.dispatch(mouse('up', 4, 0));
  t += 300;
  loop.dispatch(mouse('down', 4, 0));
  loop.dispatch(mouse('up', 4, 0));
  expect(ed.selectionText()).toBe('bar');

  // Triple-click on line 2 — three downs on the same cell, each within the window.
  t += 1000;
  loop.dispatch(mouse('down', 2, 1));
  loop.dispatch(mouse('up', 2, 1));
  t += 200;
  loop.dispatch(mouse('down', 2, 1));
  loop.dispatch(mouse('up', 2, 1));
  t += 200;
  loop.dispatch(mouse('down', 2, 1));
  loop.dispatch(mouse('up', 2, 1));
  expect(ed.selectionText()).toBe('second line\n'); // the whole line INCLUDING its EOL
});

test('ST-10: dragging below the bottom edge auto-scrolls and keeps extending', () => {
  const { loop, ed } = mountEditor({}, 10, 3);
  ed.setText('l0\nl1\nl2\nl3\nl4\nl5');
  loop.dispatch(mouse('down', 0, 0));
  loop.dispatch(mouse('drag', 0, 5)); // below the 3-row viewport → scroll + extend
  expect(ed.delta.y()).toBe(1); // one auto-scroll step per event (the evMouseAuto decode)
  expect(ed.selectionText()).toContain('l2');
  loop.dispatch(mouse('up', 0, 5));
  expect(ed.hasSelection()).toBe(true);
});

// ST-11 / AC-7 — overwrite replaces the char under the caret (appends at EOL); autoIndent copies
// the previous line's leading whitespace on Enter.
test('ST-11: overwrite mode replaces under the caret and appends at EOL', () => {
  const { loop, ed } = mountEditor();
  ed.setText('xy');
  expect(ed.insertMode()).toBe(true);
  loop.dispatch(key('insert'));
  expect(ed.insertMode()).toBe(false); // Ins toggles to overwrite
  loop.dispatch(key('a'));
  expect(ed.getText()).toBe('ay'); // replaced 'x'
  ed.execute('textEnd');
  loop.dispatch(key('b'));
  expect(ed.getText()).toBe('ayb'); // at EOL overwrite appends
});

test('ST-11: Enter with autoIndent copies the leading whitespace; without it, none', () => {
  const { loop: l1, ed: e1 } = mountEditor({ autoIndent: true });
  e1.setText('  foo');
  e1.execute('textEnd');
  l1.dispatch(key('enter'));
  expect(e1.getText()).toBe('  foo\n  ');

  const { loop: l2, ed: e2 } = mountEditor();
  e2.setText('  foo');
  e2.execute('textEnd');
  l2.dispatch(key('enter'));
  expect(e2.getText()).toBe('  foo\n');
});

// ST-12 / PF-004 — desiredCaret: curPos − delta while focused; null when unfocused.
test('ST-12: desiredCaret is curPos − delta while focused, null when unfocused', () => {
  const ed = new Editor();
  const other = new Editor(); // a second focusable target
  const root = new Group();
  root.setLayout({ direction: 'col' });
  ed.setLayout({ size: { kind: 'fixed', cells: 5 } });
  other.setLayout({ size: { kind: 'fixed', cells: 2 } });
  root.add(ed);
  root.add(other);
  const loop = createEventLoop({ width: 20, height: 7 }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  loop.focusView(ed);

  ed.setText(Array.from({ length: 8 }, () => 'abcdef').join('\n')); // 8 lines > height (5)
  ed.execute('lineDown');
  ed.execute('lineDown');
  for (let i = 0; i < 5; i++) ed.execute('charRight'); // curPos (col 5, line 2) 0-based
  ed.delta.x.set(1);
  ed.delta.y.set(1);
  expect(ed.desiredCaret()).toEqual({ x: 4, y: 1 });

  loop.focusView(other); // focus elsewhere
  expect(ed.desiredCaret()).toBeNull();
});

// ST-13 / AC-11/AC-12 — the decoded gadget pushes + the bar write-back channel.
class RecordingBar extends ScrollBar {
  public calls: Array<[number, number, number | undefined, number | undefined]> = [];
  override setRange(min: number, max: number, pageStep?: number, arrowStep?: number): void {
    super.setRange(min, max, pageStep, arrowStep);
    this.calls.push([min, max, pageStep, arrowStep]);
  }
}

test('ST-13: attachGadgets pushes the decoded setRange params + indicator values; bar writes scroll back', () => {
  const { loop, ed } = mountEditor({}, 10, 4);
  ed.setText('a0\na1\na2\na3\na4\na5'); // 6 lines
  const h = new RecordingBar({ value: ed.delta.x, orientation: 'horizontal' });
  const v = new RecordingBar({ value: ed.delta.y });
  const indicator: Array<{ pos: { line: number; col: number }; modified: boolean }> = [];
  const ind: IndicatorTarget = {
    setValue: (pos, modified) => indicator.push({ pos, modified }),
  };
  ed.attachGadgets(h, v, ind);

  ed.execute('lineDown'); // an edit/scroll tick → pushes
  const lastH = h.calls[h.calls.length - 1];
  const lastV = v.calls[v.calls.length - 1];
  expect(lastH).toEqual([0, 256 - 10, 5, 1]); // H: (0, limit.x−size.x, size.x/2, 1)
  expect(lastV).toEqual([0, 6 - 4, 3, 1]); // V: (0, limit.y−size.y, size.y−1, 1)
  const lastInd = indicator[indicator.length - 1];
  expect(lastInd.pos).toEqual({ line: 2, col: 1 }); // 1-based
  expect(lastInd.modified).toBe(false);

  loop.dispatch(key('z')); // typing marks modified
  expect(indicator[indicator.length - 1].modified).toBe(true);

  ed.delta.y.set(9); // a bar-value write beyond range scrolls back, clamped (checkScrollBar)
  expect(ed.delta.y()).toBe(2); // limit.y − size.y = 6 − 4
});

// ST-17 / AC-5 / PA-2 / PA-16 — the clipboard-editor seam + the OSC-52 mirror (Phase 5).
test('ST-17: copy fills the clipboard editor (selected) + writes ONE OSC-52; cut/paste behave; no-clipboard pastes the shared buffer', () => {
  const capsClip = { ...caps, osc: { ...caps.osc, clipboard52: true } };
  const clipboard = new Editor();
  const ed = new Editor({ clipboard });
  const root = new Group();
  root.setLayout({ direction: 'col' });
  ed.setLayout({ size: { kind: 'fr', weight: 1 } });
  root.add(ed);
  const loop = createEventLoop({ width: 20, height: 5 }, { caps: capsClip });
  const oscWrites: string[] = [];
  loop.writeClipboard = (seq) => oscWrites.push(seq);
  loop.mount(root);
  loop.renderRoot.flush();
  loop.focusView(ed);

  ed.setText('hello world');
  for (let i = 0; i < 5; i++) loop.dispatch(key('right', { shift: true })); // select "hello"
  loop.dispatch(key('insert', { ctrl: true })); // copy
  expect(clipboard.getText()).toBe('hello'); // contains EXACTLY the copied text
  expect(clipboard.selectionText()).toBe('hello'); // and holds it selected (PA-16)
  expect(oscWrites).toHaveLength(1); // ONE OSC-52 write
  expect(oscWrites[0]).toBe(`\x1b]52;c;${Buffer.from('hello', 'utf8').toString('base64')}\x07`);
  expect(ed.getText()).toBe('hello world'); // copy does not mutate

  loop.dispatch(key('delete', { shift: true })); // cut — removes as ONE step
  expect(ed.getText()).toBe(' world');
  ed.execute('undo');
  expect(ed.getText()).toBe('hello world'); // one undo restores the whole cut

  // Paste over a selection replaces it.
  ed.execute('textStart');
  for (let i = 0; i < 5; i++) loop.dispatch(key('right', { shift: true })); // select "hello" again
  loop.dispatch(key('insert', { shift: true })); // paste
  expect(ed.getText()).toBe('hello world'); // "hello" replaced by the clipboard's "hello"

  // With NO clipboard editor injected: copy/cut still mirror + delete. Paste no longer degrades to a
  // no-op — the global-clipboard feature added a loop-owned app-local buffer shared across widgets, and
  // paste falls back to it (this deliberately supersedes the earlier TV null-clipboard no-op).
  const bare = new Editor();
  const root2 = new Group();
  root2.setLayout({ direction: 'col' });
  bare.setLayout({ size: { kind: 'fr', weight: 1 } });
  root2.add(bare);
  const loop2 = createEventLoop({ width: 20, height: 5 }, { caps: capsClip });
  const osc2: string[] = [];
  loop2.writeClipboard = (seq) => osc2.push(seq);
  loop2.mount(root2);
  loop2.renderRoot.flush();
  loop2.focusView(bare);
  bare.setText('abc');
  for (let i = 0; i < 2; i++) loop2.dispatch(key('right', { shift: true }));
  loop2.dispatch(key('insert', { ctrl: true })); // copy → mirror only
  expect(osc2).toHaveLength(1);
  loop2.dispatch(key('delete', { shift: true })); // cut → mirror + delete
  expect(osc2).toHaveLength(2);
  expect(bare.getText()).toBe('c');
  loop2.dispatch(key('insert', { shift: true })); // paste → falls back to the app-local buffer ("ab", cut above)
  expect(bare.getText()).toBe('abc');
});

// ST-18 / AC-5 — a bracketed paste (however many chunks the wire delivered) is ONE insertion,
// ONE undo step.
test('ST-18: a bracketed paste records exactly one undo step', () => {
  const { loop, ed } = mountEditor();
  ed.setText('');
  loop.dispatch({ type: 'paste', text: 'xx\nyy', truncated: false });
  expect(ed.getText()).toBe('xx\nyy');
  ed.execute('undo');
  expect(ed.getText()).toBe(''); // the whole paste gone in one step
});

// ST-14 / PF-001 — the focused editor claims Ctrl-Q chords before app chrome; unfocused editors
// are untouched.
test('ST-14: a focused editor consumes Ctrl-Q,F (find flows); unfocused, it never sees the chord', () => {
  const requests: EditorDialogRequest[] = [];
  const dialog = (req: EditorDialogRequest): Promise<EditorDialogResult> => {
    requests.push(req);
    return Promise.resolve({ kind: 'find', rec: null });
  };
  const app = createApplication({
    caps,
    viewport: { width: 40, height: 12 },
    menuBar: menuBar([subMenu('~F~ile', [item('Open', 'open')])]),
  });
  const ed = new Editor({ editorDialog: dialog });
  const win = new Window('E');
  win.setLayout({ rect: { x: 0, y: 1, width: 20, height: 8 } });
  win.add(ed);
  app.desktop.addWindow(win);
  const w2 = new Window('Other');
  w2.setLayout({ rect: { x: 22, y: 1, width: 15, height: 6 } });
  app.desktop.addWindow(w2);
  app.loop.renderRoot.flush();

  app.loop.focusView(ed);
  app.loop.dispatch(key('q', { ctrl: true }));
  app.loop.dispatch(key('f'));
  expect(requests.map((r) => r.kind)).toEqual(['find']); // the chord reached the editor's seam

  app.loop.focusView(w2); // focus elsewhere
  app.loop.dispatch(key('q', { ctrl: true }));
  app.loop.dispatch(key('f'));
  expect(requests).toHaveLength(1); // the unfocused editor never saw the chord
});
