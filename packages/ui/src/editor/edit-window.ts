/**
 * `EditWindow` — the blue editor window: a faithful `TEditWindow` port (RD-08 03-04).
 *
 * Decode (`teditwnd.cpp:29-95`, re-verified 2026-07-07 @ 57b6f56):
 *   • min **24×6** (`minEditWinSize` `:29`, `sizeLimits` `:91-95`); `ofTileable` (`:38` — our WM
 *     tiles every window, no flag needed); **blue window** (`wpBlueWindow`, no palette override).
 *   • The gadget rects (end-exclusive, `:40-52`): hScrollBar `TRect(18, y−1, x−2, y)`, vScrollBar
 *     `TRect(x−1, 1, x, y−1)`, indicator `TRect(2, y−1, 16, y)` — each created hidden in TV; ours
 *     bind `visible` to the PA-19 `Window.active` signal (the `sfActive → sfVisible` decode,
 *     `teditor2.cpp:546-554`) so an inactive window shows a plain frame border (PA-10). The rects
 *     re-pin on resize/zoom (TV `growMode`; the files `wfGrow onResized` idiom).
 *   • The editor = the framed interior `getExtent().grow(−1,−1)` (`:56-57`).
 *   • Titles (`getTitle`, `:70-78`): `"Clipboard"` when the hosted editor IS the clipboard (the
 *     identity check), else the file name | `"Untitled"` — ours is the reactive `Window.title`
 *     signal (PF-013; the `@jsvision/files` `openFileInEditor` factory binds `fileName` into it).
 *   • TV always `new`s a `TFileEditor` inside (`:58`) — internal construction was already our
 *     extension point, so the plan-preflight PF-001 caller-supplied `editor?: Editor` is no less
 *     faithful: ui stays fs-free and the files package injects a `FileEditor`.
 *
 * Precedence (PF-001): a supplied `editor` wins — `clipboard`/`editorDialog` then serve only the
 * title identity check; they configure the default-constructed `Editor` when `editor` is absent.
 * GATE-2 AFTER-diff (2026-07-07): rendered headlessly at 40×10/60×20 and diffed against the
 * decode — all three gadget rects, the interior grow(−1,−1), the 24×6 clamp, the titles, and the
 * hide-when-inactive rule match. No draw mismatch.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Window } from '../window/index.js';
import type { Rect } from '../layout/index.js';
import { ScrollBar } from '../scroll/index.js';
import { Editor } from './editor.js';
import { editorViewResized } from './editor-draw.js';
import type { EditorDialogHandler } from './editor-dialog.js';
import { Indicator } from './indicator.js';

/** Construction options (03-04 as respec'd by plan-preflight PF-001 — no `fs`/`fileName`). */
export interface EditWindowOptions {
  /**
   * The initial window rect, applied BEFORE the first gadget pin. Prefer this over assigning
   * `layout.rect` after construction: a post-construction assignment leaves the constructor-time
   * pin on the fallback rect, and the mount-time reflow can compose that stale geometry once
   * before the `onMount` re-pin takes effect (the "1:1 mid-window until the first click" defect).
   */
  rect?: Rect;
  /** The hosted editor (a files `FileEditor`, the shared clipboard editor, …); absent ⇒ a bare `Editor`. */
  editor?: Editor;
  /** The shared clipboard editor — wired into a default-constructed editor + the title identity check. */
  clipboard?: Editor;
  /** The dialog seam for a default-constructed editor. */
  editorDialog?: EditorDialogHandler;
}

/** TV `minEditWinSize` (`teditwnd.cpp:29`). */
const MIN_W = 24;
const MIN_H = 6;

/** The blue editor window: editor + indicator + both scroll bars at the TV rects. */
export class EditWindow extends Window {
  /** The hosted editor (caller-supplied per PF-001, or the default-constructed bare one). */
  readonly editor: Editor;
  /** @internal The three gadgets (visibility rides {@link Window.active}, PA-10/PA-19). */
  protected readonly hBar: ScrollBar;
  protected readonly vBar: ScrollBar;
  protected readonly ind: Indicator;

  constructor(options: EditWindowOptions = {}) {
    const editor = options.editor ?? new Editor({ clipboard: options.clipboard, editorDialog: options.editorDialog });
    // The getTitle decode (:70-78): "Clipboard" via the identity check, else "Untitled" (the
    // files factory retitles through the signal, PF-013).
    super(options.clipboard !== undefined && editor === options.clipboard ? 'Clipboard' : 'Untitled');
    this.minWidth = MIN_W;
    this.minHeight = MIN_H;
    this.layout = { ...this.layout, padding: 0 }; // gadgets sit ON the frame — TV rects verbatim
    if (options.rect !== undefined) this.layout.rect = { ...options.rect }; // before the first pin
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

    // PA-10/PA-19 — gadget visibility rides the reactive active signal (sfActive → sfVisible).
    this.onMount(() => {
      // Re-pin for the REAL rect: the caller sets layout.rect after construction (the WM idiom),
      // so the constructor-time pin used the fallback size. The bind below re-layouts anyway.
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

  /** @internal Pin the TV rects for the current size (the growMode re-pin; files wfGrow idiom). */
  protected layoutGadgets(): void {
    const { width: w, height: h } = this.currentRect();
    // The mount-time reflow may already have assigned bounds from the constructor-era fallback
    // rect (the caller sets layout.rect between construction and addWindow — the WM idiom), so
    // every re-pin must schedule a reflow or the gadgets keep painting at the stale bounds
    // (the "1:1 in the middle of the window until the first click" defect). Idempotent + cheap.
    this.invalidateLayout();
    this.editor.layout = {
      position: 'absolute',
      rect: { x: 1, y: 1, width: Math.max(0, w - 2), height: Math.max(0, h - 2) },
    };
    this.hBar.layout = { position: 'absolute', rect: { x: 18, y: h - 1, width: Math.max(0, w - 20), height: 1 } };
    this.vBar.layout = { position: 'absolute', rect: { x: w - 1, y: 1, width: 1, height: Math.max(0, h - 2) } };
    this.ind.layout = { position: 'absolute', rect: { x: 2, y: h - 1, width: 14, height: 1 } };
  }

  /** Re-pin the gadget rects + re-fit the editor scroll after a WM drag-resize (TV `growMode` anchors). */
  override onResized(): void {
    this.layoutGadgets();
    this.refitEditor();
  }

  /** Zoom also re-pins + re-fits (TV growMode fires on any bounds change). */
  override zoom(): void {
    super.zoom();
    this.layoutGadgets();
    this.refitEditor();
  }

  /**
   * Re-clamp the editor scroll to the new interior size + keep the caret visible (TV
   * `TEditor::changeBounds`; {@link editorViewResized}). Runs at event time — the gadget reflow
   * scheduled by {@link layoutGadgets} hasn't written `bounds` yet, so the editor is fed its new
   * interior size (`getExtent().grow(−1,−1)`) explicitly. Without this a shrink/grow parks the
   * hardware caret off-view until the next caret motion (the reported "caret vanishes on resize").
   */
  protected refitEditor(): void {
    const { width: w, height: h } = this.currentRect();
    editorViewResized(this.editor, { width: Math.max(0, w - 2), height: Math.max(0, h - 2) });
  }
}
