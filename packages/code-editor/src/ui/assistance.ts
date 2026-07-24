import { View, type DrawContext } from '@jsvision/ui';

/** Minimal inert completion item accepted by the terminal assistance surface. */
export interface CodeEditorCompletionItem {
  readonly label: string;
  readonly insertText?: string;
  readonly from?: number;
  readonly to?: number;
}

/** One active modal surface whose Escape dismissal precedes all other commands. */
export interface CodeEditorModalState {
  readonly kind: 'search' | 'chooser' | 'completion';
}

/** Bounded popup view used for completion and chooser presentation. */
export class CodeEditorAssistanceView extends View {
  public items: readonly string[] = Object.freeze([]);
  public selected = 0;

  readonly #maxItems: number;
  readonly #maxLabelCharacters: number;

  public constructor(
    options: { readonly maxItems?: number; readonly maxWidth?: number; readonly maxHeight?: number } = {},
  ) {
    super();
    this.#maxItems = bounded(options.maxItems, 12, 512);
    this.#maxLabelCharacters = bounded(options.maxWidth, 32, 240);
    const height = bounded(options.maxHeight, 8, 100);
    this.state.visible = false;
    this.setLayout({
      position: 'absolute',
      rect: { x: 0, y: 1, width: this.#maxLabelCharacters, height },
    });
  }

  /** Replaces popup rows with validated inert labels. */
  public show(items: readonly string[]): void {
    this.items = Object.freeze(items.slice(0, this.#maxItems).map((item) => item.slice(0, this.#maxLabelCharacters)));
    this.selected = 0;
    this.state.visible = this.items.length > 0;
    this.invalidate();
  }

  /** Dismisses the popup and releases retained rows. */
  public dismiss(): void {
    this.items = Object.freeze([]);
    this.state.visible = false;
    this.invalidate();
  }

  /** Paints popup rows through the clipped terminal facade. */
  public override draw(context: DrawContext): void {
    context.fill(' ', context.color('menuBar'));
    for (let row = 0; row < Math.min(this.items.length, context.size.height); row += 1) {
      context.text(0, row, this.items[row] ?? '', context.color(row === this.selected ? 'menuSelected' : 'menuBar'));
    }
  }
}

function bounded(value: number | undefined, fallback: number, ceiling: number): number {
  return Number.isSafeInteger(value) && (value ?? 0) >= 1 ? Math.min(value ?? fallback, ceiling) : fallback;
}
