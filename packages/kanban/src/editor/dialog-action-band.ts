import { Group, measureButtonGroup } from '@jsvision/ui';
import type { Button, DrawContext, View } from '@jsvision/ui';

/** Gap between adjacent action buttons. */
const ACTION_GAP = 2;
/** Vertical separation between wrapped button rows. */
const ACTION_ROW_GAP = 1;

/** Retained button band that wraps and recentres against its live terminal width. */
class ResponsiveEditorActionBand extends Group {
  readonly #buttons: readonly Button[];
  #height = 0;

  /** Adds each action once so focus and pressed state survive every resize. */
  constructor(buttons: readonly Button[], initialWidth: number) {
    super();
    this.#buttons = buttons;
    for (const button of buttons) this.add(button);
    this.#layoutButtons(Math.max(1, initialWidth));
  }

  /** Recomputes only terminal-cell geometry; button instances and ordering stay stable. */
  #layoutButtons(availableWidth: number): void {
    let columns = this.#buttons.length;
    while (
      columns > 1 &&
      measureButtonGroup(this.#buttons, {
        minimumButtonWidth: 10,
        gap: ACTION_GAP,
        rowGap: ACTION_ROW_GAP,
        maxColumns: columns,
      }).width > availableWidth
    ) {
      columns -= 1;
    }
    const metrics = measureButtonGroup(this.#buttons, {
      minimumButtonWidth: 10,
      gap: ACTION_GAP,
      rowGap: ACTION_ROW_GAP,
      maxColumns: Math.max(1, columns),
    });
    const originX = Math.max(0, Math.floor((availableWidth - metrics.width) / 2));
    for (let index = 0; index < this.#buttons.length; index += 1) {
      const column = index % Math.max(1, columns);
      const line = Math.floor(index / Math.max(1, columns));
      this.#buttons[index]!.bounds = {
        x: originX + column * (metrics.buttonWidth + ACTION_GAP),
        y: line * (2 + ACTION_ROW_GAP),
        width: metrics.buttonWidth,
        height: 2,
      };
    }
    if (metrics.height !== this.#height) {
      this.#height = metrics.height;
      this.setLayout({ size: { kind: 'fixed', cells: metrics.height } });
    }
  }

  /** Updates child bounds before the compositor descends into the retained buttons. */
  override draw(ctx: DrawContext): void {
    this.#layoutButtons(ctx.size.width);
  }
}

/** Creates a live measured button band and preserves stable traversal order. */
export function createKanbanEditorActionBand(buttons: readonly Button[], availableWidth: number): View {
  return new ResponsiveEditorActionBand(buttons, availableWidth);
}
