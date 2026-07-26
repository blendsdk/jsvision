import { stringWidth, View, type DrawContext, type Point } from '@jsvision/ui';

import { clipCodeEditorDisplayText } from '../i18n/presentation.js';

export type { CodeEditorCompletionItem } from '../presentation.js';

/** One active modal surface whose Escape dismissal precedes all other commands. */
export interface CodeEditorModalState {
  readonly kind: 'search' | 'chooser' | 'completion';
}

/** Bounded popup view used for completion and chooser presentation. */
export class CodeEditorAssistanceView extends View {
  /** The framed popup casts the same terminal-safe shadow used by menus and dropdowns. */
  public override castsShadow = true;
  public items: readonly string[] = Object.freeze([]);
  public selected = 0;

  readonly #maxItems: number;
  readonly #maxLabelCells: number;
  readonly #maxVisibleRows: number;
  #contentWidth = 20;
  #contentHeight = 3;

  public constructor(
    options: { readonly maxItems?: number; readonly maxWidth?: number; readonly maxHeight?: number } = {},
  ) {
    super();
    this.#maxItems = bounded(options.maxItems, 12, 512);
    this.#maxLabelCells = bounded(options.maxWidth, 32, 240);
    this.#maxVisibleRows = bounded(options.maxHeight, 8, 100);
    this.state.visible = false;
    this.setLayout({
      position: 'absolute',
      rect: { x: 0, y: 1, width: 20, height: 3 },
    });
  }

  /** Replaces popup rows with validated inert labels. */
  public show(items: readonly string[]): void {
    this.items = Object.freeze(
      items.slice(0, this.#maxItems).map((item) => clipCodeEditorDisplayText(item, this.#maxLabelCells)),
    );
    this.selected = 0;
    this.state.visible = this.items.length > 0;
    if (this.items.length > 0) {
      const longestLabel = this.items.reduce((longest, item) => Math.max(longest, stringWidth(item)), 0);
      this.#contentWidth = Math.max(3, Math.min(this.#maxLabelCells + 2, Math.max(18, longestLabel) + 2));
      this.#contentHeight = Math.max(3, Math.min(this.#maxVisibleRows + 2, this.items.length + 2));
      this.#setRect({ x: 0, y: 1, width: this.#contentWidth, height: this.#contentHeight });
    }
    this.invalidate();
  }

  /**
   * Places the popup at the rendered caret while keeping it inside the editor viewport.
   *
   * The popup prefers the row below the caret. Near the bottom edge it flips above when the complete
   * frame fits there; very small viewports clamp the frame to the available cells.
   */
  public placeAtCaret(caret: Point, viewport: { readonly width: number; readonly height: number }): void {
    if (!this.state.visible) return;
    const width = Math.min(this.#contentWidth, Math.max(0, viewport.width));
    const height = Math.min(this.#contentHeight, Math.max(0, viewport.height));
    const maximumX = Math.max(0, viewport.width - width);
    const maximumY = Math.max(0, viewport.height - height);
    const below = caret.y + 1;
    const above = caret.y - height;
    const y = below + height <= viewport.height ? below : above >= 0 ? above : Math.max(0, Math.min(below, maximumY));
    this.#setRect({
      x: Math.max(0, Math.min(caret.x, maximumX)),
      y,
      width,
      height,
    });
  }

  /** Dismisses the popup and releases retained rows. */
  public dismiss(): void {
    this.items = Object.freeze([]);
    this.state.visible = false;
    this.invalidate();
  }

  /** Paints popup rows through the clipped terminal facade. */
  public override draw(context: DrawContext): void {
    const frame = context.color('menuBar');
    context.fill(' ', frame);
    context.box(0, 0, context.size.width, context.size.height, frame);
    const contentWidth = Math.max(0, context.size.width - 2);
    const contentHeight = Math.max(0, context.size.height - 2);
    for (let row = 0; row < Math.min(this.items.length, contentHeight); row += 1) {
      const style = context.color(row === this.selected ? 'menuSelected' : 'menuBar');
      context.fillRect(1, row + 1, contentWidth, 1, ' ', style);
      context.text(1, row + 1, this.items[row] ?? '', style);
    }
  }

  /** Applies changed geometry only, preventing an endless draw-triggered reflow loop. */
  #setRect(rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }): void {
    const current = this.layout.rect;
    if (current?.x === rect.x && current.y === rect.y && current.width === rect.width && current.height === rect.height)
      return;
    this.setLayout({ position: 'absolute', rect });
  }
}

function bounded(value: number | undefined, fallback: number, ceiling: number): number {
  return Number.isSafeInteger(value) && (value ?? 0) >= 1 ? Math.min(value ?? fallback, ceiling) : fallback;
}
