import { ScrollBar, Text, Window } from '@jsvision/ui';
import { offsetToPosition, offsetToVisualColumn } from '../document/positions.js';
import type { CodeEditorController } from '../controller.js';
import { CodeEditor } from './code-editor.js';

/** Construction options for standard window composition around a code editor. */
export interface CodeEditorWindowOptions {
  readonly controller: CodeEditorController;
  readonly title?: string;
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
    this.editor = new CodeEditor({ controller: options.controller });
    this.horizontalScrollBar = new ScrollBar({ value: this.editor.scroll.x, orientation: 'horizontal' });
    this.verticalScrollBar = new ScrollBar({ value: this.editor.scroll.y });
    this.statusView = new Text(() => {
      const status = this.status;
      return `${status.language}  Ln ${status.line}, Col ${status.column}`;
    });
    this.add(this.editor);
    this.add(this.horizontalScrollBar);
    this.add(this.verticalScrollBar);
    this.add(this.statusView);
    this.setLayout({ padding: 0 });
    this.#layoutChrome();
  }

  /** Current language and one-based visual caret position for the status line. */
  public get status(): { readonly language: string; readonly line: number; readonly column: number } {
    const document = this.editor.controller.document;
    const position = offsetToPosition(document.snapshot, Number(document.selection.head));
    return Object.freeze({
      language: document.languageId,
      line: Number(position.line) + 1,
      column: Number(offsetToVisualColumn(document.snapshot, Number(document.selection.head), document.tabSize)) + 1,
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
    this.editor.setLayout({
      position: 'absolute',
      rect: { x: 1, y: 1, width: Math.max(0, width - 2), height: Math.max(0, height - 3) },
    });
    this.horizontalScrollBar.setLayout({
      position: 'absolute',
      rect: { x: 1, y: Math.max(0, height - 2), width: Math.max(0, width - 2), height: 1 },
    });
    this.verticalScrollBar.setLayout({
      position: 'absolute',
      rect: { x: Math.max(0, width - 1), y: 1, width: 1, height: Math.max(0, height - 3) },
    });
    this.statusView.setLayout({
      position: 'absolute',
      rect: { x: 1, y: Math.max(0, height - 1), width: Math.max(0, width - 2), height: 1 },
    });
    this.horizontalScrollBar.setRange(
      0,
      Math.max(0, longestLine(this.editor.controller.document.text) - Math.max(1, width - 2)),
    );
    this.verticalScrollBar.setRange(
      0,
      Math.max(0, this.editor.controller.document.snapshot.lineCount - Math.max(1, height - 3)),
    );
  }
}

function longestLine(text: string): number {
  let longest = 0;
  for (const line of text.split(/\r\n|\r|\n/u)) longest = Math.max(longest, line.length);
  return longest;
}
