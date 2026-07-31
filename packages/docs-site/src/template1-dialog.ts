import { Dialog, Group } from '@jsvision/ui';
import type { Rect, View } from '@jsvision/ui';

/** Current outer size of a template1 example dialog. */
export interface Template1DialogSize {
  /** Width in terminal cells, including the dialog frame. */
  readonly width: number;
  /** Height in terminal cells, including the dialog frame. */
  readonly height: number;
}

/** Repositions example content after a drag-resize, maximize, or restore operation. */
export type Template1DialogResize = (size: Template1DialogSize) => void;

/** Construction options for the shared template1 example dialog. */
export interface Template1DialogOptions {
  /** Dialog frame title. */
  readonly title: string;
  /** Initial and minimum width in terminal cells. */
  readonly width: number;
  /** Initial and minimum height in terminal cells. */
  readonly height: number;
  /**
   * Whether the example opens maximized. Defaults to `false`; enable it only after the individual
   * example has been reviewed at both its compact and maximized sizes.
   */
  readonly startMaximized?: boolean;
  /**
   * Keep direct content children at their authored heights while scaling positions and widths.
   *
   * Pass `true` for primitive galleries made entirely from fixed-height control rows. A predicate
   * can preserve labels, buttons, and teaching text while allowing selected editors, grids, lists,
   * or other workspace panes to consume vertical space.
   */
  readonly preserveChildHeights?: boolean | ((view: View) => boolean);
  /** Repositions content whenever the dialog size changes. */
  readonly onResize?: Template1DialogResize;
}

/** Authored geometry retained so repeated resize and restore operations never accumulate rounding drift. */
interface Template1AuthoredChild {
  /** Direct content child whose layout is reflowed. */
  readonly view: View;
  /** Child rectangle at the compact authored size. */
  readonly rect: Rect;
}

/** Compact content geometry used by the shared proportional fallback. */
interface Template1AuthoredContent {
  /** Standard padded content group. */
  readonly content: Group;
  /** Compact content width in terminal cells. */
  readonly width: number;
  /** Compact content height in terminal cells. */
  readonly height: number;
  /** Direct child rectangles captured before the first resize. */
  readonly children: readonly Template1AuthoredChild[];
}

/**
 * Scale one interval while keeping both of its authored edges on the same proportional grid.
 *
 * Scaling the left and right edges separately avoids gaps and overlaps between adjacent regions.
 */
function scaleInterval(start: number, length: number, authoredExtent: number, nextExtent: number): [number, number] {
  const nextStart = Math.round((start * nextExtent) / authoredExtent);
  if (length === 0) return [nextStart, 0];
  const nextEnd = Math.round(((start + length) * nextExtent) / authoredExtent);
  return [nextStart, Math.max(1, nextEnd - nextStart)];
}

/**
 * Shared template1 example dialog with resize and maximize/restore affordances.
 *
 * It opens centered at its authored size by default. Maximized startup is deliberately opt-in so a
 * compact component demonstration is never expanded without reviewing how its content uses the
 * additional room.
 */
export class Template1Dialog extends Dialog {
  protected readonly resizeContent: Template1DialogResize | undefined;
  protected readonly startMaximized: boolean;
  protected readonly preserveChildHeights: boolean | ((view: View) => boolean);
  protected authoredContent: Template1AuthoredContent | undefined;

  /**
   * @param options Initial geometry, optional responsive layout callback, and reviewed startup mode.
   */
  constructor(options: Template1DialogOptions) {
    super({ title: options.title, width: options.width, height: options.height });
    this.resizable = true;
    this.zoomable = true;
    this.closable = false;
    this.minWidth = options.width;
    this.minHeight = options.height;
    this.resizeContent = options.onResize;
    this.startMaximized = options.startMaximized ?? false;
    this.preserveChildHeights = options.preserveChildHeights ?? false;
    this.onMount(() => {
      if (this.startMaximized && !this.isZoomed()) this.zoom();
    });
  }

  /** Reflow the example after a pointer-driven resize. */
  override onResized(): void {
    const { width, height } = this.currentRect();
    if (this.resizeContent !== undefined) {
      this.resizeContent({ width, height });
      return;
    }

    const content = this.children[0];
    if (!(content instanceof Group)) return;
    this.authoredContent ??= {
      content,
      width: content.bounds.width,
      height: content.bounds.height,
      children: content.children.map((view) => ({ view, rect: { ...view.bounds } })),
    };

    const authored = this.authoredContent;
    const nextWidth = width - 4;
    const nextHeight = height - 4;
    authored.content.setLayout({
      rect: {
        x: 1,
        y: 1,
        width: nextWidth,
        height: nextHeight,
      },
    });
    for (const child of authored.children) {
      const [x, childWidth] = scaleInterval(child.rect.x, child.rect.width, authored.width, nextWidth);
      const [y, scaledHeight] = scaleInterval(child.rect.y, child.rect.height, authored.height, nextHeight);
      const preserveHeight =
        typeof this.preserveChildHeights === 'function'
          ? this.preserveChildHeights(child.view)
          : this.preserveChildHeights;
      const childHeight = preserveHeight ? child.rect.height : scaledHeight;
      child.view.setLayout({ rect: { x, y, width: childWidth, height: childHeight } });
    }
  }

  /** Maximize or restore, then reflow the example into the resulting dialog size. */
  override zoom(): void {
    super.zoom();
    this.onResized();
  }
}
