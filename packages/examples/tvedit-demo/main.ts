/**
 * `demo:tvedit` — the live Turbo Vision **tvedit clone** (RD-08 AR-260, the acceptance oracle): a
 * real-TTY application composing the decoded tvedit menu bar + status line
 * (`examples/tvedit/tvedit3.cpp:36-93`), multiple `EditWindow`s over files (`openFileInEditor`),
 * the shared **Clipboard window**, find/replace through `wireEditorDialogs`, the RD-09
 * `FileDialog` for Open/Save-as, and cascade/tile.
 *
 * Decoded deviations (03-07): TV's File menu binds Exit to `kbCtrlQ` (`tvedit3.cpp:47`) — the
 * clone must NOT bind Ctrl-Q/Ctrl-K in the app keymap (PF-001; the focused editor owns the
 * WordStar prefixes), so Exit rides Alt-X/menu-pick. The status item labeled `~Ctrl-W~ Close` is
 * bound to `kbAltF3` in TV (`:84`) — the clone binds the label's own Ctrl-W chord. DOS shell is
 * skipped (no analogue). Quit (PF-012): Exit/Alt-X emits a demo-local `exitRequest` whose handler
 * AWAITS the `valid('quit')` sweep across open file editors and only then emits `Commands.quit`.
 *
 * Headless (no TTY): composes the app, prints ONE first frame, and exits 0 — the e2e smoke path;
 * full interactivity is the manual oracle.
 *
 * Run it:  yarn workspace @jsvision/examples demo:tvedit
 * `.js` per NodeNext.
 */
import { resolveCapabilities, createKeymap, resolveCapabilitiesAsync, createTerminalQuery } from '@jsvision/core';
import {
  createApplication,
  menuBar,
  subMenu,
  item,
  separator,
  statusLine,
  statusItem,
  Commands,
  EditorCommands,
  Editor,
  EditWindow,
  wireEditorDialogs,
  View,
} from '@jsvision/ui';
import type { Application, DispatchEvent } from '@jsvision/ui';
import { nodeFileSystem, openFile, openFileInEditor, FileCommands, FileEditor } from '@jsvision/files';

/** Demo-local commands (no framework surface — the PF-012 quit-sweep + window arrangement). */
const CMD_EXIT_REQUEST = 'exitRequest';

/** The decoded tvedit menu bar (tvedit3.cpp:36-73; deviations in the module JSDoc). */
function buildMenuBar() {
  return menuBar([
    subMenu('~F~ile', [
      item('~O~pen...', FileCommands.open, 'F3'),
      item('~N~ew', FileCommands.new, 'Ctrl-N'),
      item('~S~ave', FileCommands.save, 'F2'),
      item('S~a~ve as...', FileCommands.saveAs),
      separator(),
      item('E~x~it', CMD_EXIT_REQUEST, 'Alt-X'), // TV shows Ctrl-Q — the PF-001 deviation
    ]),
    subMenu('~E~dit', [
      item('~U~ndo', Commands.undo),
      item('~R~edo', Commands.redo), // the AR-253/PA-1 extension row
      separator(),
      item('Cu~t~', Commands.cut, 'Shift-Del'),
      item('~C~opy', Commands.copy, 'Ctrl-Ins'),
      item('~P~aste', Commands.paste, 'Shift-Ins'),
      separator(),
      item('C~l~ear', EditorCommands.clear, 'Ctrl-Del'), // label per decode; the chord runs delWord (PF-005)
    ]),
    subMenu('~S~earch', [
      item('~F~ind...', EditorCommands.find),
      item('~R~eplace...', EditorCommands.replace),
      item('~S~earch again', EditorCommands.searchAgain),
    ]),
    subMenu('~W~indows', [
      item('~Z~oom', Commands.zoom, 'F5'),
      item('~T~ile', Commands.tile),
      item('C~a~scade', Commands.cascade),
      item('~N~ext', Commands.next, 'F6'),
      item('~P~revious', Commands.prev, 'Shift-F6'),
      item('~C~lose', Commands.close, 'Ctrl-W'),
    ]),
  ]);
}

/** The decoded tvedit status line (tvedit3.cpp:76-93). */
function buildStatusLine() {
  return statusLine([
    statusItem('~F2~ Save', FileCommands.save, 'F2'),
    statusItem('~F3~ Open', FileCommands.open, 'F3'),
    statusItem('~Ctrl-W~ Close', Commands.close, 'Ctrl-W'), // TV bound kbAltF3 — documented simplification
    statusItem('~F5~ Zoom', Commands.zoom, 'F5'),
    statusItem('~F6~ Next', Commands.next, 'F6'),
    statusItem('~Alt-X~ Exit', CMD_EXIT_REQUEST, 'Alt-X'),
  ]);
}

