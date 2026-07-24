import { ScrollBar, Text, Window } from '@jsvision/ui';
import { offsetToPosition } from '../document/positions.js';
import type { CodeEditorController } from '../controller.js';
import { CodeEditor } from './code-editor.js';

/** Construction options for standard window composition around a code editor. */
export interface CodeEditorWindowOptions {
  readonly controller: CodeEditorController;
  readonly title?: string;
  /** Shows the editor's optional fixed line-number gutter. Defaults to `false`. */
  readonly lineNumbers?: boolean;
  /** Runs after an accepted editor mutation so the host can refresh language services. */
  readonly onDocumentChange?: () => void;
}

/**
 * Movable editor window that adds standard scrollbar/status composition.
 *
 * @example
 * ```ts
 * const window = new CodeEditorWindow({ controller, title: 'main.ts' });
 * ```
 */
export class CodeEditorWindow extends Window {
  public readonly editor: CodeEditor;
  public readonly horizontalScrollBar: ScrollBar;
  public readonly verticalScrollBar: ScrollBar;
  public readonly statusView: Text;
  public readonly chrome = Object.freeze({
    horizontalScrollBar: true,
    verticalScrollBar: true,
    statusLine: true,
  });

  public constructor(options: CodeEditorWindowOptions) {
    super(options.title ?? 'Code Editor');
    this.editor = new CodeEditor({
      controller: options.controller,
      ...(options.lineNumbers === undefined ? {} : { lineNumbers: options.lineNumbers }),
      ...(options.onDocumentChange === undefined ? {} : { onDocumentChange: options.onDocumentChange }),
    });
    this.horizontalScrollBar = new ScrollBar({ value: this.editor.scroll.x, orientation: 'horizontal' });
    this.verticalScrollBar = new ScrollBar({ value: this.editor.scroll.y });
    this.statusView = new Text(() => {
      void this.editor.interactionRevision;
      const status = this.status;
      return `${status.language}  Ln ${status.line}, Col ${status.column}`;
    });
    this.add(this.editor);
    this.add(this.horizontalScrollBar);
    this.add(this.verticalScrollBar);
    this.add(this.statusView);
    this.setLayout({ padding: 0 });
    this.#layoutChrome();
    // Callers normally place a window after construction. Re-pin the absolute children once the
    // window is mounted so they use that real rectangle instead of the constructor fallback.
    this.onMount(() => {
      this.#layoutChrome();
      this.bind(
        () => this.editor.viewportMetrics,
        (metrics) => this.#synchronizeScrollBars(metrics),
      );
    });
  }

  /** Current language and one-based visual caret position for the status line. */
  public get status(): { readonly language: string; readonly line: number; readonly column: number } {
    const document = this.editor.controller.document;
    const position = offsetToPosition(document.snapshot, Number(document.selection.head));
    return Object.freeze({
      language: document.languageId,
      line: Number(position.line) + 1,
      column: document.visualColumnAt(Number(document.selection.head)) + 1,
    });
  }

  /** Repositions standard editor chrome after a window resize. */
  public override onResized(): void {
    this.#layoutChrome();
  }

  #layoutChrome(): void {
    const rect = this.layout.rect ?? { x: 0, y: 0, width: 40, height: 12 };
    const width = Math.max(0, rect.width);
    const height = Math.max(0, rect.height);
    const editorWidth = Math.max(0, width - 2);
    const editorHeight = Math.max(0, height - 3);
    this.editor.setLayout({
      position: 'absolute',
      rect: { x: 1, y: 1, width: editorWidth, height: editorHeight },
    });
    this.horizontalScrollBar.setLayout({
      position: 'absolute',
      rect: { x: 1, y: Math.max(0, height - 2), width: Math.max(0, width - 2), height: 1 },
    });
    this.verticalScrollBar.setLayout({
      position: 'absolute',
      rect: { x: Math.max(0, width - 1), y: 1, width: 1, height: editorHeight },
    });
    this.statusView.setLayout({
      position: 'absolute',
      rect: { x: 1, y: Math.max(0, height - 1), width: Math.max(0, width - 2), height: 1 },
    });
    this.editor.resizeViewport(editorWidth, editorHeight);
    this.#synchronizeScrollBars(this.editor.viewportMetrics);
  }

  #synchronizeScrollBars(metrics: {
    readonly textWidth: number;
    readonly height: number;
    readonly maxScrollX: number;
    readonly maxScrollY: number;
  }): void {
    this.horizontalScrollBar.setRange(0, metrics.maxScrollX, Math.max(1, metrics.textWidth - 1), 1);
    this.verticalScrollBar.setRange(0, metrics.maxScrollY, Math.max(1, metrics.height - 1), 1);
  }
}
