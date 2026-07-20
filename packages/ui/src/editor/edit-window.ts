/**
 * A blue editor window framing an {@link Editor} with scroll bars and a line/column indicator. See
 * {@link EditWindow}.
 */
import { Window } from '../window/index.js';
import type { Rect } from '../layout/index.js';
import { ScrollBar } from '../scroll/index.js';
import { Editor } from './editor.js';
import { editorViewResized } from './editor-draw.js';
import type { EditorDialogHandler } from './editor-dialog.js';
import { Indicator } from './indicator.js';

/** Options for {@link EditWindow}. */
export interface EditWindowOptions {
  /**
   * The initial window rect. Prefer setting it here rather than assigning `layout.rect` after
   * construction: the window pins its scroll bars against this rect on the first layout, and a
   * post-construction assignment can leave one stale frame painted before the window re-pins.
   */
  rect?: Rect;
  /** The editor to host (e.g. a file-backed editor, or the shared clipboard editor). Omit for a plain `Editor`. */
  editor?: Editor;
  /** The shared clipboard editor — passed to a default-constructed editor, and used for the "Clipboard" title. */
  clipboard?: Editor;
  /** The find/replace/save dialog handler for a default-constructed editor. */
  editorDialog?: EditorDialogHandler;
}

/** Minimum window size in cells. */
const MIN_W = 24;
const MIN_H = 6;

/**
 * A blue editor window: an {@link Editor} framed by a movable/resizable window, with a vertical and
 * horizontal scroll bar and a `line:col` indicator wired in.
 *
 * The window enforces a minimum size of 24×6 and repositions its scroll bars and indicator whenever
 * it is resized or zoomed. The scroll bars and indicator are shown only while the window is active;
 * an inactive window shows a plain frame border. The title reads `"Clipboard"` when the hosted
 * editor is the shared clipboard editor, otherwise `"Untitled"` (or whatever a file loader sets on
 * the reactive title signal).
 *
 * Pass your own `editor` to host a file-backed or otherwise pre-configured editor; if you omit it, a
 * plain `Editor` is created, using the `clipboard`/`editorDialog` options you provide.
 *
 * @example
 * import { createApplication, EditWindow, Editor } from '@jsvision/ui';
 *
 * const app = createApplication({ caps });
 *
 * // A shared clipboard editor, hosted in its own window.
 * const clipboard = new Editor();
 *
 * // A document window sharing that clipboard.
 * const win = new EditWindow({
 *   clipboard,
 *   rect: { x: 2, y: 1, width: 48, height: 14 },
 * });
 * app.desktop.addWindow(win);
 * win.editor.setText('Hello, world!');
 */
export class EditWindow extends Window {
  /** The hosted editor (the one you supplied, or the plain one created for you). */
  readonly editor: Editor;
  /** @internal Scroll bars + indicator; shown only while the window is active. */
  protected readonly hBar: ScrollBar;
  protected readonly vBar: ScrollBar;
  protected readonly ind: Indicator;

  constructor(options: EditWindowOptions = {}) {
    const editor = options.editor ?? new Editor({ clipboard: options.clipboard, editorDialog: options.editorDialog });
    // Title "Clipboard" when this window hosts the shared clipboard editor, else "Untitled" (a file
    // loader can retitle it later through the reactive title signal).
    super(options.clipboard !== undefined && editor === options.clipboard ? 'Clipboard' : 'Untitled');
    this.minWidth = MIN_W;
    this.minHeight = MIN_H;
    this.setLayout({ padding: 0 }); // scroll bars/indicator sit on the frame itself
    if (options.rect !== undefined) this.setLayout({ rect: { ...options.rect } }); // before the first pin
    this.editor = editor;

    this.hBar = new ScrollBar({ value: editor.delta.x, orientation: 'horizontal' });
    this.vBar = new ScrollBar({ value: editor.delta.y });
    this.ind = new Indicator();
    this.add(editor);
    this.add(this.hBar);
    this.add(this.vBar);
    this.add(this.ind);
    this.layoutGadgets();
    editor.attachGadgets(this.hBar, this.vBar, this.ind);

    // Show/hide the scroll bars + indicator with the window's active state.
    this.onMount(() => {
      // Re-pin against the real rect: a caller may set layout.rect after construction, so the
      // constructor-time pin used the fallback size. The bind below relayouts on activation anyway.
      this.layoutGadgets();
      this.bind(
        () => this.active(),
        (on) => {
          this.hBar.state.visible = on;
          this.vBar.state.visible = on;
          this.ind.state.visible = on;
        },
        { relayout: true },
      );
    });
  }

  /** @internal Position the editor, scroll bars, and indicator for the window's current size. */
  protected layoutGadgets(): void {
    const { width: w, height: h } = this.currentRect();
    // Force a fresh layout: the mount-time pass may have already positioned everything against the
    // constructor-era fallback rect, so without this the scroll bars/indicator keep painting at the
    // stale position until the next event. Idempotent and cheap.
    this.invalidateLayout();
    // Every other prop is reset explicitly, not merely left unset: a hosted editor may be one the
    // caller built and laid out themselves, and this window governs its placement regardless. An
    // explicit `undefined` clears a prop back to its layout default. The three gadgets below need no
    // such reset — this window constructs them itself, so they carry nothing to clear.
    this.editor.setLayout({
      position: 'absolute',
      rect: { x: 1, y: 1, width: Math.max(0, w - 2), height: Math.max(0, h - 2) },
      direction: undefined,
      justify: undefined,
      align: undefined,
      gap: undefined,
      padding: undefined,
      size: undefined,
    });
    this.hBar.setLayout({ position: 'absolute', rect: { x: 18, y: h - 1, width: Math.max(0, w - 20), height: 1 } });
    this.vBar.setLayout({ position: 'absolute', rect: { x: w - 1, y: 1, width: 1, height: Math.max(0, h - 2) } });
    this.ind.setLayout({ position: 'absolute', rect: { x: 2, y: h - 1, width: 14, height: 1 } });
  }

  /** Reposition the scroll bars/indicator and re-fit the editor scroll after a drag-resize. */
  override onResized(): void {
    this.layoutGadgets();
    this.refitEditor();
  }

  /** Zoom, then reposition the scroll bars/indicator and re-fit the editor scroll. */
  override zoom(): void {
    super.zoom();
    this.layoutGadgets();
    this.refitEditor();
  }

  /**
   * Re-clamp the editor's scroll to the new interior size and keep the caret visible. Runs at event
   * time, before the layout pass has written the editor's new bounds, so the new interior size is
   * passed in explicitly. Without this, a resize can park the caret off-screen until the next
   * cursor move.
   */
  protected refitEditor(): void {
    const { width: w, height: h } = this.currentRect();
    editorViewResized(this.editor, { width: Math.max(0, w - 2), height: Math.max(0, h - 2) });
  }
}