/** The app keymap — chords per the decode; NEVER Ctrl-Q/Ctrl-K (PF-001). */
function buildKeymap() {
  return createKeymap({
    f2: FileCommands.save,
    f3: FileCommands.open,
    'ctrl+n': FileCommands.new,
    f5: Commands.zoom,
    f6: Commands.next,
    'shift+f6': Commands.prev,
    'ctrl+w': Commands.close,
    'shift+delete': Commands.cut,
    'ctrl+insert': Commands.copy,
    'shift+insert': Commands.paste,
    'alt+x': CMD_EXIT_REQUEST,
  });
}

/** Collect the open FileEditors (the quit-sweep targets, PF-012). */
function openFileEditors(app: Application): FileEditor[] {
  const out: FileEditor[] = [];
  for (const child of app.desktop.children) {
    if (child instanceof EditWindow && child.editor instanceof FileEditor) out.push(child.editor);
  }
  return out;
}

/** A hidden post-process sink handling the demo-level commands (the kitchen-sink CommandSink idiom). */
class DemoSink extends View {
  override postProcess = true;
  override focusable = false;
  constructor(private readonly handle: (command: string) => void) {
    super();
    this.layout = { size: { kind: 'fixed', cells: 0 } };
  }
  override draw(): void {
    /* invisible */
  }
  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type !== 'command') return;
    this.handle(ev.event.command);
    // Never sets handled — the WM/editors keep their own routing.
  }
}

async function main(): Promise<number> {
  const fs = nodeFileSystem;

  if (process.stdout.isTTY !== true) {
    // The e2e first-frame path: compose headlessly, print one frame, exit 0.
    const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
    const app = createApplication({
      caps,
      viewport: { width: 80, height: 24 },
      menuBar: buildMenuBar(),
      statusLine: buildStatusLine(),
      keymap: buildKeymap(),
    });
    const clipboard = new Editor();
    const clipWin = new EditWindow({ editor: clipboard, clipboard, rect: { x: 40, y: 12, width: 36, height: 9 } });
    app.desktop.addWindow(clipWin);
    openFileInEditor(app, { fs, clipboard, rect: { x: 2, y: 1, width: 44, height: 14 } });
    app.loop.renderRoot.flush();
    const buf = app.loop.renderRoot.buffer();
    console.log('demo:tvedit (headless first frame — run in a real TTY for the live clone):');
    for (let y = 0; y < 24; y++) {
      let row = '';
      for (let x = 0; x < 80; x++) row += buf.get(x, y)?.char ?? ' ';
      console.log(row);
    }
    return 0;
  }

  const caps = (
    await resolveCapabilitiesAsync({
      env: process.env,
      platform: process.platform,
      query: createTerminalQuery(process.stdin, process.stdout),
      override: { input: { mouseSgr: true }, unicode: { utf8: true } },
    })
  ).profile;

  const app = createApplication({
    caps,
    menuBar: buildMenuBar(),
    statusLine: buildStatusLine(),
    keymap: buildKeymap(),
  });
  const host = { loop: app.loop, desktop: app.desktop };
  const editorDialog = wireEditorDialogs(host, {
    saveAs: (name) =>
      openFile(host, { save: true, title: 'Save file as', directory: name === '' ? undefined : fs.dirname(name) }),
  });

  // The shared clipboard editor, hosted in its own window (title "Clipboard" via the identity check).
  const clipboard = new Editor();
  const clipWin = new EditWindow({ editor: clipboard, clipboard, rect: { x: 42, y: 12, width: 36, height: 9 } });
  app.desktop.addWindow(clipWin);

  let untitledCount = 0;
  const newWindow = (fileName?: string): void => {
    untitledCount += 1;
    const { window } = openFileInEditor(app, {
      fs,
      fileName,
      clipboard,
      editorDialog,
      rect: { x: 1 + (untitledCount % 5) * 2, y: 1 + (untitledCount % 5), width: 48, height: 14 },
    });
    window.number = untitledCount <= 9 ? untitledCount : undefined;
  };
  newWindow(); // start with one untitled editor (the tvedit shape)

  const focusedFileEditor = (): FileEditor | null => {
    const f = app.loop.getFocused();
    let cur: View | null = f;
    while (cur !== null && !(cur instanceof EditWindow)) cur = cur.parent;
    return cur instanceof EditWindow && cur.editor instanceof FileEditor ? cur.editor : null;
  };

  const sink = new DemoSink((command) => {
    if (command === FileCommands.open) {
      void openFile(host, { fs }).then((path) => {
        if (path !== null) newWindow(path);
      });
    } else if (command === FileCommands.new) {
      newWindow();
    } else if (command === FileCommands.save) {
      void focusedFileEditor()?.save();
    } else if (command === FileCommands.saveAs) {
      void focusedFileEditor()?.saveAs();
    } else if (command === CMD_EXIT_REQUEST) {
      // PF-012 — await the valid('quit') sweep, then quit for real.
      void (async () => {
        for (const ed of openFileEditors(app)) {
          if (!(await ed.valid('quit'))) return; // a Cancel aborts the exit
        }
        app.loop.emitCommand(Commands.quit);
      })();
    }
  });
  sink.state.visible = false; // reflow/paint/hit-test-inert; still swept post-process (the sink idiom)
  app.desktop.add(sink);

  return app.run();
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
