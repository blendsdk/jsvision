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

  public constructor() {
    super();
    this.state.visible = false;
    this.setLayout({ position: 'absolute', rect: { x: 0, y: 1, width: 32, height: 8 } });
  }

  /** Replaces popup rows with validated inert labels. */
  public show(items: readonly string[]): void {
    this.items = Object.freeze(items.slice(0, 12).map((item) => item.slice(0, 256)));
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
